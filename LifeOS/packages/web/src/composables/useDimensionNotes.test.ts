import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import type { Dimension, Note } from '@lifeos/shared';
import { parseLocalDate } from '../utils/date';

const apiMocks = vi.hoisted(() => ({
  fetchNotes: vi.fn(),
}));

const websocketMocks = vi.hoisted(() => ({
  isIndexRefreshEvent: vi.fn(() => false),
}));

vi.mock('../api/client', () => ({
  fetchNotes: apiMocks.fetchNotes,
}));

vi.mock('./useWebSocket', () => websocketMocks);

import { useDimensionNotes, doesDimensionNotesNeedRefresh } from './useDimensionNotes';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createNote(id: string, dimension: string, date = '2026-03-22'): Note {
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
    date,
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
  beforeEach(() => {
    apiMocks.fetchNotes.mockReset();
    websocketMocks.isIndexRefreshEvent.mockReset();
    websocketMocks.isIndexRefreshEvent.mockReturnValue(false);
  });

  it('refreshes on note-created and note-deleted websocket events for main dimension lists', () => {
    expect(doesDimensionNotesNeedRefresh({
      type: 'note-created',
      data: { filePath: '/vault/生活/2026-03-23-new-note.md' },
    })).toBe(true);

    expect(doesDimensionNotesNeedRefresh({
      type: 'note-deleted',
      data: { noteId: 'note-1.md', filePath: '/vault/生活/2026-03-23-old-note.md' },
    })).toBe(true);
  });

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

  it('matches keyword filters against shared note titles on the main dimension path', async () => {
    apiMocks.fetchNotes.mockResolvedValueOnce([
      { ...createNote('file-fallback', 'life'), title: 'Shared Title Match' },
      { ...createNote('other-note', 'life'), title: 'Other title' },
    ]);

    const { state, wrapper } = mountUseDimensionNotes('life');
    await nextTick();
    await nextTick();

    state.filters.value.keyword = 'title match';
    await nextTick();

    expect(state.filteredNotes.value.map((note) => note.id)).toEqual(['file-fallback']);

    wrapper.unmount();
  });

  it('sorts notes by local calendar date rather than UTC parsing', async () => {
    apiMocks.fetchNotes.mockResolvedValueOnce([
      createNote('late-march', 'life', '2026-03-31'),
      createNote('early-april', 'life', '2026-04-01'),
    ]);

    const { state, wrapper } = mountUseDimensionNotes('life');
    await nextTick();
    await nextTick();

    state.filters.value.sortOrder = 'asc';
    state.filters.value.sortBy = 'date';
    await nextTick();

    expect(state.filteredNotes.value.map((note) => note.id)).toEqual(['late-march', 'early-april']);
    const parsed = parseLocalDate(state.filteredNotes.value[0].date);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(31);

    wrapper.unmount();
  });

  it('uses visible shared titles as a stable tie-breaker on the main dimension list path', async () => {
    apiMocks.fetchNotes.mockResolvedValueOnce([
      createNote('note-z', 'life', '2026-03-31'),
      createNote('note-a', 'life', '2026-03-31'),
    ]);

    const { state, wrapper } = mountUseDimensionNotes('life');
    await nextTick();
    await nextTick();

    state.notes.value = [
      { ...state.notes.value[0], title: 'Zeta title', file_name: 'b-file.md' },
      { ...state.notes.value[1], title: 'Alpha title', file_name: 'z-file.md' },
    ];
    state.filters.value.sortOrder = 'asc';
    state.filters.value.sortBy = 'date';
    await nextTick();

    expect(state.filteredNotes.value.map((note) => note.title)).toEqual(['Alpha title', 'Zeta title']);

    wrapper.unmount();
  });

  it('reloads notes when websocket index refresh events arrive', async () => {
    websocketMocks.isIndexRefreshEvent.mockReturnValue(true);
    apiMocks.fetchNotes
      .mockResolvedValueOnce([createNote('note-life-1', 'life')])
      .mockResolvedValueOnce([{ ...createNote('note-life-2', 'life'), status: 'done' }]);

    const { state, wrapper } = mountUseDimensionNotes('life');
    await nextTick();
    await nextTick();

    expect(state.notes.value.map((note) => note.id)).toEqual(['note-life-1']);
    const beforeRefreshCalls = apiMocks.fetchNotes.mock.calls.length;

    document.dispatchEvent(new CustomEvent('ws-update', { detail: { type: 'index-complete' } }));
    await nextTick();
    await nextTick();

    expect(apiMocks.fetchNotes.mock.calls.length).toBe(beforeRefreshCalls + 1);
    expect(state.notes.value.map((note) => note.id)).toEqual(['note-life-2']);

    wrapper.unmount();
  });
});
