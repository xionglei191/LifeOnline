import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import type { Dimension, Note } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchNotes: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchNotes: apiMocks.fetchNotes,
}));

vi.mock('./useWebSocket', () => ({
  isIndexRefreshEvent: vi.fn(() => true),
}));

import { useDimensionNotes } from './useDimensionNotes';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createNote(id: string, dimension: string): Note {
  return {
    id,
    file_name: `${id}.md`,
    file_path: `/vault/${dimension}/${id}.md`,
    title: id,
    content: `${id} content`,
    type: 'note',
    dimension: dimension as Note['dimension'],
    status: 'pending',
    priority: 'medium',
    tags: [],
    date: '2026-03-22',
    due: undefined,
    source: 'web',
    created: '2026-03-22T10:00:00.000Z',
    updated: '2026-03-22T10:00:00.000Z',
    approval_status: null,
    approval_operation: null,
    approval_action: null,
    approval_risk: null,
    approval_scope: null,
    privacy: 'private',
    encrypted: false,
    indexed_at: '2026-03-22T10:00:00.000Z',
    file_modified_at: '2026-03-22T10:00:00.000Z',
  };
}

function mountUseDimensionNotes(initialDimension: Dimension = 'life') {
  const dimension = ref<Dimension>(initialDimension);
  let state!: ReturnType<typeof useDimensionNotes>;
  const Harness = defineComponent({
    setup() {
      state = useDimensionNotes(dimension as Ref<Dimension>);
      return () => null;
    },
  });
  const wrapper = mount(Harness);
  return { state, wrapper, dimension };
}

describe('useDimensionNotes', () => {
  it('keeps the latest dimension notes when an older request resolves afterwards', async () => {
    const first = deferred<Note[]>();
    const second = deferred<Note[]>();
    apiMocks.fetchNotes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper, dimension } = mountUseDimensionNotes('life');
    await nextTick();

    dimension.value = 'growth';
    await nextTick();

    second.resolve([createNote('note-growth', 'growth')]);
    await nextTick();
    await second.promise;
    await nextTick();

    expect(state.notes.value.map((note) => note.id)).toEqual(['note-growth']);
    expect(state.loading.value).toBe(false);

    first.resolve([createNote('note-life', 'life')]);
    await first.promise;
    await nextTick();

    expect(state.notes.value.map((note) => note.id)).toEqual(['note-growth']);
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });

  it('ignores stale request errors after a newer dimension request succeeds', async () => {
    const first = deferred<Note[]>();
    const second = deferred<Note[]>();
    apiMocks.fetchNotes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper, dimension } = mountUseDimensionNotes('life');
    await nextTick();

    dimension.value = 'growth';
    await nextTick();

    second.resolve([createNote('note-growth', 'growth')]);
    await nextTick();
    await second.promise;
    await nextTick();

    first.reject(new Error('stale dimension failure'));
    await first.promise.catch(() => undefined);
    await nextTick();

    expect(state.notes.value.map((note) => note.id)).toEqual(['note-growth']);
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });
});
