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

import TodayTodos from './TodayTodos.vue';

function createTodo(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'todo-1',
    file_name: overrides.file_name ?? 'todo-1.md',
    file_path: overrides.file_path ?? '/vault/生活/todo-1.md',
    title: overrides.title ?? 'Todo 1',
    content: overrides.content ?? 'todo content',
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

describe('TodayTodos', () => {
  it('prevents duplicate toggles while the same todo is still syncing', async () => {
    const pendingUpdate = deferred<void>();
    apiMocks.updateNote.mockReturnValueOnce(pendingUpdate.promise);

    const wrapper = mount(TodayTodos, {
      props: {
        todos: [createTodo()],
      },
    });

    const checkbox = wrapper.get('input[type="checkbox"]');
    checkbox.element.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();

    expect(apiMocks.updateNote).toHaveBeenCalledTimes(1);
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true);

    checkbox.element.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();

    expect(apiMocks.updateNote).toHaveBeenCalledTimes(1);

    pendingUpdate.resolve();
    await pendingUpdate.promise;
    await flushPromises();

    expect((checkbox.element as HTMLInputElement).disabled).toBe(false);
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  it('renders dimension labels from the shared dimension helper', () => {
    const wrapper = mount(TodayTodos, {
      props: {
        todos: [
          createTodo({ id: 'todo-life', dimension: 'life' }),
          createTodo({ id: 'todo-growth', dimension: 'growth', file_name: 'todo-2.md' }),
        ],
      },
    });

    expect(wrapper.text()).toContain('生活');
    expect(wrapper.text()).toContain('成长');
  });
});
