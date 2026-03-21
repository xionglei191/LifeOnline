import type { WorkerTask } from '@lifeos/shared';

export function workerTaskTypeLabel(taskType: WorkerTask['taskType'] | string) {
  if (taskType === 'openclaw_task') return 'OpenClaw 任务';
  if (taskType === 'summarize_note') return '笔记摘要';
  if (taskType === 'classify_inbox') return 'Inbox 整理';
  if (taskType === 'extract_tasks') return '提取行动项';
  if (taskType === 'update_persona_snapshot') return '人格快照更新';
  if (taskType === 'daily_report') return '每日回顾';
  if (taskType === 'weekly_report') return '每周回顾';
  return taskType;
}

export function workerTaskStatusLabel(status: WorkerTask['status'] | string) {
  if (status === 'pending') return '等待执行';
  if (status === 'running') return '执行中';
  if (status === 'succeeded') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'cancelled') return '已取消';
  return status;
}

export function workerTaskWorkerLabel(worker: WorkerTask['worker'] | string) {
  if (worker === 'lifeos') return 'LifeOS';
  if (worker === 'openclaw') return 'OpenClaw';
  return worker;
}

export function workerTaskActionMessage(action: 'created' | 'retried' | 'cancelled', task: WorkerTask) {
  const prefix = action === 'created' ? '已创建任务' : action === 'retried' ? '已重新入队任务' : '已取消任务';
  return `${prefix} ${task.id} · ${workerTaskTypeLabel(task.taskType)} · ${workerTaskStatusLabel(task.status)} · ${workerTaskWorkerLabel(task.worker)}`;
}
