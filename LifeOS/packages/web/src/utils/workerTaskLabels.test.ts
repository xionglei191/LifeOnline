import { describe, expect, it } from 'vitest';
import { SUPPORTED_WORKER_NAMES, SUPPORTED_WORKER_TASK_TYPES, type WorkerTask, type WorkerTaskStatus } from '@lifeos/shared';
import { workerTaskActionMessage, workerTaskStatusLabel, workerTaskTypeLabel, workerTaskWorkerLabel } from './workerTaskLabels';

describe('workerTaskLabels', () => {
  it('covers every shared worker-task type and worker name with localized labels', () => {
    expect(SUPPORTED_WORKER_TASK_TYPES.map((taskType) => workerTaskTypeLabel(taskType))).toEqual([
      'OpenClaw 任务',
      '笔记摘要',
      'Inbox 整理',
      '提取行动项',
      '人格快照更新',
      '每日回顾',
      '每周回顾',
    ]);
    expect(SUPPORTED_WORKER_NAMES.map((worker) => workerTaskWorkerLabel(worker))).toEqual(['OpenClaw', 'LifeOS']);
  });

  it('covers every shared worker-task status with localized labels', () => {
    const statuses: WorkerTaskStatus[] = ['pending', 'running', 'succeeded', 'failed', 'cancelled'];
    expect(statuses.map((status) => workerTaskStatusLabel(status))).toEqual(['等待执行', '执行中', '已完成', '失败', '已取消']);
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
