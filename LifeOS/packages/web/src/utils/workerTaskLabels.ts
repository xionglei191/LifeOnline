import type { WorkerTask, WorkerTaskStatus, WorkerTaskType, WorkerName } from '@lifeos/shared';

const workerTaskTypeLabels: Record<WorkerTaskType, string> = {
  openclaw_task: 'OpenClaw 任务',
  summarize_note: '笔记摘要',
  classify_inbox: 'Inbox 整理',
  extract_tasks: '提取行动项',
  update_persona_snapshot: '人格快照更新',
  daily_report: '每日回顾',
  weekly_report: '每周回顾',
};

const workerTaskStatusLabels: Record<WorkerTaskStatus, string> = {
  pending: '等待执行',
  running: '执行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const workerTaskWorkerLabels: Record<WorkerName, string> = {
  lifeos: 'LifeOS',
  openclaw: 'OpenClaw',
};

export function workerTaskTypeLabel(taskType: WorkerTaskType | string) {
  return taskType in workerTaskTypeLabels
    ? workerTaskTypeLabels[taskType as WorkerTaskType]
    : taskType;
}

export function workerTaskStatusLabel(status: WorkerTaskStatus | string) {
  return status in workerTaskStatusLabels
    ? workerTaskStatusLabels[status as WorkerTaskStatus]
    : status;
}

export function workerTaskWorkerLabel(worker: WorkerName | string) {
  return worker in workerTaskWorkerLabels
    ? workerTaskWorkerLabels[worker as WorkerName]
    : worker;
}

export function workerTaskResultFacts(task: WorkerTask) {
  if (!task.result || task.status !== 'succeeded') return [];

  if (task.taskType === 'extract_tasks') {
    return [
      `创建 ${task.result.created} 个行动项`,
      `来源 ${task.result.sourceNoteTitle}`,
    ];
  }

  if (task.taskType === 'update_persona_snapshot') {
    return [
      `快照 ${task.result.snapshotId}`,
      `来源 ${task.result.sourceNoteTitle}`,
    ];
  }

  if (task.taskType === 'summarize_note') {
    return [
      `来源 ${task.result.sourceNoteTitle}`,
      `要点 ${task.result.keyPoints.length} 条`,
    ];
  }

  if (task.taskType === 'classify_inbox') {
    return [
      `归档 ${task.result.classified} 条`,
      `失败 ${task.result.failed} 条`,
    ];
  }

  if (task.taskType === 'daily_report') {
    return [
      `日期 ${task.result.date}`,
      `记录 ${task.result.stats.totalNotes} 条`,
      `完成 ${task.result.stats.doneTasks} 项`,
    ];
  }

  if (task.taskType === 'weekly_report') {
    return [
      `${task.result.weekStart} → ${task.result.weekEnd}`,
      `记录 ${task.result.stats.totalNotes} 条`,
      `完成 ${task.result.stats.doneTasks} 项`,
    ];
  }

  return [];
}

export function workerTaskActionMessage(action: 'created' | 'retried' | 'cancelled', task: WorkerTask) {
  const prefix = action === 'created' ? '已创建任务' : action === 'retried' ? '已重新入队任务' : '已取消任务';
  return `${prefix} ${task.id} · ${workerTaskTypeLabel(task.taskType)} · ${workerTaskStatusLabel(task.status)} · ${workerTaskWorkerLabel(task.worker)}`;
}
