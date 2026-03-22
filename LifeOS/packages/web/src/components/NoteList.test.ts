import { describe, expect, it, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers shared note titles over file names on the main list path', () => {
    const wrapper = mount(NoteList, {
      props: {
        notes: [createNote({ title: 'Shared contract title', file_name: 'fallback-file-name.md' })],
      },
    });

    expect(wrapper.text()).toContain('Shared contract title');
    expect(wrapper.text()).not.toContain('fallback-file-name');
  });

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
    expect(wrapper.get('.btn-quick').attributes('disabled')).toBeDefined();

    await wrapper.get('.btn-quick').trigger('click');
    await nextTick();

    expect(apiMocks.updateNote).toHaveBeenCalledTimes(1);

    pendingUpdate.resolve();
    await pendingUpdate.promise;
    await flushPromises();

    expect(wrapper.get('.btn-quick').attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('refresh')).toBeUndefined();
  });

  it('updates the quick-toggle label and badge immediately after a successful toggle without emitting refresh', async () => {
    apiMocks.updateNote.mockResolvedValue(undefined);

    const wrapper = mount(NoteList, {
      props: {
        notes: [createNote({ id: 'note-1', status: 'pending' })],
      },
    });

    expect(wrapper.text()).toContain('待办');
    expect(wrapper.get('.btn-quick').text()).toBe('标记完成');

    await wrapper.get('.btn-quick').trigger('click');
    await flushPromises();

    expect(apiMocks.updateNote).toHaveBeenCalledWith('note-1', { status: 'done' });
    expect(wrapper.text()).toContain('完成');
    expect(wrapper.get('.btn-quick').text()).toBe('恢复待办');
    expect(wrapper.emitted('refresh')).toBeUndefined();
  });

  it('reverts the quick-toggle label and badge when the update request fails', async () => {
    apiMocks.updateNote.mockRejectedValueOnce(new Error('toggle failed'));

    const wrapper = mount(NoteList, {
      props: {
        notes: [createNote({ id: 'note-1', status: 'pending' })],
      },
    });

    await wrapper.get('.btn-quick').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('待办');
    expect(wrapper.get('.btn-quick').text()).toBe('标记完成');
  });
});
