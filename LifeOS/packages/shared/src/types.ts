export interface ApiErrorResponse {
  error: string;
}

export type ApiResponse<T> = T | ApiErrorResponse;

export type NoteType = 'schedule' | 'task' | 'note' | 'record' | 'milestone' | 'review';
export type Dimension = 'health' | 'career' | 'finance' | 'learning' | 'relationship' | 'life' | 'hobby' | 'growth' | '_inbox';
export const DIMENSION_LABELS = {
  health: '健康',
  career: '事业',
  finance: '财务',
  learning: '学习',
  relationship: '关系',
  life: '生活',
  hobby: '兴趣',
  growth: '成长',
} as const;
export const SELECTABLE_DIMENSIONS = Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>;
export type SelectableDimension = typeof SELECTABLE_DIMENSIONS[number];
export const DIMENSION_DIRECTORY_NAMES = DIMENSION_LABELS;
export const DIMENSION_KEY_BY_DIRECTORY = {
  ...Object.fromEntries(Object.entries(DIMENSION_DIRECTORY_NAMES).map(([key, value]) => [value, key])),
  _Inbox: '_inbox',
  _Daily: 'growth',
  _Weekly: 'growth',
} as const;
export type Status = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type Priority = 'high' | 'medium' | 'low';
export type Privacy = 'public' | 'private' | 'sensitive';
export type Source = 'lingguang' | 'desktop' | 'webclipper' | 'openclaw' | 'web' | 'auto';
export type ContinuityTarget = 'source_note' | 'derived_outputs' | 'task_record';
export type ContinuityStrength = 'low' | 'medium';
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
] as const;
export type WorkerTaskType = typeof SUPPORTED_WORKER_TASK_TYPES[number];
export type WorkerTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type PromptKey = 'classify' | 'extract_tasks' | 'summarize_note' | 'daily_report' | 'weekly_report' | 'suggest';
export const SUPPORTED_SOUL_ACTION_KINDS = [
  'extract_tasks',
  'update_persona_snapshot',
  'create_event_node',
  'promote_event_node',
  'promote_continuity_record',
] as const;
export type SoulActionKind = typeof SUPPORTED_SOUL_ACTION_KINDS[number];
export const SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES = ['pending_review', 'approved', 'deferred', 'discarded'] as const;
export type SoulActionGovernanceStatus = typeof SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES[number];
export const SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES = ['not_dispatched', 'pending', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type SoulActionExecutionStatus = typeof SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES[number];
export type ReintegrationReviewStatus = 'pending_review' | 'accepted' | 'rejected';
export type ReintegrationSignalKind =
  | 'summary_reintegration'
  | 'classification_reintegration'
  | 'task_extraction_reintegration'
  | 'persona_snapshot_reintegration'
  | 'daily_report_reintegration'
  | 'weekly_report_reintegration'
  | 'openclaw_reintegration';

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

export interface ListAiPromptsResponse {
  prompts: PromptRecord[];
}

export interface AiPromptResponse {
  prompt: PromptRecord;
}

export interface ResetAiPromptResponse {
  success: true;
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

export interface AISuggestion {
  id: string;
  type: 'balance' | 'overload' | 'goal' | 'reminder';
  title: string;
  content: string;
  dimension?: Exclude<Dimension, '_inbox'>;
  createdAt: string;
}

export interface ListAiSuggestionsResponse {
  suggestions: AISuggestion[];
}

export type EventKind = 'weekly_reflection' | 'persona_shift' | 'milestone_report';
export type ContinuityRecordKind = 'persona_direction' | 'daily_rhythm' | 'weekly_theme';

export interface EventNode {
  id: string;
  sourceReintegrationId: string;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  promotionSoulActionId: string;
  eventKind: EventKind;
  title: string;
  summary: string;
  threshold: 'high';
  status: 'active';
  evidence: Record<string, unknown>;
  explanation: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListEventNodesResponse {
  eventNodes: EventNode[];
}

export interface ContinuityRecord {
  id: string;
  sourceReintegrationId: string;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  promotionSoulActionId: string;
  continuityKind: ContinuityRecordKind;
  target: ContinuityTarget;
  strength: 'medium';
  summary: string;
  continuity: Record<string, unknown>;
  evidence: Record<string, unknown>;
  explanation: Record<string, unknown>;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListContinuityRecordsResponse {
  continuityRecords: ContinuityRecord[];
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

export interface WorkerTaskListFilters {
  sourceNoteId?: string;
  status?: WorkerTaskStatus;
  taskType?: WorkerTaskType;
  worker?: WorkerName;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

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
  approval_status?: ApprovalStatus | null;
  approval_operation?: string | null;
  approval_action?: string | null;
  approval_risk?: string | null;
  approval_scope?: string | null;
}

export interface Note extends Frontmatter {
  id: string;
  file_path: string;
  file_name: string;
  title?: string | null;
  encrypted?: boolean;
  content: string;
  indexed_at: string;
  file_modified_at: string;
}

export interface UpdateNoteRequest {
  status?: Status;
  priority?: Priority;
  tags?: string[];
  approval_status?: ApprovalStatus;
}

export interface UpdateNoteResponse {
  success: true;
}

export interface CreateNoteRequest {
  title: string;
  dimension: Dimension;
  type?: NoteType;
  content?: string;
  priority?: Priority;
  tags?: string[];
}

export interface CreateNoteResponse {
  success: true;
  filePath: string;
}

export interface SearchResult {
  notes: Note[];
  total: number;
  query: string;
}

export interface Config {
  vaultPath: string;
  port: number;
}

export interface UpdateConfigRequest {
  vaultPath: string;
}

export interface UpdateConfigResponse {
  success: true;
  indexResult: IndexResult | null;
}

export interface IndexStatus {
  queueSize: number;
  processing: boolean;
  processingFile: string | null;
}

export interface FailingScheduleHealthItem {
  id: string;
  label: string;
  consecutiveFailures: number;
  lastError: string | null;
}

export interface ScheduleHealth {
  total: number;
  active: number;
  failing: number;
  failingSchedules: FailingScheduleHealthItem[];
}

export interface StatsTrendPoint {
  day: string;
  total: number;
  done: number;
}

export interface StatsRadarPoint {
  dimension: string;
  rate: number;
  total: number;
  done: number;
}

export interface StatsMonthlyPoint {
  month: string;
  total: number;
  done: number;
}

export interface StatsTagPoint {
  tag: string;
  count: number;
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
  update_persona_snapshot: {
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
  scheduleId?: string | null;
  outputNotePaths?: string[];
  outputNotes?: WorkerTaskOutputNote[];
}

export interface SoulAction {
  id: string;
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
  governanceStatus: SoulActionGovernanceStatus;
  executionStatus: SoulActionExecutionStatus;
  status: SoulActionExecutionStatus;
  governanceReason: string | null;
  workerTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  deferredAt: string | null;
  discardedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  resultSummary: string | null;
}

export interface ReintegrationRecord {
  id: string;
  workerTaskId: string;
  sourceNoteId: string | null;
  soulActionId: string | null;
  taskType: WorkerTaskType;
  terminalStatus: WorkerTaskStatus;
  signalKind: ReintegrationSignalKind;
  reviewStatus: ReintegrationReviewStatus;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  summary: string;
  evidence: Record<string, unknown>;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface CreateWorkerTaskRequest {
  taskType: WorkerTaskType;
  input?: WorkerTaskInputMap[WorkerTaskType];
  sourceNoteId?: string;
}

export interface WorkerTaskListResponse {
  tasks: WorkerTask[];
}

export interface WorkerTaskResponse {
  task: WorkerTask;
}

export interface ClearFinishedWorkerTasksResponse {
  success: true;
  deleted: number;
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
  | { type: 'index-complete'; data: IndexResult }
  | { type: 'index-queue-complete' }
  | { type: 'index-error'; data: IndexErrorEventData }
  | { type: 'worker-task-updated'; data: WorkerTask }
  | { type: 'soul-action-updated'; data: SoulAction }
  | { type: 'reintegration-record-updated'; data: ReintegrationRecord }
  | { type: 'schedule-updated' };

export type WsEventType = WsEvent['type'];

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

export interface ListSoulActionsResponse {
  soulActions: SoulAction[];
  filters: {
    sourceNoteId?: string;
    sourceReintegrationId?: string;
    governanceStatus?: SoulActionGovernanceStatus;
    executionStatus?: SoulActionExecutionStatus;
    actionKind?: SoulActionKind;
  };
}

export function normalizeSoulActionSourceFilters(
  filters: Pick<ListSoulActionsResponse['filters'], 'sourceNoteId' | 'sourceReintegrationId'>,
  soulActions: Array<Pick<SoulAction, 'sourceReintegrationId'>>,
): Pick<ListSoulActionsResponse['filters'], 'sourceNoteId' | 'sourceReintegrationId'> {
  const matchesLegacyReintegrationIdentity = Boolean(
    filters.sourceNoteId?.startsWith('reint:')
      && !filters.sourceReintegrationId
      && soulActions.some((action) => action.sourceReintegrationId === filters.sourceNoteId),
  );

  return {
    sourceNoteId: matchesLegacyReintegrationIdentity ? undefined : filters.sourceNoteId,
    sourceReintegrationId: filters.sourceReintegrationId
      ?? (matchesLegacyReintegrationIdentity ? filters.sourceNoteId : undefined),
  };
}

export interface SoulActionResponse {
  soulAction: SoulAction;
}

export interface DispatchSoulActionResponse {
  result: {
    dispatched: boolean;
    reason: string;
    soulActionId?: string | null;
    workerTaskId?: string | null;
  };
  soulAction: SoulAction | null;
  task: WorkerTask | null;
}

export interface ListReintegrationRecordsResponse {
  reintegrationRecords: ReintegrationRecord[];
}

export interface ReintegrationReviewRequest {
  reason?: string | null;
}

export interface AcceptReintegrationRecordResponse {
  reintegrationRecord: ReintegrationRecord;
  soulActions: SoulAction[];
}

export interface RejectReintegrationRecordResponse {
  reintegrationRecord: ReintegrationRecord;
}

export interface PlanReintegrationPromotionsResponse {
  soulActions: SoulAction[];
}
