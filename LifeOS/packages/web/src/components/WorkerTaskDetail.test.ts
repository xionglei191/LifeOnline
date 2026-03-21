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
});
