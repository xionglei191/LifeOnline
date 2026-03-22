import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type { TimelineData } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchTimeline: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchTimeline: apiMocks.fetchTimeline,
}));

vi.mock('./useWebSocket', () => ({
  isIndexRefreshEvent: vi.fn(() => true),
}));

import { useTimeline } from './useTimeline';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountUseTimeline() {
  let state!: ReturnType<typeof useTimeline>;
  const Harness = defineComponent({
    setup() {
      state = useTimeline();
      return () => null;
    },
  });
  const wrapper = mount(Harness);
  return { state, wrapper };
}

const marchData: TimelineData = {
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  tracks: [],
};

const aprilData: TimelineData = {
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  tracks: [],
};

describe('useTimeline', () => {
  it('keeps the latest window data when an older request resolves afterwards', async () => {
    const first = deferred<TimelineData>();
    const second = deferred<TimelineData>();
    apiMocks.fetchTimeline
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper } = mountUseTimeline();
    const firstLoad = state.load('2026-03-01', '2026-03-31');
    const secondLoad = state.load('2026-04-01', '2026-04-30');

    second.resolve(aprilData);
    await secondLoad;
    await nextTick();

    expect(state.data.value).toEqual(aprilData);
    expect(state.loading.value).toBe(false);

    first.resolve(marchData);
    await firstLoad;
    await nextTick();

    expect(state.data.value).toEqual(aprilData);
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });

  it('ignores stale request errors after a newer request succeeds', async () => {
    const first = deferred<TimelineData>();
    const second = deferred<TimelineData>();
    apiMocks.fetchTimeline
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper } = mountUseTimeline();
    const firstLoad = state.load('2026-03-01', '2026-03-31');
    const secondLoad = state.load('2026-04-01', '2026-04-30');

    second.resolve(aprilData);
    await secondLoad;
    await nextTick();

    first.reject(new Error('stale timeline failure'));
    await firstLoad;
    await nextTick();

    expect(state.data.value).toEqual(aprilData);
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });
});
