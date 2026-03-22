import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
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
    result: overrides.result ?? null,
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    sourceNoteId: overrides.sourceNoteId ?? '2025-02-01.md',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
}

function noteDetailStub() {
  return {
    props: ['noteId'],
    template: '<div class="note-detail-stub" :data-note-id="noteId"></div>',
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

  it('reloads task detail when note-worker websocket events arrive for the current task', async () => {
    apiMocks.fetchWorkerTask
      .mockResolvedValueOnce(createTask({ id: 'worker-task-1', resultSummary: null, outputNotes: [] }))
      .mockResolvedValueOnce(createTask({
        id: 'worker-task-1',
        resultSummary: '输出笔记已就绪',
        outputNotes: [{ id: 'output-note-1', title: 'Output Note', fileName: 'output-note-1.md' }],
      }));

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
    expect(document.body.textContent).toContain('该任务还没有输出笔记');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-worker-tasks-updated',
        data: {
          sourceNoteId: 'note-1',
          task: createTask({ id: 'worker-task-1', status: 'succeeded' }),
        },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTask).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('输出笔记已就绪');
    expect(document.body.textContent).toContain('Output Note');

    wrapper.unmount();
  });

  it('ignores note-worker websocket events for other tasks', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-1', resultSummary: 'current task summary' }));

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

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-worker-tasks-updated',
        data: {
          sourceNoteId: 'note-1',
          task: createTask({ id: 'worker-task-2', status: 'succeeded' }),
        },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTask).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('current task summary');

    wrapper.unmount();
  });

  it('opens source note from the source pill', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask({ sourceNoteId: 'source-note.md' }));

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-1' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: noteDetailStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const sourceButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'source source…e.md');
    expect(sourceButton).toBeTruthy();
    (sourceButton as HTMLButtonElement).click();
    await flushPromises();

    const noteDetail = document.body.querySelector('.note-detail-stub');
    expect(noteDetail?.getAttribute('data-note-id')).toBe('source-note.md');

    wrapper.unmount();
  });


  it('opens output note from the output list', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask({
      outputNotes: [{ id: 'output-note-1', title: 'Output Note', fileName: 'output-note-1.md' }],
    }));

    const wrapper = mount(WorkerTaskDetail, {
      props: { taskId: 'worker-task-1' },
      global: {
        stubs: {
          Teleport: false,
          NoteDetail: noteDetailStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const outputButton = document.body.querySelector('.output-item');
    expect(outputButton).toBeTruthy();
    (outputButton as HTMLButtonElement).click();
    await flushPromises();

    const noteDetail = document.body.querySelector('.note-detail-stub');
    expect(noteDetail?.getAttribute('data-note-id')).toBe('output-note-1');
    expect(document.body.textContent).toContain('Output Note');

    wrapper.unmount();
  });

  it('renders structured worker task result JSON when present', async () => {
    apiMocks.fetchWorkerTask.mockResolvedValue(createTask({
      taskType: 'extract_tasks',
      result: {
        title: 'Source Note 行动项提取',
        summary: '已创建 1 个行动项',
        created: 1,
        sourceNoteTitle: 'Source Note',
        items: [
          {
            title: 'First task',
            dimension: 'learning',
            priority: 'medium',
            due: null,
            filePath: '/vault/学习/2026-03-22-First-task.md',
          },
        ],
      },
      resultSummary: '已创建 1 个行动项',
      status: 'succeeded',
    }));

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

    expect(document.body.textContent).toContain('结构化结果');
    expect(document.body.textContent).toContain('Source Note 行动项提取');
    expect(document.body.textContent).toContain('First task');

    wrapper.unmount();
  });

  it('emits close when clicking the close button', async () => {
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
    const closeButton = document.body.querySelector('.close-btn');
    expect(closeButton).toBeTruthy();
    (closeButton as HTMLButtonElement).click();

    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });

  it('ignores stale worker-task responses after switching to a newer task', async () => {
    const first = deferred<WorkerTask>();
    const second = deferred<WorkerTask>();
    apiMocks.fetchWorkerTask.mockReset();
    apiMocks.fetchWorkerTask
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

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

    await nextTick();
    await wrapper.setProps({ taskId: 'worker-task-2' });
    await nextTick();

    second.resolve(createTask({ id: 'worker-task-2', resultSummary: 'new task summary' }));
    await flushPromises();

    expect(document.body.textContent).toContain('worker…sk-2');
    expect(document.body.textContent).toContain('new task summary');

    first.resolve(createTask({ id: 'worker-task-1', resultSummary: 'old task summary' }));
    await flushPromises();

    expect(document.body.textContent).toContain('worker…sk-2');
    expect(document.body.textContent).toContain('new task summary');
    expect(document.body.textContent).not.toContain('old task summary');

    wrapper.unmount();
  });

  it('ignores stale worker-task errors after switching to a newer task', async () => {
    const first = deferred<WorkerTask>();
    const second = deferred<WorkerTask>();
    apiMocks.fetchWorkerTask.mockReset();
    apiMocks.fetchWorkerTask
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

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

    await nextTick();
    await wrapper.setProps({ taskId: 'worker-task-2' });
    await nextTick();

    second.resolve(createTask({ id: 'worker-task-2', resultSummary: 'fresh task summary' }));
    await flushPromises();

    first.reject(new Error('stale task failed'));
    await first.promise.catch(() => undefined);
    await flushPromises();

    expect(document.body.textContent).toContain('worker…sk-2');
    expect(document.body.textContent).toContain('fresh task summary');
    expect(document.body.textContent).not.toContain('stale task failed');

    wrapper.unmount();
  });
});
