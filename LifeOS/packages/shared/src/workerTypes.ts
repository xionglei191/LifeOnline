// ── Worker Types ───────────────────────────────────────

export const SUPPORTED_WORKER_NAMES = ['openclaw', 'lifeos'] as const;
export type WorkerName = typeof SUPPORTED_WORKER_NAMES[number];
export function isSupportedWorkerName(value: unknown): value is WorkerName {
  return typeof value === 'string' && SUPPORTED_WORKER_NAMES.includes(value as WorkerName);
}

export const SUPPORTED_WORKER_TASK_TYPES = [
  'openclaw_task',
  'summarize_note',
  'classify_inbox',
  'extract_tasks',
  'update_persona_snapshot',
  'daily_report',
  'weekly_report',
  'execute_physical_action',
] as const;
export type WorkerTaskType = typeof SUPPORTED_WORKER_TASK_TYPES[number];
export type WorkerTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type TerminalWorkerTaskStatus = Extract<WorkerTaskStatus, 'succeeded' | 'failed' | 'cancelled'>;

export type WorkerTaskInput =
  | { taskType: 'openclaw_task'; instruction: string; outputDimension?: string }
  | { taskType: 'summarize_note'; noteId: string; language?: string; maxLength?: number }
  | { taskType: 'classify_inbox'; dryRun?: boolean }
  | { taskType: 'extract_tasks'; noteId: string }
  | { taskType: 'update_persona_snapshot'; noteId: string }
  | { taskType: 'daily_report'; date?: string }
  | { taskType: 'weekly_report'; weekStart?: string }
  | { taskType: 'execute_physical_action'; actionId: string };

export type WorkerTaskInputMap = {
  [K in WorkerTaskType]: Extract<WorkerTaskInput, { taskType: K }> extends never 
    ? unknown 
    : Omit<Extract<WorkerTaskInput, { taskType: K }>, 'taskType'>
};


export interface WorkerTaskResultMap {
  openclaw_task: {
    title: string;
    summary: string;
    content: string;
    attachedFiles?: string[];
  };
  summarize_note: {
    title: string;
    summary: string;
    keyPoints: string[];
    sourceNoteTitle: string;
  };
  classify_inbox: {
    title: string;
    summary: string;
    classified: number;
    failed: number;
    items: Array<{ file: string; dimension: string; type: string; success: boolean; error?: string }>;
  };
  extract_tasks: {
    title: string;
    summary: string;
    created: number;
    sourceNoteTitle: string;
    items: Array<{ title: string; dimension: string; priority: string; due?: string | null; filePath: string }>;
  };
  update_persona_snapshot: {
    title: string;
    summary: string;
    sourceNoteTitle: string;
    snapshotId: string;
    snapshot: {
      sourceNoteTitle: string;
      summary: string;
      contentPreview: string;
      updatedAt: string;
    };
  };
  daily_report: {
    title: string;
    summary: string;
    date: string;
    stats: { totalNotes: number; doneTasks: number; milestones: number };
  };
  weekly_report: {
    title: string;
    summary: string;
    weekStart: string;
    weekEnd: string;
    stats: { totalNotes: number; doneTasks: number; milestones: number };
  };
  execute_physical_action: {
    actionId: string;
    title: string;
    success: boolean;
  };
}

export interface WorkerTaskOutputNote {
  id: string;
  title: string;
  filePath: string;
  fileName: string;
}

export interface WorkerTask<T extends WorkerTaskType = WorkerTaskType> {
  id: string;
  taskType: T;
  input: WorkerTaskInputMap[T];
  status: WorkerTaskStatus;
  worker: WorkerName;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  result?: WorkerTaskResultMap[T] | null;
  resultSummary?: string | null;
  sourceNoteId?: string | null;
  sourceReintegrationId?: string | null;
  scheduleId?: string | null;
  outputNotePaths?: string[];
  outputNotes?: WorkerTaskOutputNote[];
}

export interface WorkerTaskListFilters {
  sourceNoteId?: string;
  status?: WorkerTaskStatus;
  taskType?: WorkerTaskType;
  worker?: WorkerName;
}

export interface WorkerTaskListResponse {
  tasks: WorkerTask[];
  filters: WorkerTaskListFilters;
}

export interface WorkerTaskResponse {
  task: WorkerTask;
}

export interface ClearFinishedWorkerTasksResponse {
  success: true;
  deleted: number;
}

export interface CreateWorkerTaskRequest {
  taskType: WorkerTaskType;
  input?: WorkerTaskInputMap[WorkerTaskType];
  sourceNoteId?: string;
  sourceReintegrationId?: string;
}

export interface CreateWorkerTaskResponse {
  task: WorkerTask;
}

export interface TaskSchedule {
  id: string;
  taskType: WorkerTaskType;
  input: WorkerTaskInputMap[WorkerTaskType];
  cronExpression: string;
  label: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  lastTaskId?: string | null;
  consecutiveFailures?: number;
  lastError?: string | null;
}

export interface CreateTaskScheduleRequest {
  taskType: WorkerTaskType;
  input?: WorkerTaskInputMap[WorkerTaskType];
  cronExpression: string;
  label: string;
}

export interface TaskScheduleResponse {
  schedule: TaskSchedule;
}

export interface TaskScheduleListResponse {
  schedules: TaskSchedule[];
}

export interface DeleteTaskScheduleResponse {
  success: true;
}

export interface UpdateTaskScheduleRequest {
  enabled?: boolean;
  cronExpression?: string;
  label?: string;
  input?: WorkerTaskInputMap[WorkerTaskType];
}

export interface PersonaSnapshotPayload {
  sourceNoteTitle: string;
  summary: string;
  contentPreview: string;
  updatedAt: string;
}

export interface PersonaSnapshot {
  id: string;
  sourceNoteId: string;
  soulActionId: string | null;
  workerTaskId: string | null;
  summary: string;
  snapshot: PersonaSnapshotPayload;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaSnapshotResponse {
  snapshot: PersonaSnapshot | null;
}
