import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type { CalendarData } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchCalendar: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchCalendar: apiMocks.fetchCalendar,
}));

vi.mock('./useWebSocket', () => ({
  isIndexRefreshEvent: vi.fn(() => true),
}));

import { useCalendar } from './useCalendar';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountUseCalendar() {
  let state!: ReturnType<typeof useCalendar>;
  const Harness = defineComponent({
    setup() {
      state = useCalendar();
      return () => null;
    },
  });
  const wrapper = mount(Harness);
  return { state, wrapper };
}

const marchData: CalendarData = {
  year: 2026,
  month: 3,
  days: [],
};

const aprilData: CalendarData = {
  year: 2026,
  month: 4,
  days: [],
};

describe('useCalendar', () => {
  it('keeps the latest month data when an older request resolves afterwards', async () => {
    const first = deferred<CalendarData>();
    const second = deferred<CalendarData>();
    apiMocks.fetchCalendar
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper } = mountUseCalendar();
    const firstLoad = state.load(2026, 3);
    const secondLoad = state.load(2026, 4);

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
    const first = deferred<CalendarData>();
    const second = deferred<CalendarData>();
    apiMocks.fetchCalendar
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { state, wrapper } = mountUseCalendar();
    const firstLoad = state.load(2026, 3);
    const secondLoad = state.load(2026, 4);

    second.resolve(aprilData);
    await secondLoad;
    await nextTick();

    first.reject(new Error('stale calendar failure'));
    await firstLoad;
    await nextTick();

    expect(state.data.value).toEqual(aprilData);
    expect(state.error.value).toBe(null);
    expect(state.loading.value).toBe(false);

    wrapper.unmount();
  });
});
