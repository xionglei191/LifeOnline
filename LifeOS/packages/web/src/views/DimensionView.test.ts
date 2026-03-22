import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

const routeState = vi.hoisted(() => ({
  current: null as { params: { dimension: string } } | null,
}));

const apiMocks = vi.hoisted(() => ({
  fetchNotes: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue');
  routeState.current = reactive({
    params: { dimension: 'life' },
  });
  return {
    useRoute: () => routeState.current,
  };
});

vi.mock('../api/client', () => ({
  fetchNotes: apiMocks.fetchNotes,
}));

import DimensionView from './DimensionView.vue';

function buildWrapper() {
  return mount(DimensionView, {
    global: {
      stubs: {
        DimensionStats: {
          props: ['dimension', 'total', 'pending', 'inProgress', 'done'],
          template: '<div class="dimension-stats-stub">{{ dimension }}:{{ total }}</div>',
        },
        DimensionCharts: true,
        FilterBar: true,
        NoteList: {
          props: ['notes'],
          computed: {
            noteIds() {
              return this.notes.map((note: { id: string }) => note.id).join(',');
            },
          },
          template: '<div class="note-list-stub">{{ noteIds }}</div>',
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

describe('DimensionView', () => {
  let wrapper: VueWrapper<any> | null = null;

  beforeEach(() => {
    apiMocks.fetchNotes.mockReset();
    routeState.current!.params.dimension = 'life';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('surfaces typed note-fetch errors on the main dimension path', async () => {
    routeState.current!.params.dimension = 'life';
    apiMocks.fetchNotes.mockRejectedValue(new Error('dimension unavailable'));

    wrapper = buildWrapper();
    await flushPromises();

    expect(wrapper.text()).toContain('dimension unavailable');
    expect(wrapper.find('.state-display-stub').attributes('data-type')).toBe('error');
  });

  it('reloads notes when the route dimension changes', async () => {
    routeState.current!.params.dimension = 'life';
    apiMocks.fetchNotes
      .mockResolvedValueOnce([{ id: 'note-life', dimension: 'life', status: 'pending', type: 'note', date: '2026-03-22', file_name: 'life.md' }])
      .mockResolvedValueOnce([{ id: 'note-growth', dimension: 'growth', status: 'done', type: 'note', date: '2026-03-23', file_name: 'growth.md' }]);

    wrapper = buildWrapper();
    await flushPromises();

    expect(wrapper.find('.dimension-stats-stub').text()).toContain('life:1');
    expect(wrapper.find('.note-list-stub').text()).toContain('note-life');
    expect(apiMocks.fetchNotes).toHaveBeenNthCalledWith(1, { dimension: 'life' });

    routeState.current!.params.dimension = 'growth';
    wrapper.unmount();
    wrapper = buildWrapper();
    await nextTick();
    await flushPromises();

    expect(apiMocks.fetchNotes).toHaveBeenNthCalledWith(2, { dimension: 'growth' });
    expect(wrapper.find('.dimension-stats-stub').text()).toContain('growth:1');
    expect(wrapper.find('.note-list-stub').text()).toContain('note-growth');
  });

  it('reloads notes when websocket index refresh events arrive', async () => {
    routeState.current!.params.dimension = 'life';
    apiMocks.fetchNotes
      .mockResolvedValueOnce([{ id: 'note-life-1', dimension: 'life', status: 'pending', type: 'note', date: '2026-03-22', file_name: 'life-1.md' }])
      .mockResolvedValueOnce([{ id: 'note-life-2', dimension: 'life', status: 'done', type: 'note', date: '2026-03-23', file_name: 'life-2.md' }]);

    wrapper = buildWrapper();
    await flushPromises();

    expect(wrapper.find('.note-list-stub').text()).toContain('note-life-1');
    expect(apiMocks.fetchNotes).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new CustomEvent('ws-update', { detail: { type: 'index-complete' } }));
    await flushPromises();

    expect(apiMocks.fetchNotes).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.note-list-stub').text()).toContain('note-life-2');
  });
});
