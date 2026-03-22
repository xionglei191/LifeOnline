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
    expect(load).toHaveBeenCalledWith('2026-03-01', '2026-03-31');

    vi.useRealTimers();
  });
});
