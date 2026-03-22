import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { CalendarData, Note } from '@lifeos/shared';
import CalendarGrid from './CalendarGrid.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'note-1.md',
    file_path: overrides.file_path ?? '/vault/成长/note-1.md',
    title: overrides.title ?? 'Note 1',
    content: overrides.content ?? 'content',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'growth',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'medium',
    tags: overrides.tags ?? [],
    date: overrides.date ?? '2026-03-22',
    due: overrides.due ?? undefined,
    source: overrides.source ?? 'web',
    created: overrides.created ?? '2026-03-22T10:00:00.000Z',
    updated: overrides.updated ?? '2026-03-22T10:00:00.000Z',
    approval_status: overrides.approval_status ?? null,
    approval_operation: overrides.approval_operation ?? null,
    approval_action: overrides.approval_action ?? null,
    approval_risk: overrides.approval_risk ?? null,
    approval_scope: overrides.approval_scope ?? null,
    privacy: overrides.privacy ?? 'private',
    encrypted: overrides.encrypted ?? false,
    indexed_at: overrides.indexed_at ?? '2026-03-22T10:00:00.000Z',
    file_modified_at: overrides.file_modified_at ?? '2026-03-22T10:00:00.000Z',
  };
}

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

  it('orders calendar hover previews by the shared grid/detail note ordering', async () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        calendarData: {
          year: 2026,
          month: 3,
          days: [
            {
              date: '2026-03-02',
              count: 3,
              notes: [
                createNote({ id: 'note-z', date: '2026-03-02', title: 'Zeta title', file_name: 'b-file.md', type: 'note', status: 'pending' }),
                createNote({ id: 'task-a', date: '2026-03-02', title: 'Alpha task', file_name: 'z-task.md', type: 'task', status: 'pending' }),
                createNote({ id: 'schedule-b', date: '2026-03-02', title: 'Beta schedule', file_name: 'y-schedule.md', type: 'schedule', status: 'pending' }),
              ],
            },
          ],
        },
      },
      global: {
        stubs: {
          NotePreview: false,
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    await wrapper.get('.calendar-cell.has-notes').trigger('mouseenter', { clientX: 80, clientY: 80 });
    await nextTick();

    const previewTitles = Array.from(document.body.querySelectorAll('.multi-title')).map((node) => node.textContent?.trim());
    expect(previewTitles).toEqual(['Beta schedule', 'Alpha task', 'Zeta title']);

    wrapper.unmount();
  });
});

