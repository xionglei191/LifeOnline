import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { TimelineData } from '@lifeos/shared';

const composableMocks = vi.hoisted(() => ({
  useTimeline: vi.fn(),
}));

vi.mock('../composables/useTimeline', () => ({
  useTimeline: composableMocks.useTimeline,
}));

import TimelineView from './TimelineView.vue';

const timelineData: TimelineData = {
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  tracks: [
    { dimension: 'life', notes: [{ id: 'n1' }] as any[] },
    { dimension: 'growth', notes: [] as any[] },
  ],
};

describe('TimelineView', () => {
  it('uses local month bounds and shared dimension labels on the hero path', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T23:30:00'));

    const load = vi.fn();
    composableMocks.useTimeline.mockReturnValue({
      data: ref(timelineData),
      loading: ref(false),
      error: ref(null),
      load,
    });

    const wrapper = mount(TimelineView, {
      global: {
        stubs: {
          TimelineTrack: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    const dateInputs = wrapper.findAll('input[type="date"]');
    expect((dateInputs[0].element as HTMLInputElement).value).toBe('2026-03-01');
    expect((dateInputs[1].element as HTMLInputElement).value).toBe('2026-03-31');
    expect(wrapper.text()).toContain('生活');
    expect(wrapper.find('.hero-summary').text()).toContain('31 天');
    expect(load).toHaveBeenCalledWith('2026-03-01', '2026-03-31');

    vi.useRealTimers();
  });

  it('projects timeline density facts instead of generic track activity copy on the hero path', async () => {
    const load = vi.fn();
    composableMocks.useTimeline.mockReturnValue({
      data: ref({
        ...timelineData,
        tracks: [
          { dimension: 'life', notes: [{ id: 'n1' }, { id: 'n2' }] as any[] },
          { dimension: 'growth', notes: [{ id: 'n3' }] as any[] },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      load,
    });

    const wrapper = mount(TimelineView, {
      global: {
        stubs: {
          TimelineTrack: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('记录最密集维度');
    expect(wrapper.text()).toContain('生活 有 2 条记录，是这段时间记录最密集的维度');
    expect(wrapper.text()).toContain('当前视图覆盖天数');
    expect(wrapper.text()).toContain('窗口内检索到的记录');
    expect(wrapper.text()).not.toContain('days in view');
    expect(wrapper.text()).not.toContain('tracked notes');
    expect(wrapper.text()).not.toContain('items');
  });

  it('reloads the timeline when the window changes instead of pinning the initial mount state', async () => {
    const load = vi.fn();
    composableMocks.useTimeline.mockReturnValue({
      data: ref(timelineData),
      loading: ref(false),
      error: ref(null),
      load,
    });

    const wrapper = mount(TimelineView, {
      global: {
        stubs: {
          TimelineTrack: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    const dateInputs = wrapper.findAll('input[type="date"]');
    await dateInputs[0].setValue('2026-03-05');
    await dateInputs[1].setValue('2026-03-20');
    await flushPromises();

    expect(load).toHaveBeenNthCalledWith(1, '2026-03-01', '2026-03-31');
    expect(load).toHaveBeenNthCalledWith(2, '2026-03-05', '2026-03-31');
    expect(load).toHaveBeenNthCalledWith(3, '2026-03-05', '2026-03-20');
  });
});
