import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Note, TimelineTrack as TimelineTrackContract } from '@lifeos/shared';
import TimelineTrack from './TimelineTrack.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'note-1.md',
    file_path: overrides.file_path ?? '/vault/健康/note-1.md',
    title: overrides.title ?? 'Note 1',
    content: overrides.content ?? 'content',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'health',
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

describe('TimelineTrack', () => {
  it('renders shared dimension labels and uses local date ticks', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-22T23:30:00'));

      const tracks: TimelineTrackContract[] = [
        { dimension: 'life', notes: [createNote({ id: 'note-life', dimension: 'life', date: '2026-03-22' })] },
        { dimension: 'growth', notes: [createNote({ id: 'note-growth', dimension: 'growth', date: '2026-03-23' })] },
      ];

      const wrapper = mount(TimelineTrack, {
        props: {
          tracks,
          startDate: '2026-03-22',
          endDate: '2026-03-23',
        },
        global: {
          stubs: {
            NotePreview: true,
            Teleport: true,
          },
        },
      });

      expect(wrapper.text()).toContain('生活');
      expect(wrapper.text()).toContain('成长');
      expect(wrapper.findAll('.ruler-cell.today')).toHaveLength(1);
      expect(wrapper.findAll('.ruler-cell.today')[0].text()).toContain('22');
    } finally {
      vi.useRealTimers();
    }
  });
});
