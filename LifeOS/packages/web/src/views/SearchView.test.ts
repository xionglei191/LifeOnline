import { describe, expect, it, vi } from 'vitest';
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

describe('SearchView', () => {
  it('surfaces typed search errors on the main search path', async () => {
    routeState.current!.query.q = 'growth';
    apiMocks.searchNotes.mockRejectedValue(new Error('search unavailable'));

    const wrapper = buildWrapper();
    await flushPromises();

    expect(wrapper.text()).toContain('search unavailable');
    expect(wrapper.find('.state-display-stub').attributes('data-type')).toBe('error');
  });

  it('clears stale search results when the query disappears', async () => {
    routeState.current!.query.q = 'growth';
    apiMocks.searchNotes.mockResolvedValue({
      query: 'growth',
      total: 1,
      notes: [{ id: 'note-1' }],
    });

    const wrapper = buildWrapper();
    await flushPromises();
    expect(wrapper.text()).toContain('找到 1 条关于 “growth” 的结果。');

    routeState.current!.query.q = undefined;
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).not.toContain('找到 1 条关于 “growth” 的结果。');
    expect(wrapper.find('.note-list-stub').exists()).toBe(false);
  });
});
