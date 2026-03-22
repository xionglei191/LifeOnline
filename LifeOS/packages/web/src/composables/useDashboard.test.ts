import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type { DashboardData } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchDashboard: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchDashboard: apiMocks.fetchDashboard,
}));

vi.mock('./useWebSocket', () => ({
  isIndexRefreshEvent: vi.fn(() => true),
}));

import { useDashboard } from './useDashboard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createDashboardData(inboxCount: number): DashboardData {
  return {
    todayTodos: [],
    weeklyHighlights: [],
    inboxCount,
    dimensionStats: [],
  };
}

function mountUseDashboard() {
  let state!: ReturnType<typeof useDashboard>;
  const Harness = defineComponent({
    setup() {
      state = useDashboard();
      return () => null;
    },
  });
  const wrapper = mount(Harness);
  return { state, wrapper };
}

describe('useDashboard', () => {
  it('keeps the latest dashboard data when an older reload resolves afterwards', async () => {
    const first = deferred<DashboardData>();
    const second = deferred<DashboardData>();
    apiMocks.fetchDashboard
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper } = mountUseDashboard();
    const firstLoad = state.load();
    const secondLoad = state.load();

    second.resolve(createDashboardData(5));
    await secondLoad;
    await nextTick();

    expect(state.data.value).toEqual(createDashboardData(5));
    expect(state.loading.value).toBe(false);

    first.resolve(createDashboardData(1));
    await firstLoad;
    await nextTick();

    expect(state.data.value).toEqual(createDashboardData(5));
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });

  it('ignores stale dashboard errors after a newer reload succeeds', async () => {
    const first = deferred<DashboardData>();
    const second = deferred<DashboardData>();
    apiMocks.fetchDashboard
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper } = mountUseDashboard();
    const firstLoad = state.load();
    const secondLoad = state.load();

    second.resolve(createDashboardData(7));
    await secondLoad;
    await nextTick();

    first.reject(new Error('stale dashboard failure'));
    await firstLoad;
    await nextTick();

    expect(state.data.value).toEqual(createDashboardData(7));
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });
});
