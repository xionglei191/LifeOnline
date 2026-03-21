import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { WorkerTask } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchWorkerTask: vi.fn(),
  retryWorkerTask: vi.fn(),
  cancelWorkerTask: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchWorkerTask: apiMocks.fetchWorkerTask,
  retryWorkerTask: apiMocks.retryWorkerTask,
  cancelWorkerTask: apiMocks.cancelWorkerTask,
}));

import WorkerTaskDetail from './WorkerTaskDetail.vue';

function createTask(overrides: Partial<WorkerTask> = {}): WorkerTask {
  return {
    id: overrides.id ?? 'worker-task-1',
    taskType: overrides.taskType ?? 'update_persona_snapshot',
    worker: overrides.worker ?? 'lifeos',
    status: overrides.status ?? 'pending',
    input: overrides.input ?? { noteId: 'note-1' },
    outputNotes: overrides.outputNotes ?? [],
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    sourceNoteId: overrides.sourceNoteId ?? '2025-02-01.md',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
}

describe('WorkerTaskDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.retryWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'pending' }));
    apiMocks.cancelWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'cancelled' }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders localized worker and task labels instead of raw enum values', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask());

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-1' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: true,
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    const pills = Array.from(document.body.querySelectorAll('.detail-pill')).map((pill) => pill.textContent?.trim() || '');
    expect(pills).toContain('LifeOS');
    expect(pills).toContain('人格快照更新');
    expect(pills).not.toContain('lifeos');
    expect(pills).not.toContain('update_persona_snapshot');

    wrapper.unmount();
  });

  it('renders OpenClaw worker label for external worker tasks', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask({ worker: 'openclaw', taskType: 'openclaw_task' }));

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-1' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: true,
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    const pills = Array.from(document.body.querySelectorAll('.detail-pill')).map((pill) => pill.textContent?.trim() || '');
    expect(pills).toContain('OpenClaw');
    expect(pills).toContain('OpenClaw 任务');
    expect(pills).not.toContain('openclaw');

    wrapper.unmount();
  });

  it('renders localized metadata after retrying a task', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'failed' }));

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-retry' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: true,
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const retryButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === '重试');
    expect(retryButton).toBeTruthy();
    (retryButton as HTMLButtonElement).click();
    await flushPromises();

    expect(apiMocks.retryWorkerTask).toHaveBeenCalledWith('worker-task-retry');
    expect(document.body.textContent).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('keeps retry success feedback visible after websocket refresh', async () => {
    apiMocks.fetchWorkerTask
      .mockResolvedValueOnce(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'failed' }))
      .mockResolvedValueOnce(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'pending' }));

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-retry' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: true,
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const retryButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === '重试');
    expect(retryButton).toBeTruthy();
    (retryButton as HTMLButtonElement).click();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'worker-task-updated',
        data: { id: 'worker-task-retry' },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTask).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('keeps cancel success feedback visible after websocket refresh', async () => {
    apiMocks.fetchWorkerTask
      .mockResolvedValueOnce(createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'running' }))
      .mockResolvedValueOnce(createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'cancelled' }));

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-cancel' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: true,
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const cancelButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === '取消');
    expect(cancelButton).toBeTruthy();
    (cancelButton as HTMLButtonElement).click();
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'worker-task-updated',
        data: { id: 'worker-task-cancel' },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTask).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('已取消任务 worker-task-cancel · OpenClaw 任务 · 已取消 · OpenClaw');

    wrapper.unmount();
  });
});
