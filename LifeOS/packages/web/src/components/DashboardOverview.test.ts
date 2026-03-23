import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import type { DashboardData, ScheduleHealth } from '../api/client';

const composableMocks = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  fetchScheduleHealth: vi.fn(),
}));

vi.mock('../composables/useDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useDashboard')>();
  return {
    ...actual,
    useDashboard: composableMocks.useDashboard,
  };
});

vi.mock('../api/client', () => ({
  fetchScheduleHealth: apiMocks.fetchScheduleHealth,
}));

import DashboardOverview from './DashboardOverview.vue';

enableAutoUnmount(afterEach);

const dashboardData: DashboardData = {
  todayTodos: [],
  weeklyHighlights: [],
  inboxCount: 0,
  dimensionStats: [
    { dimension: 'life', total: 3, pending: 1, in_progress: 1, done: 1, health_score: 82 },
    { dimension: 'growth', total: 2, pending: 1, in_progress: 0, done: 1, health_score: 48 },
  ],
};

const scheduleHealth: ScheduleHealth = {
  total: 1,
  active: 1,
  failing: 0,
  failingSchedules: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('DashboardOverview', () => {
  beforeEach(() => {
    composableMocks.useDashboard.mockReset();
    apiMocks.fetchScheduleHealth.mockReset();
  });

  it('refreshes schedule health together with dashboard websocket refresh events', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load,
    });
    apiMocks.fetchScheduleHealth
      .mockResolvedValueOnce(scheduleHealth)
      .mockResolvedValueOnce({
        total: 2,
        active: 1,
        failing: 1,
        failingSchedules: [{ id: 'sched-1', label: '周报同步' }],
      });

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          TodayTodos: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-updated',
        data: { noteId: 'note-1' },
      },
    }));
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('1 个异常');
    expect(wrapper.text()).toContain('周报同步');
  });

  it('ignores stale schedule health responses after a newer websocket refresh succeeds', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load,
    });
    const initial = deferred<ScheduleHealth>();
    const refresh = deferred<ScheduleHealth>();
    apiMocks.fetchScheduleHealth
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(refresh.promise);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          TodayTodos: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await nextTick();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-updated',
        data: { noteId: 'note-1' },
      },
    }));
    await nextTick();

    refresh.resolve({
      total: 2,
      active: 1,
      failing: 1,
      failingSchedules: [{ id: 'sched-1', label: '最新周报同步' }],
    });
    await refresh.promise;
    await flushPromises();

    expect(wrapper.text()).toContain('最新周报同步');

    initial.resolve({
      total: 1,
      active: 1,
      failing: 0,
      failingSchedules: [],
    });
    await initial.promise;
    await flushPromises();

    expect(wrapper.text()).toContain('最新周报同步');
    expect(wrapper.text()).not.toContain('0 个异常');
  });

  it('reloads schedule health when note-created websocket updates arrive', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load,
    });
    apiMocks.fetchScheduleHealth
      .mockResolvedValueOnce(scheduleHealth)
      .mockResolvedValueOnce({
        total: 2,
        active: 1,
        failing: 1,
        failingSchedules: [{ id: 'sched-1', label: '新建笔记后周报同步' }],
      });

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          TodayTodos: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-created',
        data: { filePath: '/vault/成长/2026-03-23-note-new.md' },
      },
    }));
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('新建笔记后周报同步');
  });

  it('reloads schedule health when schedule websocket updates arrive without reloading dashboard data', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load,
    });
    apiMocks.fetchScheduleHealth
      .mockResolvedValueOnce(scheduleHealth)
      .mockResolvedValueOnce({
        total: 2,
        active: 1,
        failing: 1,
        failingSchedules: [{ id: 'sched-1', label: '周报同步' }],
      });

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          TodayTodos: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new CustomEvent('ws-update', { detail: { type: 'schedule-updated' } }));
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('1 个异常');
    expect(wrapper.text()).toContain('周报同步');
  });

  it('ignores non-dashboard websocket events', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load,
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    mount(DashboardOverview, {
      global: {
        stubs: {
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          TodayTodos: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new CustomEvent('ws-update', { detail: { type: 'soul-action-updated' } }));
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(1);
  });

  it('reloads dashboard-visible task state when note worker websocket updates arrive', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load,
    });
    apiMocks.fetchScheduleHealth
      .mockResolvedValueOnce(scheduleHealth)
      .mockResolvedValueOnce(scheduleHealth);

    mount(DashboardOverview, {
      global: {
        stubs: {
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          TodayTodos: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-worker-tasks-updated',
        data: {
          sourceNoteId: 'note-1.md',
          task: {
            id: 'worker-task-1',
            taskType: 'extract_tasks',
            worker: 'lifeos',
            status: 'pending',
            input: {},
            result: null,
            error: null,
            createdAt: '2026-03-23T10:00:00.000Z',
            updatedAt: '2026-03-23T10:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            sourceNoteId: 'note-1.md',
            scheduleId: null,
            outputNotePaths: [],
            outputNotes: [],
            resultSummary: null,
          },
        },
      },
    }));
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(2);
  });

  it('uses open work instead of health score for the hero attention summary', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref({
        ...dashboardData,
        dimensionStats: [
          { dimension: 'life', total: 6, pending: 0, in_progress: 0, done: 6, health_score: 88 },
          { dimension: 'growth', total: 5, pending: 2, in_progress: 2, done: 1, health_score: 42 },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('成长 是当前最需要投入的维度');
    expect(wrapper.text()).not.toContain('生活 是当前最需要投入的维度');
  });

  it('projects completion-rate and progress facts onto the hero signal band', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref({
        ...dashboardData,
        dimensionStats: [
          { dimension: 'life', total: 6, pending: 0, in_progress: 0, done: 6, health_score: 88 },
          { dimension: 'growth', total: 5, pending: 2, in_progress: 2, done: 1, health_score: 20 },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('完成率 88%');
    expect(wrapper.text()).toContain('完成率 20%');
    expect(wrapper.text()).toContain('活跃 4 项 · 完成 1/5');
  });

  it('labels the average completion and backlog metrics with the facts they actually represent', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref({
        ...dashboardData,
        dimensionStats: [
          { dimension: 'life', total: 6, pending: 0, in_progress: 0, done: 6, health_score: 88 },
          { dimension: 'growth', total: 5, pending: 2, in_progress: 2, done: 1, health_score: 42 },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('平均完成率');
    expect(wrapper.text()).toContain('65%');
    expect(wrapper.text()).toContain('生命信号 / 今日聚焦');
    expect(wrapper.text()).not.toContain('Life Signals / Today');
    expect(wrapper.text()).toContain('当前 2 个维度的平均完成进度');
    expect(wrapper.text()).not.toContain('八维度平均完成进度');
    expect(wrapper.text()).toContain('最高积压维度');
    expect(wrapper.text()).toContain('成长');
    expect(wrapper.text()).toContain('当前待处理工作最多的维度');
    expect(wrapper.text()).not.toContain('当前 open work 最多的维度');
    expect(wrapper.text()).not.toContain('系统健康');
    expect(wrapper.text()).not.toContain('失衡维度');
  });

  it('keeps the average completion copy aligned with the visible dashboard stat set', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref({
        ...dashboardData,
        inboxCount: 4,
        dimensionStats: [
          { dimension: 'life', total: 6, pending: 0, in_progress: 0, done: 6, health_score: 88 },
          { dimension: 'growth', total: 5, pending: 2, in_progress: 2, done: 1, health_score: 42 },
          { dimension: '_inbox', total: 4, pending: 4, in_progress: 0, done: 0, health_score: 0 },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('平均完成率');
    expect(wrapper.text()).toContain('65%');
    expect(wrapper.text()).toContain('当前 2 个维度的平均完成进度');
    expect(wrapper.text()).not.toContain('当前 3 个维度的平均完成进度');
    expect(wrapper.text()).not.toContain('八维度平均完成进度');
    expect(wrapper.find('.hero-summary').text()).not.toContain('_Inbox');
  });

  it('keeps the dashboard hero metrics scoped to the eight canonical dimensions even when _inbox stats exist', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref({
        ...dashboardData,
        inboxCount: 4,
        dimensionStats: [
          ...dashboardData.dimensionStats,
          { dimension: '_inbox', total: 4, pending: 4, in_progress: 0, done: 0, health_score: 0 },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('平均完成率');
    expect(wrapper.text()).toContain('65%');
    expect(wrapper.text()).toContain('生活 是当前最需要投入的维度');
    expect(wrapper.text()).toContain('最高积压维度');
    expect(wrapper.text()).toContain('生活');
    expect(wrapper.findAll('.signal-chip')).toHaveLength(2);
    expect(wrapper.find('.signal-band').text()).not.toContain('_Inbox');
    expect(wrapper.find('.hero-summary').text()).not.toContain('_Inbox');
  });

  it('renders dimension labels and colors from shared helpers on main dashboard paths', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('生活');
    expect(wrapper.text()).toContain('成长');
    expect(wrapper.text()).toContain('是当前最需要投入的维度');
    expect(wrapper.find('.signal-chip').attributes('style')).toContain('var(--dim-life)');
  });

  it('navigates the inbox banner to the dedicated inbox route', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref({ ...dashboardData, inboxCount: 2 }),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockResolvedValue(scheduleHealth);
    const push = vi.fn();

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push },
        },
      },
    });

    await flushPromises();

    await wrapper.get('.inbox-banner').trigger('click');
    expect(push).toHaveBeenCalledWith('/inbox');
  });

  it('renders the schedule health error state when the typed health fetch fails', async () => {
    composableMocks.useDashboard.mockReturnValue({
      data: ref(dashboardData),
      loading: ref(false),
      error: ref(null),
      load: vi.fn(),
    });
    apiMocks.fetchScheduleHealth.mockRejectedValue(new Error('schedule health unavailable'));

    const wrapper = mount(DashboardOverview, {
      global: {
        stubs: {
          TodayTodos: true,
          WeeklyHighlights: true,
          DimensionHealth: true,
          AISuggestions: true,
          NoteDetail: true,
          StateDisplay: {
            props: ['type', 'message'],
            template: '<div class="state-display-stub" :data-type="type">{{ message }}</div>',
          },
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('定时任务健康状态加载失败：schedule health unavailable');
    expect(wrapper.find('.state-display-stub').attributes('data-type')).toBe('error');
  });
});
