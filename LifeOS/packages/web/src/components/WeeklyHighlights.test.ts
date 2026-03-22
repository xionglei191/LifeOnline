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
});
