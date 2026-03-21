import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { Note, WorkerTask } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchNoteById: vi.fn(),
  extractTasks: vi.fn(),
  updateNote: vi.fn(),
  appendNote: vi.fn(),
  deleteNote: vi.fn(),
  createWorkerTask: vi.fn(),
  fetchWorkerTasks: vi.fn(),
  retryWorkerTask: vi.fn(),
  cancelWorkerTask: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchNoteById: apiMocks.fetchNoteById,
  extractTasks: apiMocks.extractTasks,
  updateNote: apiMocks.updateNote,
  appendNote: apiMocks.appendNote,
  deleteNote: apiMocks.deleteNote,
  createWorkerTask: apiMocks.createWorkerTask,
  fetchWorkerTasks: apiMocks.fetchWorkerTasks,
  retryWorkerTask: apiMocks.retryWorkerTask,
  cancelWorkerTask: apiMocks.cancelWorkerTask,
}));

vi.mock('../utils/crypto', () => ({
  decryptContent: vi.fn(),
  getEncryptionKey: vi.fn(() => 'test-key'),
}));

import NoteDetail from './NoteDetail.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    file_name: overrides.file_name ?? 'note-1.md',
    path: overrides.path ?? 'learning/note-1.md',
    title: overrides.title ?? 'Test Note',
    content: overrides.content ?? 'hello world',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'learning',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'medium',
    tags: overrides.tags ?? [],
    date: overrides.date ?? '2026-03-22',
    due: overrides.due ?? null,
    source: overrides.source ?? null,
    created_at: overrides.created_at ?? '2026-03-22T10:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-03-22T10:00:00.000Z',
    links: overrides.links ?? [],
    backlinks: overrides.backlinks ?? [],
    encrypted: overrides.encrypted ?? false,
    privacy: overrides.privacy ?? 'private',
  } as Note;
}

function createTask(overrides: Partial<WorkerTask> = {}): WorkerTask {
  return {
    id: overrides.id ?? 'worker-task-1',
    taskType: overrides.taskType ?? 'update_persona_snapshot',
    worker: overrides.worker ?? 'lifeos',
    status: overrides.status ?? 'pending',
    input: overrides.input ?? { noteId: 'note-1.md' },
    outputNotes: overrides.outputNotes ?? [],
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    sourceNoteId: overrides.sourceNoteId ?? 'note-1.md',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
}

function clickButtonByText(text: string) {
  const button = Array.from(document.body.querySelectorAll('button')).find((element) => element.textContent?.trim() === text);
  expect(button).toBeTruthy();
  (button as HTMLButtonElement).click();
}

function workerTaskCardStub() {
  return {
    props: ['task'],
    emits: ['open-detail', 'open-output', 'cancel', 'retry'],
    template: `
      <div>
        <button type="button" class="stub-retry" @click="$emit('retry', task.id)">重试任务</button>
        <button type="button" class="stub-cancel" @click="$emit('cancel', task.id)">取消任务</button>
      </div>
    `,
  };
}

describe('NoteDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchNoteById.mockResolvedValue(createNote());
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.retryWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'pending' }));
    apiMocks.cancelWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'cancelled' }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders localized worker-task metadata after creating summarize task', async () => {
    apiMocks.createWorkerTask.mockResolvedValue(createTask({ taskType: 'summarize_note', worker: 'lifeos', status: 'pending' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('生成笔记摘要');
    await flushPromises();

    expect(apiMocks.createWorkerTask).toHaveBeenCalledWith({
      taskType: 'summarize_note',
      sourceNoteId: 'note-1.md',
      input: { noteId: 'note-1.md' },
    });
    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · 笔记摘要 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after creating OpenClaw task', async () => {
    apiMocks.createWorkerTask.mockResolvedValue(createTask({ taskType: 'openclaw_task', worker: 'openclaw', status: 'running' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const instructionInput = document.body.querySelector('textarea[placeholder="输入自然语言指令，例如：搜索相关领域最新进展"]') as HTMLTextAreaElement | null;
    expect(instructionInput).toBeTruthy();
    instructionInput!.value = 'search latest progress';
    instructionInput!.dispatchEvent(new Event('input'));
    await flushPromises();
    clickButtonByText('执行 OpenClaw 任务');
    await flushPromises();

    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · OpenClaw 任务 · 执行中 · OpenClaw');
    expect(document.body.textContent).not.toContain('openclaw_task');
    expect(document.body.textContent).not.toContain('openclaw');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after extracting tasks', async () => {
    apiMocks.extractTasks.mockResolvedValue(createTask({ taskType: 'extract_tasks', worker: 'lifeos', status: 'succeeded' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('提取行动项');
    await flushPromises();

    expect(apiMocks.extractTasks).toHaveBeenCalledWith('note-1.md');
    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · 提取行动项 · 已完成 · LifeOS');
    expect(document.body.textContent).not.toContain('extract_tasks');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after retrying a related task', async () => {
    apiMocks.fetchWorkerTasks.mockResolvedValue([createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'failed' })]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('重试任务');
    await flushPromises();

    expect(apiMocks.retryWorkerTask).toHaveBeenCalledWith('worker-task-retry');
    expect(document.body.textContent).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after cancelling a related task', async () => {
    apiMocks.fetchWorkerTasks.mockResolvedValue([createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'running' })]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('取消任务');
    await flushPromises();

    expect(apiMocks.cancelWorkerTask).toHaveBeenCalledWith('worker-task-cancel');
    expect(document.body.textContent).toContain('已取消任务 worker-task-cancel · OpenClaw 任务 · 已取消 · OpenClaw');
    expect(document.body.textContent).not.toContain('openclaw_task');

    wrapper.unmount();
  });
});
