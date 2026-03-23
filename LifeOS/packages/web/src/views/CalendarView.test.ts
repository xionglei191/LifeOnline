import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { CalendarData } from '@lifeos/shared';

const composableMocks = vi.hoisted(() => ({
  useCalendar: vi.fn(),
}));

vi.mock('../composables/useCalendar', () => ({
  useCalendar: composableMocks.useCalendar,
}));

import CalendarView from './CalendarView.vue';

const calendarData: CalendarData = {
  year: 2026,
  month: 3,
  days: [
    {
      date: '2026-03-12',
      count: 1,
      notes: [
        {
          id: 'note-1',
          file_name: 'note-1.md',
          type: 'note',
          status: 'pending',
          title: 'note 1',
        } as any,
      ],
    },
  ],
};

describe('CalendarView', () => {
  it('uses local month bounds on the hero path', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T23:30:00'));

    const load = vi.fn();
    composableMocks.useCalendar.mockReturnValue({
      data: ref(calendarData),
      loading: ref(false),
      error: ref(null),
      selectedDay: ref(null),
      load,
    });

    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          CalendarGrid: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('2026年3月');
    expect(load).toHaveBeenCalledWith(2026, 3);

    vi.useRealTimers();
  });

  it('orders selected-day detail items by visible shared titles', async () => {
    const load = vi.fn();
    composableMocks.useCalendar.mockReturnValue({
      data: ref({
        year: 2026,
        month: 3,
        days: [
          {
            date: '2026-03-12',
            count: 2,
            notes: [
              { id: 'note-z', file_name: 'b-file.md', type: 'note', status: 'pending', title: 'Zeta title', content: 'z' },
              { id: 'note-a', file_name: 'z-file.md', type: 'note', status: 'pending', title: 'Alpha title', content: 'a' },
            ],
          },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      selectedDay: ref('2026-03-12'),
      load,
    });

    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          CalendarGrid: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    const titles = wrapper.findAll('.note-title').map((node) => node.text());
    expect(titles).toEqual(['Alpha title', 'Zeta title']);
  });

  it('hides protected content in selected-day detail cards while keeping public content visible', async () => {
    const load = vi.fn();
    composableMocks.useCalendar.mockReturnValue({
      data: ref({
        year: 2026,
        month: 3,
        days: [
          {
            date: '2026-03-12',
            count: 3,
            notes: [
              { id: 'note-private', file_name: 'private.md', type: 'note', status: 'pending', title: 'Private note', content: 'private body', privacy: 'private', encrypted: false },
              { id: 'note-encrypted', file_name: 'encrypted.md', type: 'note', status: 'pending', title: 'Encrypted note', content: 'encrypted body', privacy: 'public', encrypted: true },
              { id: 'note-public', file_name: 'public.md', type: 'note', status: 'pending', title: 'Public note', content: 'public body', privacy: 'public', encrypted: false },
            ],
          },
        ],
      }),
      loading: ref(false),
      error: ref(null),
      selectedDay: ref('2026-03-12'),
      load,
    });

    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          CalendarGrid: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('🔒 当前内容受隐私保护，预览已隐藏');
    expect(wrapper.text()).toContain('🔒 内容已加密，预览已隐藏');
    expect(wrapper.text()).toContain('public body');
    expect(wrapper.text()).not.toContain('private body');
    expect(wrapper.text()).not.toContain('encrypted body');
  });

  it('clears the selected note when the month window changes', async () => {
    const load = vi.fn();
    composableMocks.useCalendar.mockReturnValue({
      data: ref(calendarData),
      loading: ref(false),
      error: ref(null),
      selectedDay: ref('2026-03-12'),
      load,
    });

    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          CalendarGrid: {
            emits: ['selectDay', 'selectNote'],
            template: '<button class="calendar-grid-stub" @click="$emit(\'selectNote\', \'note-1\')"></button>',
          },
          NoteDetail: {
            props: ['noteId'],
            template: '<div class="note-detail-stub">{{ noteId ?? "none" }}</div>',
          },
          StateDisplay: true,
        },
      },
    });

    await flushPromises();

    await wrapper.get('.calendar-grid-stub').trigger('click');
    expect(wrapper.find('.note-detail-stub').text()).toBe('note-1');

    await wrapper.get('button:last-of-type').trigger('click');
    await flushPromises();

    expect(wrapper.find('.note-detail-stub').text()).toBe('none');
  });

  it('reloads the calendar when the month window changes instead of pinning the initial mount state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T23:30:00'));

    const load = vi.fn();
    composableMocks.useCalendar.mockReturnValue({
      data: ref(calendarData),
      loading: ref(false),
      error: ref(null),
      selectedDay: ref(null),
      load,
    });

    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          CalendarGrid: true,
          NoteDetail: true,
          StateDisplay: true,
        },
      },
    });

    await flushPromises();
    await wrapper.get('button:last-of-type').trigger('click');
    await flushPromises();
    await wrapper.get('button:first-of-type').trigger('click');
    await flushPromises();

    expect(load).toHaveBeenNthCalledWith(1, 2026, 3);
    expect(load).toHaveBeenNthCalledWith(2, 2026, 4);
    expect(load).toHaveBeenNthCalledWith(3, 2026, 3);

    vi.useRealTimers();
  });
});
