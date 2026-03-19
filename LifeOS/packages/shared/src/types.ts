export type NoteType = 'schedule' | 'task' | 'note' | 'record' | 'milestone' | 'review';
export type Dimension = 'health' | 'career' | 'finance' | 'learning' | 'relationship' | 'life' | 'hobby' | 'growth' | '_inbox';
export type Status = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type Priority = 'high' | 'medium' | 'low';
export type Privacy = 'public' | 'private' | 'sensitive';
export type Source = 'lingguang' | 'desktop' | 'webclipper' | 'openclaw' | 'web' | 'auto';
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
  'daily_report',
  'weekly_report',
] as const;
export type WorkerTaskType = typeof SUPPORTED_WORKER_TASK_TYPES[number];
export type WorkerTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type PromptKey = 'classify' | 'extract_tasks' | 'summarize_note' | 'daily_report' | 'weekly_report';

export interface PromptRecord {
  key: PromptKey;
  label: string;
  description: string;
  requiredPlaceholders: string[];
  defaultContent: string;
  overrideContent: string | null;
  effectiveContent: string;
  enabled: boolean;
  updatedAt: string | null;
  notes?: string | null;
  isOverridden: boolean;
}

export interface UpdatePromptRequest {
  content: string;
  enabled?: boolean;
  notes?: string | null;
}

export type AiProviderApiKeySource = 'database' | 'env' | 'missing';

export interface AiProviderSettings {
  baseUrl: string;
  model: string;
  enabled: boolean;
  updatedAt: string | null;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  apiKeySource: AiProviderApiKeySource;
}

export interface UpdateAiProviderSettingsRequest {
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface TestAiProviderConnectionRequest {
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface TestAiProviderConnectionResponse {
  success: boolean;
  message: string;
  resolvedBaseUrl: string;
  resolvedModel: string;
  latencyMs?: number;
}

export interface WorkerTaskListFilters {
  sourceNoteId?: string;
  status?: WorkerTaskStatus;
  taskType?: WorkerTaskType;
  worker?: WorkerName;
}

export interface Frontmatter {
  type: NoteType;
  dimension: Dimension;
  status: Status;
  priority?: Priority;
  privacy: Privacy;
  date: string;
  due?: string;
  tags?: string[];
  source: Source;
  created: string;
  updated?: string;
}

export interface Note extends Frontmatter {
  id: string;
  file_path: string;
  file_name: string;
  content: string;
  indexed_at: string;
  file_modified_at: string;
}

export interface DashboardData {
  todayTodos: Note[];
  weeklyHighlights: Note[];
  dimensionStats: DimensionStat[];
  inboxCount: number;
}

export interface DimensionStat {
  dimension: Dimension;
  total: number;
  pending: number;
  in_progress: number;
  done: number;
  health_score: number;
}

// Timeline data: notes grouped by dimension + date range
export interface TimelineData {
  startDate: string;
  endDate: string;
  tracks: TimelineTrack[];
}

export interface TimelineTrack {
  dimension: Dimension;
  notes: Note[];
}

// Calendar data: notes grouped by date + counts
export interface CalendarDay {
  date: string;
  notes: Note[];
  count: number;
}

export interface CalendarData {
  year: number;
  month: number;  // 1-12
  days: CalendarDay[];
}

export interface WorkerTaskInputMap {
  openclaw_task: {
    instruction: string;
    outputDimension?: string;
  };
  summarize_note: {
    noteId: string;
    language?: string;
    maxLength?: number;
  };
  classify_inbox: {
    dryRun?: boolean;
  };
  extract_tasks: {
    noteId: string;
  };
  daily_report: {
    date?: string;
  };
  weekly_report: {
    weekStart?: string;
  };
}

export interface WorkerTaskResultMap {
  openclaw_task: {
    title: string;
    summary: string;
    content: string;
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
  resultSummary?: string | null;
  sourceNoteId?: string | null;
  scheduleId?: string | null;
  outputNotePaths?: string[];
  outputNotes?: WorkerTaskOutputNote[];
}

export interface CreateWorkerTaskRequest {
  taskType: WorkerTaskType;
  input?: WorkerTaskInputMap[WorkerTaskType];
  sourceNoteId?: string;
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

export interface IndexResult {
  total: number;
  indexed: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

export type IndexOperation = 'upsert' | 'delete';

export interface IndexErrorEventData {
  filePath: string;
  operation: IndexOperation;
  error: string;
  timestamp: string;
}

export type WsEvent =
  | { type: 'file-changed'; data: { filePath: string; operation: IndexOperation } }
  | { type: 'index-complete'; data?: IndexResult }
  | { type: 'index-error'; data: IndexErrorEventData }
  | { type: 'worker-task-updated'; data: WorkerTask }
  | { type: 'schedule-updated' };

export type WsEventType = WsEvent['type'];

export interface CreateTaskScheduleRequest {
  taskType: WorkerTaskType;
  input?: WorkerTaskInputMap[WorkerTaskType];
  cronExpression: string;
  label: string;
}

export interface UpdateTaskScheduleRequest {
  enabled?: boolean;
  cronExpression?: string;
  label?: string;
  input?: WorkerTaskInputMap[WorkerTaskType];
}
