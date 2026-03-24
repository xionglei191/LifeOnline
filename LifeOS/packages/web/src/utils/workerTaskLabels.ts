import type { WorkerTask, WorkerTaskResultMap, WorkerTaskStatus, WorkerTaskType, WorkerName } from '@lifeos/shared';

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
    const r = task.result as WorkerTaskResultMap['extract_tasks'];
    return [
      `创建 ${r.created} 个行动项`,
      `来源 ${r.sourceNoteTitle}`,
    ];
  }

  if (task.taskType === 'update_persona_snapshot') {
    const r = task.result as WorkerTaskResultMap['update_persona_snapshot'];
    return [
      `快照 ${r.snapshotId}`,
      `来源 ${r.sourceNoteTitle}`,
    ];
  }

  if (task.taskType === 'summarize_note') {
    const r = task.result as WorkerTaskResultMap['summarize_note'];
    return [
      `来源 ${r.sourceNoteTitle}`,
      `要点 ${r.keyPoints.length} 条`,
    ];
  }

  if (task.taskType === 'classify_inbox') {
    const r = task.result as WorkerTaskResultMap['classify_inbox'];
    return [
      `归档 ${r.classified} 条`,
      `失败 ${r.failed} 条`,
    ];
  }

  if (task.taskType === 'daily_report') {
    const r = task.result as WorkerTaskResultMap['daily_report'];
    return [
      `日期 ${r.date}`,
      `记录 ${r.stats.totalNotes} 条`,
      `完成 ${r.stats.doneTasks} 项`,
    ];
  }

  if (task.taskType === 'weekly_report') {
    const r = task.result as WorkerTaskResultMap['weekly_report'];
    return [
      `${r.weekStart} → ${r.weekEnd}`,
      `记录 ${r.stats.totalNotes} 条`,
      `完成 ${r.stats.doneTasks} 项`,
    ];
  }

  return [];
}

export function workerTaskActionMessage(action: 'created' | 'retried' | 'cancelled', task: WorkerTask) {
  const prefix = action === 'created' ? '已创建任务' : action === 'retried' ? '已重新入队任务' : '已取消任务';
  return `${prefix} ${task.id} · ${workerTaskTypeLabel(task.taskType)} · ${workerTaskStatusLabel(task.status)} · ${workerTaskWorkerLabel(task.worker)}`;
}
