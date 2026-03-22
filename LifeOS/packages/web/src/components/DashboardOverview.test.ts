import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import type { DashboardData, ScheduleHealth } from '../api/client';

const composableMocks = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  fetchScheduleHealth: vi.fn(),
}));

vi.mock('../composables/useDashboard', () => ({
  useDashboard: composableMocks.useDashboard,
}));

vi.mock('../api/client', () => ({
  fetchScheduleHealth: apiMocks.fetchScheduleHealth,
}));

import { ref } from 'vue';
import DashboardOverview from './DashboardOverview.vue';

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
  it('refreshes schedule health together with dashboard refresh events', async () => {
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
          TodayTodos: {
            props: ['todos'],
            emits: ['selectNote', 'refresh'],
            template: '<button class="today-todos-refresh" @click="$emit(\'refresh\')">refresh</button>',
          },
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
    await wrapper.get('.today-todos-refresh').trigger('click');
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchScheduleHealth).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('1 个异常');
    expect(wrapper.text()).toContain('周报同步');
  });

  it('ignores stale schedule health responses after a newer refresh succeeds', async () => {
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
          TodayTodos: {
            props: ['todos'],
            emits: ['selectNote', 'refresh'],
            template: '<button class="today-todos-refresh" @click="$emit(\'refresh\')">refresh</button>',
          },
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
    await wrapper.get('.today-todos-refresh').trigger('click');
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
    expect(wrapper.text()).toContain('正在占据最高关注度');
    expect(wrapper.find('.signal-chip').attributes('style')).toContain('var(--dim-life)');
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
