import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Note } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  updateNote: vi.fn(),
}));

vi.mock('../api/client', () => ({
  updateNote: apiMocks.updateNote,
}));

vi.mock('./NotePreview.vue', () => ({
  default: {
    props: ['note', 'visible', 'pos'],
    template: '<div class="note-preview-stub"></div>',
  },
}));

import NoteList from './NoteList.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'note-1.md',
    file_path: overrides.file_path ?? '/vault/life/note-1.md',
    title: overrides.title ?? 'Note 1',
    content: overrides.content ?? 'note content',
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('NoteList', () => {
  it('prevents duplicate quick-toggle updates while the same note is still syncing', async () => {
    const pendingUpdate = deferred<void>();
    apiMocks.updateNote.mockReturnValueOnce(pendingUpdate.promise);

    const wrapper = mount(NoteList, {
      props: {
        notes: [createNote()],
      },
    });

    const actionButton = wrapper.get('.btn-quick');
    await actionButton.trigger('click');
    await nextTick();

    expect(apiMocks.updateNote).toHaveBeenCalledTimes(1);
    expect(actionButton.attributes('disabled')).toBeDefined();

    await actionButton.trigger('click');
    await nextTick();

    expect(apiMocks.updateNote).toHaveBeenCalledTimes(1);

    pendingUpdate.resolve();
    await pendingUpdate.promise;
    await flushPromises();

    expect(wrapper.get('.btn-quick').attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });
});
