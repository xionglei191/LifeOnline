import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Note } from '@lifeos/shared';
import WeeklyHighlights from './WeeklyHighlights.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'highlight-1.md',
    file_path: overrides.file_path ?? '/vault/生活/highlight-1.md',
    title: overrides.title ?? 'Highlight 1',
    content: overrides.content ?? 'highlight content',
    type: overrides.type ?? 'task',
    dimension: overrides.dimension ?? 'life',
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

describe('WeeklyHighlights', () => {
  it('localizes the weekly highlight header copy and badge', () => {
    const wrapper = mount(WeeklyHighlights, {
      props: {
        highlights: [createNote()],
      },
    });

    expect(wrapper.text()).toContain('本周重点');
    expect(wrapper.text()).toContain('周节律');
    expect(wrapper.text()).not.toContain('Priority Watch');
    expect(wrapper.text()).not.toContain('Week Pulse');
  });

  it('renders dimension labels and colors from shared helpers', () => {
    const wrapper = mount(WeeklyHighlights, {
      props: {
        highlights: [
          createNote({ id: 'life-highlight', dimension: 'life' }),
          createNote({ id: 'inbox-highlight', dimension: '_inbox', file_name: 'inbox.md' }),
        ],
      },
    });

    expect(wrapper.text()).toContain('生活');
    expect(wrapper.text()).toContain('Inbox');
    expect(wrapper.find('.dimension').attributes('style')).toContain('var(--dim-life)');
  });

  it('renders shared priority and due facts on highlight cards', () => {
    const wrapper = mount(WeeklyHighlights, {
      props: {
        highlights: [
          createNote({
            id: 'highlight-priority',
            priority: 'high',
            due: '2026-03-25',
            status: 'in_progress',
          }),
        ],
      },
    });

    expect(wrapper.text()).toContain('高优先级');
    expect(wrapper.text()).toContain('截止 03/25');
    expect(wrapper.text()).toContain('推进中');
  });

  it('orders same-day highlights by visible shared titles', () => {
    const wrapper = mount(WeeklyHighlights, {
      props: {
        highlights: [
          createNote({ id: 'highlight-z', date: '2026-03-22', title: 'Zeta title', file_name: 'b-file.md' }),
          createNote({ id: 'highlight-a', date: '2026-03-22', title: 'Alpha title', file_name: 'z-file.md' }),
        ],
      },
    });

    const titles = wrapper.findAll('.title').map((node) => node.text());
    expect(titles).toEqual(['Alpha title', 'Zeta title']);
  });
});
