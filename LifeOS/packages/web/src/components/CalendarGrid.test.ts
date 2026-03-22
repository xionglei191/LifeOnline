import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { CalendarData } from '@lifeos/shared';
import CalendarGrid from './CalendarGrid.vue';

const calendarData: CalendarData = {
  year: 2026,
  month: 3,
  days: [
    { date: '2026-03-01', notes: [], count: 0 },
    { date: '2026-03-02', notes: [], count: 0 },
  ],
};

describe('CalendarGrid', () => {
  it('marks today using local date semantics for leading empty cells', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T23:30:00'));

    const wrapper = mount(CalendarGrid, {
      props: { calendarData },
      global: {
        stubs: {
          NotePreview: true,
        },
      },
    });

    const todayCells = wrapper.findAll('.calendar-cell.is-today');
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].text()).toContain('23');

    vi.useRealTimers();
  });
});
