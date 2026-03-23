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

  it('renders the canonical trimmed search query from the shared response contract', async () => {
    routeState.current!.query.q = ' growth ';
    apiMocks.searchNotes.mockResolvedValue({
      query: 'growth',
      total: 1,
      filters: { q: 'growth' },
      notes: [{ id: 'note-growth' }],
    });

    wrapper = buildWrapper();
    await flushPromises();

    expect(apiMocks.searchNotes).toHaveBeenCalledWith(' growth ');
    expect(wrapper.text()).toContain('找到 1 条关于 “growth” 的结果。');
    expect(wrapper.text()).not.toContain('找到 1 条关于 “ growth ” 的结果。');
  });

  it('renders results returned for a query that matches a shared note title', async () => {
    routeState.current!.query.q = 'unique phrase';
    apiMocks.searchNotes.mockResolvedValue({
      query: 'unique phrase',
      total: 1,
      filters: { q: 'unique phrase' },
      notes: [{ id: 'note-title', title: 'Search title contract unique phrase' }],
    });

    wrapper = buildWrapper();
    await flushPromises();

    expect(apiMocks.searchNotes).toHaveBeenCalledWith('unique phrase');
    expect(wrapper.text()).toContain('找到 1 条关于 “unique phrase” 的结果。');
    expect(wrapper.find('.note-list-stub').text()).toBe('1');
  });

  it('reloads the current query when note-created websocket events arrive', async () => {
    apiMocks.searchNotes
      .mockResolvedValueOnce({
        query: 'growth',
        total: 1,
        filters: { q: 'growth' },
        notes: [{ id: 'note-growth' }],
      })
      .mockResolvedValueOnce({
        query: 'growth',
        total: 2,
        filters: { q: 'growth' },
        notes: [{ id: 'note-growth' }, { id: 'note-new' }],
      });

    wrapper = buildWrapper();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-created',
        data: { filePath: '/vault/成长/2026-03-23-note-new.md' },
      },
    }));
    await flushPromises();

    expect(apiMocks.searchNotes).toHaveBeenNthCalledWith(1, 'growth');
    expect(apiMocks.searchNotes).toHaveBeenNthCalledWith(2, 'growth');
    expect(wrapper.text()).toContain('找到 2 条关于 “growth” 的结果。');
  });

  it('reloads the current query when index refresh events arrive', async () => {
    apiMocks.searchNotes
      .mockResolvedValueOnce({
        query: 'growth',
        total: 1,
        filters: { q: 'growth' },
        notes: [{ id: 'note-growth' }],
      })
      .mockResolvedValueOnce({
        query: 'growth',
        total: 2,
        filters: { q: 'growth' },
        notes: [{ id: 'note-growth' }, { id: 'note-health' }],
      });

    wrapper = buildWrapper();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'index-complete' },
    }));
    await flushPromises();

    expect(apiMocks.searchNotes).toHaveBeenNthCalledWith(1, 'growth');
    expect(apiMocks.searchNotes).toHaveBeenNthCalledWith(2, 'growth');
    expect(wrapper.text()).toContain('找到 2 条关于 “growth” 的结果。');
    expect(wrapper.find('.note-list-stub').text()).toBe('2');
  });

  it('surfaces typed search errors on the main search path', async () => {
    routeState.current!.query.q = 'growth';
    apiMocks.searchNotes.mockRejectedValue(new Error('search unavailable'));

    wrapper = buildWrapper();
    await flushPromises();

    expect(wrapper.text()).toContain('search unavailable');
    expect(wrapper.find('.state-display-stub').attributes('data-type')).toBe('error');
  });

  it('clears the selected note when the search query changes', async () => {
    apiMocks.searchNotes
      .mockResolvedValueOnce({
        query: 'growth',
        total: 1,
        filters: { q: 'growth' },
        notes: [{ id: 'note-growth' }],
      })
      .mockResolvedValueOnce({
        query: 'health',
        total: 1,
        filters: { q: 'health' },
        notes: [{ id: 'note-health' }],
      });

    wrapper = mount(SearchView, {
      global: {
        stubs: {
          NoteList: {
            props: ['notes'],
            emits: ['selectNote'],
            template: '<button class="note-list-stub" @click="$emit(\'selectNote\', notes[0].id)">{{ notes.length }}</button>',
          },
          NoteDetail: {
            props: ['noteId'],
            template: '<div class="note-detail-stub">{{ noteId ?? "none" }}</div>',
          },
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
        },
      },
    });
    await flushPromises();

    await wrapper.get('.note-list-stub').trigger('click');
    await nextTick();
    expect(wrapper.find('.note-detail-stub').text()).toBe('note-growth');

    routeState.current!.query.q = 'health';
    await nextTick();
    expect(wrapper.find('.note-detail-stub').text()).toBe('none');

    await flushPromises();
    expect(wrapper.text()).toContain('找到 1 条关于 “health” 的结果。');
  });

  it('clears stale search results when the query disappears', async () => {
    apiMocks.searchNotes.mockResolvedValue({
      query: 'growth',
      total: 1,
      filters: { q: 'growth' },
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
    const first = deferred<{ query: string; total: number; filters: { q: string }; notes: Array<{ id: string }> }>();
    const second = deferred<{ query: string; total: number; filters: { q: string }; notes: Array<{ id: string }> }>();
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
      filters: { q: 'health' },
      notes: [{ id: 'note-health' }],
    });
    await second.promise;
    await flushPromises();
    await nextTick();

    expect(wrapper.text()).toContain('找到 1 条关于 “health” 的结果。');

    first.resolve({
      query: 'growth',
      total: 1,
      filters: { q: 'growth' },
      notes: [{ id: 'note-growth' }],
    });
    await first.promise;
    await flushPromises();

    expect(wrapper.text()).toContain('找到 1 条关于 “health” 的结果。');
    expect(wrapper.text()).not.toContain('找到 1 条关于 “growth” 的结果。');
  });

  it('ignores stale query errors after a newer search succeeds', async () => {
    const first = deferred<{ query: string; total: number; filters: { q: string }; notes: Array<{ id: string }> }>();
    const second = deferred<{ query: string; total: number; filters: { q: string }; notes: Array<{ id: string }> }>();
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
      filters: { q: 'health' },
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
