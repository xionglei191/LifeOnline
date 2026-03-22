import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Note, WorkerTask, ApprovalStatus } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchNoteById: vi.fn(),
  fetchPersonaSnapshot: vi.fn(),
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
  fetchPersonaSnapshot: apiMocks.fetchPersonaSnapshot,
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
import { SELECTABLE_DIMENSIONS, getDimensionLabel } from '../utils/dimensions';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'note-1.md',
    file_path: overrides.file_path ?? '/vault/learning/note-1.md',
    title: overrides.title ?? 'Test Note',
    content: overrides.content ?? 'hello world',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'learning',
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
    encrypted: overrides.encrypted ?? false,
    privacy: overrides.privacy ?? 'private',
    indexed_at: overrides.indexed_at ?? '2026-03-22T10:00:00.000Z',
    file_modified_at: overrides.file_modified_at ?? '2026-03-22T10:00:00.000Z',
  };
}

function createApprovalNote(status: ApprovalStatus = 'pending'): Note {
  return createNote({
    approval_status: status,
    approval_operation: 'openclaw_execute',
    approval_action: 'legacy_openclaw_execute',
    approval_risk: 'high',
    approval_scope: 'vault write',
    due: '2026-03-23T12:00:00.000Z',
    content: 'Need approval body',
  });
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
    apiMocks.fetchPersonaSnapshot.mockResolvedValue(null);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.retryWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'pending' }));
    apiMocks.cancelWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'cancelled' }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders note dimension labels and worker dimension options from the shared helper', async () => {
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

    expect(document.body.textContent).toContain('学习');
    const dimensionSelect = document.body.querySelector('.worker-field select');
    expect(dimensionSelect).toBeTruthy();
    const dimensionOptions = dimensionSelect?.querySelectorAll('option');
    const dimensionTexts = Array.from(dimensionOptions ?? []).map((option) => option.textContent?.trim() ?? '');
    expect(dimensionTexts).toEqual(SELECTABLE_DIMENSIONS.map((dimension) => getDimensionLabel(dimension.value)));

    wrapper.unmount();
  });

  it('renders latest persona snapshot for the current note', async () => {
    apiMocks.fetchPersonaSnapshot.mockResolvedValue({
      id: 'persona:note-1.md',
      sourceNoteId: 'note-1.md',
      soulActionId: null,
      workerTaskId: 'worker-task-1',
      summary: '已更新人格快照：Test Note',
      snapshot: {
        sourceNoteTitle: 'Test Note',
        summary: '已更新人格快照：Test Note',
        contentPreview: 'Current note preview for persona snapshot.',
        updatedAt: '2026-03-22T10:00:00.000Z',
      },
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
    });

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

    expect(apiMocks.fetchPersonaSnapshot).toHaveBeenCalledWith('note-1.md');
    expect(document.body.textContent).toContain('Persona Snapshot');
    expect(document.body.textContent).toContain('已更新人格快照：Test Note');
    expect(document.body.textContent).toContain('Current note preview for persona snapshot.');

    wrapper.unmount();
  });

  it('reloads persona snapshot when a persona worker update arrives for the current note', async () => {
    apiMocks.fetchPersonaSnapshot
      .mockResolvedValueOnce({
        id: 'persona:note-1.md',
        sourceNoteId: 'note-1.md',
        soulActionId: null,
        workerTaskId: 'worker-task-1',
        summary: '旧人格快照',
        snapshot: {
          sourceNoteTitle: 'Test Note',
          summary: '旧人格快照',
          contentPreview: 'old snapshot preview',
          updatedAt: '2026-03-22T10:00:00.000Z',
        },
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'persona:note-1.md',
        sourceNoteId: 'note-1.md',
        soulActionId: null,
        workerTaskId: 'worker-task-2',
        summary: '新人格快照',
        snapshot: {
          sourceNoteTitle: 'Test Note',
          summary: '新人格快照',
          contentPreview: 'new snapshot preview',
          updatedAt: '2026-03-22T11:00:00.000Z',
        },
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T11:00:00.000Z',
      });

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
    expect(document.body.textContent).toContain('旧人格快照');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'worker-task-updated',
        task: createTask({
          id: 'worker-task-2',
          taskType: 'update_persona_snapshot',
          sourceNoteId: 'note-1.md',
          status: 'done',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchPersonaSnapshot).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('新人格快照');
    expect(document.body.textContent).toContain('new snapshot preview');
    expect(document.body.textContent).not.toContain('old snapshot preview');

    wrapper.unmount();
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

  it('renders localized worker-task metadata after creating persona snapshot task', async () => {
    apiMocks.createWorkerTask.mockResolvedValue(createTask({ taskType: 'update_persona_snapshot', worker: 'lifeos', status: 'pending' }));

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
    clickButtonByText('更新人格快照');
    await flushPromises();

    expect(apiMocks.createWorkerTask).toHaveBeenCalledWith({
      taskType: 'update_persona_snapshot',
      sourceNoteId: 'note-1.md',
      input: { noteId: 'note-1.md' },
    });
    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · 人格快照更新 · 等待执行 · LifeOS');

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

  it('renders approval metadata from the shared Note contract', async () => {
    apiMocks.fetchNoteById.mockResolvedValue(createApprovalNote());

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

    expect(document.body.textContent).toContain('OpenClaw 审批请求');
    expect(document.body.textContent).toContain('openclaw_execute');
    expect(document.body.textContent).toContain('vault write');
    expect(document.body.textContent).toContain('pending');

    wrapper.unmount();
  });

  it('renders encrypted placeholder from the shared Note contract flag', async () => {
    apiMocks.fetchNoteById.mockResolvedValue(createNote({
      encrypted: true,
      privacy: 'sensitive',
      content: 'iv:authTag:cipherText',
    }));

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

    expect(document.body.innerHTML).toContain('内容已加密，需要解锁后查看');

    wrapper.unmount();
  });

  it('ignores stale note-detail responses after switching to a newer note', async () => {
    const first = deferred<Note>();
    const second = deferred<Note>();
    apiMocks.fetchNoteById.mockReset();
    apiMocks.fetchNoteById
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.fetchPersonaSnapshot.mockResolvedValue(null);

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

    await nextTick();
    await wrapper.setProps({ noteId: 'note-2.md' });
    await nextTick();

    second.resolve(createNote({ id: 'note-2.md', file_name: 'note-2.md', title: 'note-2', content: 'new content' }));
    await flushPromises();

    expect(document.body.textContent).toContain('note-2');

    first.resolve(createNote({ id: 'note-1.md', file_name: 'note-1.md', title: 'note-1', content: 'old content' }));
    await flushPromises();

    expect(document.body.textContent).toContain('note-2');
    expect(document.body.textContent).not.toContain('note-1');

    wrapper.unmount();
  });

  it('ignores stale note-detail errors after switching to a newer note', async () => {
    const first = deferred<Note>();
    const second = deferred<Note>();
    apiMocks.fetchNoteById.mockReset();
    apiMocks.fetchNoteById
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.fetchPersonaSnapshot.mockResolvedValue(null);

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

    await nextTick();
    await wrapper.setProps({ noteId: 'note-2.md' });
    await nextTick();

    second.resolve(createNote({ id: 'note-2.md', file_name: 'note-2.md', title: 'note-2', content: 'fresh content' }));
    await flushPromises();

    first.reject(new Error('stale note failed'));
    await flushPromises();

    expect(document.body.textContent).toContain('note-2');
    expect(document.body.textContent).not.toContain('stale note failed');

    wrapper.unmount();
  });
});
