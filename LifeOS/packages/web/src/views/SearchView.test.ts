import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';

const routeState = vi.hoisted(() => ({
  current: null as { query: { q?: string } } | null,
}));

const apiMocks = vi.hoisted(() => ({
  searchNotes: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue');
  routeState.current = reactive({
    query: { q: 'growth' as string | undefined },
  });
  return {
    useRoute: () => routeState.current,
  };
});

vi.mock('../api/client', () => ({
  searchNotes: apiMocks.searchNotes,
}));

import SearchView from './SearchView.vue';

function buildWrapper() {
  return mount(SearchView, {
    global: {
      stubs: {
        NoteList: {
          props: ['notes'],
          template: '<div class="note-list-stub">{{ notes.length }}</div>',
        },
        NoteDetail: true,
        StateDisplay: {
          props: ['type', 'message'],
          template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
        },
      },
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SearchView', () => {
  let wrapper: ReturnType<typeof buildWrapper> | null = null;

  beforeEach(() => {
    routeState.current!.query.q = 'growth';
    apiMocks.searchNotes.mockReset();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('surfaces typed search errors on the main search path', async () => {
    routeState.current!.query.q = 'growth';
    apiMocks.searchNotes.mockRejectedValue(new Error('search unavailable'));

    wrapper = buildWrapper();
    await flushPromises();

    expect(wrapper.text()).toContain('search unavailable');
    expect(wrapper.find('.state-display-stub').attributes('data-type')).toBe('error');
  });

  it('clears stale search results when the query disappears', async () => {
    apiMocks.searchNotes.mockResolvedValue({
      query: 'growth',
      total: 1,
      notes: [{ id: 'note-1' }],
    });

    wrapper = buildWrapper();
    await flushPromises();
    expect(wrapper.text()).toContain('找到 1 条关于 “growth” 的结果。');

    routeState.current!.query.q = undefined;
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).not.toContain('找到 1 条关于 “growth” 的结果。');
    expect(wrapper.find('.note-list-stub').exists()).toBe(false);
  });

  it('keeps the latest query result when an older search resolves afterwards', async () => {
    const first = deferred<{ query: string; total: number; notes: Array<{ id: string }> }>();
    const second = deferred<{ query: string; total: number; notes: Array<{ id: string }> }>();
    apiMocks.searchNotes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    wrapper = buildWrapper();
    await nextTick();

    routeState.current!.query.q = 'health';
    await nextTick();

    second.resolve({
      query: 'health',
      total: 1,
      notes: [{ id: 'note-health' }],
    });
    await second.promise;
    await flushPromises();
    await nextTick();

    expect(wrapper.text()).toContain('找到 1 条关于 “health” 的结果。');

    first.resolve({
      query: 'growth',
      total: 1,
      notes: [{ id: 'note-growth' }],
    });
    await first.promise;
    await flushPromises();

    expect(wrapper.text()).toContain('找到 1 条关于 “health” 的结果。');
    expect(wrapper.text()).not.toContain('找到 1 条关于 “growth” 的结果。');
  });

  it('ignores stale query errors after a newer search succeeds', async () => {
    const first = deferred<{ query: string; total: number; notes: Array<{ id: string }> }>();
    const second = deferred<{ query: string; total: number; notes: Array<{ id: string }> }>();
    routeState.current!.query.q = 'growth';
    apiMocks.searchNotes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    wrapper = buildWrapper();
    await nextTick();

    routeState.current!.query.q = 'health';
    await nextTick();

    second.resolve({
      query: 'health',
      total: 1,
      notes: [{ id: 'note-health' }],
    });
    await second.promise;
    await flushPromises();

    first.reject(new Error('stale search failure'));
    await first.promise.catch(() => undefined);
    await flushPromises();

    expect(wrapper.text()).toContain('找到 1 条关于 “health” 的结果。');
    expect(wrapper.text()).not.toContain('stale search failure');
    expect(wrapper.find('.state-display-stub').exists()).toBe(false);
  });
});
