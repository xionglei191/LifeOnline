import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';

const apiMocks = vi.hoisted(() => ({
  fetchStatsTrend: vi.fn(),
  fetchStatsRadar: vi.fn(),
  fetchStatsMonthly: vi.fn(),
  fetchStatsTags: vi.fn(),
}));

const chartMocks = vi.hoisted(() => {
  const instances = Array.from({ length: 4 }, () => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }));

  return {
    init: vi.fn()
      .mockImplementationOnce(() => instances[0])
      .mockImplementationOnce(() => instances[1])
      .mockImplementationOnce(() => instances[2])
      .mockImplementationOnce(() => instances[3]),
    instances,
  };
});

vi.mock('../api/client', () => ({
  fetchStatsTrend: apiMocks.fetchStatsTrend,
  fetchStatsRadar: apiMocks.fetchStatsRadar,
  fetchStatsMonthly: apiMocks.fetchStatsMonthly,
  fetchStatsTags: apiMocks.fetchStatsTags,
}));

vi.mock('../lib/echarts', () => ({
  echarts: {
    init: chartMocks.init,
  },
}));

import StatsView from './StatsView.vue';

function buildWrapper() {
  return mount(StatsView, {
    attachTo: document.body,
    global: {
      stubs: {
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

describe('StatsView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMocks.fetchStatsTrend.mockReset();
    apiMocks.fetchStatsRadar.mockReset();
    apiMocks.fetchStatsMonthly.mockReset();
    apiMocks.fetchStatsTags.mockReset();
    chartMocks.init.mockReset()
      .mockImplementationOnce(() => chartMocks.instances[0])
      .mockImplementationOnce(() => chartMocks.instances[1])
      .mockImplementationOnce(() => chartMocks.instances[2])
      .mockImplementationOnce(() => chartMocks.instances[3]);
    chartMocks.instances.forEach((instance) => {
      instance.setOption.mockClear();
      instance.resize.mockClear();
      instance.dispose.mockClear();
    });
  });

  it('reloads all stats panels when note-created websocket events arrive', async () => {
    apiMocks.fetchStatsTrend
      .mockResolvedValueOnce([{ day: '2026-03-01', total: 2, done: 1 }])
      .mockResolvedValueOnce([{ day: '2026-03-02', total: 4, done: 3 }]);
    apiMocks.fetchStatsRadar
      .mockResolvedValueOnce([{ dimension: 'life', rate: 80 }])
      .mockResolvedValueOnce([{ dimension: 'growth', rate: 65 }]);
    apiMocks.fetchStatsMonthly
      .mockResolvedValueOnce([{ month: '2026-03', total: 8, done: 5 }])
      .mockResolvedValueOnce([{ month: '2026-04', total: 10, done: 7 }]);
    apiMocks.fetchStatsTags
      .mockResolvedValueOnce([{ tag: 'focus', count: 3 }])
      .mockResolvedValueOnce([{ tag: 'health', count: 5 }]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-created',
        data: { filePath: '/vault/成长/2026-03-23-note-new.md' },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchStatsTrend).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsRadar).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsMonthly).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsTags).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('reloads all stats panels when index refresh events arrive', async () => {
    apiMocks.fetchStatsTrend
      .mockResolvedValueOnce([{ day: '2026-03-01', total: 2, done: 1 }])
      .mockResolvedValueOnce([{ day: '2026-03-02', total: 4, done: 3 }]);
    apiMocks.fetchStatsRadar
      .mockResolvedValueOnce([{ dimension: 'life', rate: 80 }])
      .mockResolvedValueOnce([{ dimension: 'growth', rate: 65 }]);
    apiMocks.fetchStatsMonthly
      .mockResolvedValueOnce([{ month: '2026-03', total: 8, done: 5 }])
      .mockResolvedValueOnce([{ month: '2026-04', total: 10, done: 7 }]);
    apiMocks.fetchStatsTags
      .mockResolvedValueOnce([{ tag: 'focus', count: 3 }])
      .mockResolvedValueOnce([{ tag: 'health', count: 5 }]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-created',
        data: { filePath: '/vault/成长/2026-03-23-note-new.md' },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchStatsTrend).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsRadar).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsMonthly).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsTags).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('reloads all stats panels when index refresh events arrive', async () => {
    apiMocks.fetchStatsTrend
      .mockResolvedValueOnce([{ day: '2026-03-01', total: 2, done: 1 }])
      .mockResolvedValueOnce([{ day: '2026-03-02', total: 4, done: 3 }]);
    apiMocks.fetchStatsRadar
      .mockResolvedValueOnce([{ dimension: 'life', rate: 80 }])
      .mockResolvedValueOnce([{ dimension: 'growth', rate: 65 }]);
    apiMocks.fetchStatsMonthly
      .mockResolvedValueOnce([{ month: '2026-03', total: 8, done: 5 }])
      .mockResolvedValueOnce([{ month: '2026-04', total: 10, done: 7 }]);
    apiMocks.fetchStatsTags
      .mockResolvedValueOnce([{ tag: 'focus', count: 3 }])
      .mockResolvedValueOnce([{ tag: 'health', count: 5 }]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'index-complete' },
    }));
    await flushPromises();

    expect(apiMocks.fetchStatsTrend).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsRadar).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsMonthly).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchStatsTags).toHaveBeenCalledTimes(2);

    const trendChart = chartMocks.instances[0];
    const radarChart = chartMocks.instances[1];
    const monthlyChart = chartMocks.instances[2];
    const tagsChart = chartMocks.instances[3];

    expect(trendChart.setOption.mock.calls.at(-1)?.[0]?.xAxis?.data).toEqual(['03-02']);
    expect(radarChart.setOption.mock.calls.at(-1)?.[0]?.radar?.indicator).toEqual([{ name: '成长', max: 100 }]);
    expect(monthlyChart.setOption.mock.calls.at(-1)?.[0]?.xAxis?.data).toEqual(['2026-04']);
    expect(tagsChart.setOption.mock.calls.at(-1)?.[0]?.yAxis?.data).toEqual(['health']);

    wrapper.unmount();
  });

  it('surfaces typed API errors instead of rendering empty charts', async () => {
    apiMocks.fetchStatsTrend.mockRejectedValue(new Error('trend unavailable'));
    apiMocks.fetchStatsRadar.mockResolvedValue([]);
    apiMocks.fetchStatsMonthly.mockResolvedValue([]);
    apiMocks.fetchStatsTags.mockResolvedValue([]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    expect(wrapper.text()).toContain('trend unavailable');
    expect(wrapper.find('.state-display-stub').attributes('data-type')).toBe('error');
    expect(chartMocks.instances[0].setOption).not.toHaveBeenCalled();
  });

  it('reloads the trend panel when the window changes and keeps the other panels intact', async () => {
    apiMocks.fetchStatsTrend
      .mockResolvedValueOnce([
        { day: '2026-03-01', total: 2, done: 1 },
        { day: '2026-03-02', total: 3, done: 2 },
      ])
      .mockResolvedValueOnce([
        { day: '2026-03-01', total: 4, done: 3 },
      ]);
    apiMocks.fetchStatsRadar.mockResolvedValue([{ dimension: 'life', rate: 80 }]);
    apiMocks.fetchStatsMonthly.mockResolvedValue([{ month: '2026-03', total: 8, done: 5 }]);
    apiMocks.fetchStatsTags.mockResolvedValue([{ tag: 'focus', count: 3 }]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    const buttons = wrapper.findAll('.day-btn');
    await buttons[0].trigger('click');
    await flushPromises();

    expect(apiMocks.fetchStatsTrend).toHaveBeenNthCalledWith(1, 30);
    expect(apiMocks.fetchStatsTrend).toHaveBeenNthCalledWith(2, 7);
    expect(apiMocks.fetchStatsRadar).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchStatsMonthly).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchStatsTags).toHaveBeenCalledTimes(1);
  });

  it('ignores stale trend responses after switching to a newer window', async () => {
    const firstRefresh = deferred<Array<{ day: string; total: number; done: number }>>();
    const secondRefresh = deferred<Array<{ day: string; total: number; done: number }>>();
    apiMocks.fetchStatsTrend
      .mockResolvedValueOnce([
        { day: '2026-03-01', total: 2, done: 1 },
      ])
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise);
    apiMocks.fetchStatsRadar.mockResolvedValue([{ dimension: 'life', rate: 80 }]);
    apiMocks.fetchStatsMonthly.mockResolvedValue([{ month: '2026-03', total: 8, done: 5 }]);
    apiMocks.fetchStatsTags.mockResolvedValue([{ tag: 'focus', count: 3 }]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    const buttons = wrapper.findAll('.day-btn');
    await buttons[0].trigger('click');
    await nextTick();
    await buttons[2].trigger('click');
    await nextTick();

    secondRefresh.resolve([
      { day: '2026-01-01', total: 9, done: 7 },
      { day: '2026-01-02', total: 6, done: 5 },
    ]);
    await secondRefresh.promise;
    await flushPromises();

    const trendChart = chartMocks.instances[0];
    const latestTrend = trendChart.setOption.mock.calls.at(-1)?.[0];
    expect(latestTrend?.xAxis?.data).toEqual(['01-01', '01-02']);
    expect(latestTrend?.series?.[0]?.data).toEqual([9, 6]);

    firstRefresh.resolve([
      { day: '2026-03-21', total: 1, done: 1 },
    ]);
    await firstRefresh.promise;
    await flushPromises();

    const finalTrend = trendChart.setOption.mock.calls.at(-1)?.[0];
    expect(finalTrend?.xAxis?.data).toEqual(['01-01', '01-02']);
    expect(finalTrend?.series?.[0]?.data).toEqual([9, 6]);
  });

  it('ignores stale trend errors after switching to a newer window', async () => {
    const firstRefresh = deferred<Array<{ day: string; total: number; done: number }>>();
    const secondRefresh = deferred<Array<{ day: string; total: number; done: number }>>();
    apiMocks.fetchStatsTrend
      .mockResolvedValueOnce([
        { day: '2026-03-01', total: 2, done: 1 },
      ])
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise);
    apiMocks.fetchStatsRadar.mockResolvedValue([{ dimension: 'life', rate: 80 }]);
    apiMocks.fetchStatsMonthly.mockResolvedValue([{ month: '2026-03', total: 8, done: 5 }]);
    apiMocks.fetchStatsTags.mockResolvedValue([{ tag: 'focus', count: 3 }]);

    const wrapper = buildWrapper();

    await vi.runAllTimersAsync();
    await flushPromises();

    const buttons = wrapper.findAll('.day-btn');
    await buttons[0].trigger('click');
    await nextTick();
    await buttons[2].trigger('click');
    await nextTick();

    secondRefresh.resolve([
      { day: '2026-01-01', total: 11, done: 10 },
    ]);
    await secondRefresh.promise;
    await flushPromises();

    firstRefresh.reject(new Error('stale trend failure'));
    await firstRefresh.promise.catch(() => undefined);
    await flushPromises();

    const trendChart = chartMocks.instances[0];
    const finalTrend = trendChart.setOption.mock.calls.at(-1)?.[0];
    expect(finalTrend?.xAxis?.data).toEqual(['01-01']);
    expect(finalTrend?.series?.[0]?.data).toEqual([11]);
    expect(wrapper.text()).not.toContain('stale trend failure');
    expect(wrapper.find('.state-display-stub').exists()).toBe(false);
  });
});
