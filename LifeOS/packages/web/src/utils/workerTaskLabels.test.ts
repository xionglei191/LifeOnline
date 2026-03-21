import { describe, expect, it } from 'vitest';
import type { WorkerTask } from '@lifeos/shared';
import { workerTaskActionMessage, workerTaskStatusLabel, workerTaskTypeLabel, workerTaskWorkerLabel } from './workerTaskLabels';

describe('workerTaskLabels', () => {
  it('returns localized labels for shared worker-task enums', () => {
    expect(workerTaskTypeLabel('update_persona_snapshot')).toBe('人格快照更新');
    expect(workerTaskStatusLabel('pending')).toBe('等待执行');
    expect(workerTaskWorkerLabel('lifeos')).toBe('LifeOS');
  });

  it('returns action-aware localized worker-task messages', () => {
    const task = {
      id: 'worker-task-1',
      taskType: 'openclaw_task',
      worker: 'openclaw',
      status: 'cancelled',
      input: {},
      outputNotes: [],
      resultSummary: null,
      error: null,
      sourceNoteId: 'note-1.md',
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    } satisfies WorkerTask;

    expect(workerTaskActionMessage('created', { ...task, status: 'pending' })).toBe('已创建任务 worker-task-1 · OpenClaw 任务 · 等待执行 · OpenClaw');
    expect(workerTaskActionMessage('retried', { ...task, taskType: 'extract_tasks', worker: 'lifeos', status: 'pending' })).toBe('已重新入队任务 worker-task-1 · 提取行动项 · 等待执行 · LifeOS');
    expect(workerTaskActionMessage('cancelled', task)).toBe('已取消任务 worker-task-1 · OpenClaw 任务 · 已取消 · OpenClaw');
  });
});
