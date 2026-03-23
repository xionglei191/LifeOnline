import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

const routeState = vi.hoisted(() => ({
  current: null as { params: { dimension: string } } | null,
}));

const apiMocks = vi.hoisted(() => ({
  fetchNotes: vi.fn(),
  fetchDashboard: vi.fn(),
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
  fetchDashboard: apiMocks.fetchDashboard,
}));

import DimensionView from './DimensionView.vue';

function buildWrapper() {
  return mount(DimensionView, {
    global: {
      stubs: {
        DimensionStats: {
          props: ['dimension', 'total', 'pending', 'inProgress', 'done', 'healthScore'],
          template: '<div class="dimension-stats-stub">{{ dimension }}:{{ total }}:{{ healthScore }}</div>',
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
    apiMocks.fetchDashboard.mockReset();
    apiMocks.fetchDashboard.mockResolvedValue({
      todayTodos: [],
      weeklyHighlights: [],
      inboxCount: 0,
      dimensionStats: [
        { dimension: 'life', total: 9, pending: 4, in_progress: 2, done: 3, health_score: 33 },
        { dimension: 'growth', total: 5, pending: 1, in_progress: 1, done: 3, health_score: 60 },
        { dimension: '_inbox', total: 1, pending: 1, in_progress: 0, done: 0, health_score: 0 },
      ],
    });
    routeState.current!.params.dimension = 'life';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('uses canonical dashboard dimension stats instead of rebuilding hero facts from the current note slice', async () => {
    routeState.current!.params.dimension = 'life';
    apiMocks.fetchNotes.mockResolvedValueOnce([
      { id: 'note-life', dimension: 'life', status: 'pending', type: 'note', date: '2026-03-22', file_name: 'life.md' },
    ]);

    wrapper = buildWrapper();
    await flushPromises();

    expect(apiMocks.fetchDashboard).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.dimension-stats-stub').text()).toContain('life:9:33');
    expect(wrapper.find('.note-list-stub').text()).toContain('note-life');
  });

  it('maps the inbox route to the canonical _inbox dimension', async () => {
    routeState.current!.params.dimension = undefined as unknown as string;
    apiMocks.fetchNotes.mockResolvedValueOnce([
      { id: 'inbox-note', dimension: '_inbox', status: 'pending', type: 'note', date: '2026-03-23', file_name: 'inbox.md' },
    ]);

    wrapper = buildWrapper();
    await flushPromises();

    expect(apiMocks.fetchNotes).toHaveBeenNthCalledWith(1, { dimension: '_inbox' });
    expect(wrapper.find('.dimension-stats-stub').text()).toContain('_inbox:1');
    expect(wrapper.find('.note-list-stub').text()).toContain('inbox-note');
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

    expect(wrapper.find('.dimension-stats-stub').text()).toContain('life:9');
    expect(wrapper.find('.note-list-stub').text()).toContain('note-life');
    expect(apiMocks.fetchNotes).toHaveBeenNthCalledWith(1, { dimension: 'life' });

    routeState.current!.params.dimension = 'growth';
    wrapper.unmount();
    wrapper = buildWrapper();
    await nextTick();
    await flushPromises();

    expect(apiMocks.fetchNotes).toHaveBeenNthCalledWith(2, { dimension: 'growth' });
    expect(wrapper.find('.dimension-stats-stub').text()).toContain('growth:5');
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
