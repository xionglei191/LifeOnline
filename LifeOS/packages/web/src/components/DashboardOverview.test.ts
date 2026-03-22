import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
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

describe('DashboardOverview', () => {
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
          StateDisplay: true,
          RouterLink: true,
        },
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    });

    await Promise.resolve();

    expect(wrapper.text()).toContain('生活');
    expect(wrapper.text()).toContain('成长');
    expect(wrapper.text()).toContain('正在占据最高关注度');
    expect(wrapper.find('.signal-chip').attributes('style')).toContain('var(--dim-life)');
  });
});
