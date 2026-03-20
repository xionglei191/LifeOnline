import type { WorkerTask } from '@lifeos/shared';

export const SUPPORTED_REINTEGRATION_TASK_TYPES = [
  'summarize_note',
  'classify_inbox',
  'extract_tasks',
  'update_persona_snapshot',
  'daily_report',
  'weekly_report',
  'openclaw_task',
] as const;

export type SupportedReintegrationTaskType = typeof SUPPORTED_REINTEGRATION_TASK_TYPES[number];
export type TerminalWorkerTaskStatus = 'succeeded' | 'failed' | 'cancelled';

export interface FeedbackReintegrationPayload {
  taskId: string;
  taskType: SupportedReintegrationTaskType;
  status: TerminalWorkerTaskStatus;
  resultSummary: string | null;
  error: string | null;
  sourceNoteId: string | null;
  outputNotePaths: string[];
}

export interface ActionOutcomePacket extends FeedbackReintegrationPayload {}

export function isSupportedReintegrationTaskType(taskType: WorkerTask['taskType']): taskType is SupportedReintegrationTaskType {
  return (SUPPORTED_REINTEGRATION_TASK_TYPES as readonly string[]).includes(taskType);
}

export function isTerminalWorkerTaskStatus(status: WorkerTask['status']): status is TerminalWorkerTaskStatus {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

export function createFeedbackReintegrationPayload(task: WorkerTask): FeedbackReintegrationPayload {
  if (!isSupportedReintegrationTaskType(task.taskType)) {
    throw new Error(`Unsupported reintegration task type: ${task.taskType}`);
  }

  if (!isTerminalWorkerTaskStatus(task.status)) {
    throw new Error(`Feedback reintegration requires a terminal WorkerTask: ${task.status}`);
  }

  return {
    taskId: task.id,
    taskType: task.taskType,
    status: task.status,
    resultSummary: task.resultSummary ?? null,
    error: task.error ?? null,
    sourceNoteId: task.sourceNoteId ?? null,
    outputNotePaths: [...(task.outputNotePaths ?? [])],
  };
}
