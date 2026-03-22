import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Note } from '@lifeos/shared';
import NotePreview from './NotePreview.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'preview-1.md',
    file_path: overrides.file_path ?? '/vault/生活/preview-1.md',
    title: overrides.title ?? 'Preview 1',
    content: overrides.content ?? 'preview content',
    type: overrides.type ?? 'note',
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

describe('NotePreview', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders dimension labels from shared helpers in the single-note preview', () => {
    const wrapper = mount(NotePreview, {
      props: {
        note: createNote({ dimension: 'growth', file_name: 'growth-preview.md' }),
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('成长');
    expect(document.body.querySelector('.preview-dim')?.getAttribute('style')).toContain('var(--dim-growth)');

    wrapper.unmount();
  });
});
