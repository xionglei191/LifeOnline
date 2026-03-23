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
export type TerminalWorkerTaskStatus = Extract<WorkerTaskStatus, 'succeeded' | 'failed' | 'cancelled'>;
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
  explanationSummary?: ProjectionExplanationSummary | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListEventNodesResponse {
  eventNodes: EventNode[];
  filters: {
    sourceReintegrationIds?: string[];
  };
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
  continuitySummary?: ProjectionContinuitySummary | null;
  evidence: Record<string, unknown>;
  explanation: Record<string, unknown>;
  explanationSummary?: ProjectionExplanationSummary | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListContinuityRecordsResponse {
  continuityRecords: ContinuityRecord[];
  filters: {
    sourceReintegrationIds?: string[];
  };
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
  filters: {
    q: string;
  };
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
  sourceReintegrationId?: string | null;
  scheduleId?: string | null;
  outputNotePaths?: string[];
  outputNotes?: WorkerTaskOutputNote[];
}

export interface SoulActionPromotionSummary {
  sourceSummary: string | null;
  primaryReason: string | null;
  rationale: string | null;
  reviewBacked: boolean;
  projectionKind: 'event' | 'continuity' | null;
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
  promotionSummary?: SoulActionPromotionSummary | null;
  executionSummary?: SoulActionDispatchExecutionSummary | null;
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

export interface ExtractTaskReintegrationEvidenceItem {
  title: string;
  dimension: string;
  priority: string;
  due?: string | null;
  filePath: string;
  outputNoteId: string | null;
}

export interface ReintegrationRecordEvidence extends ReintegrationEvidenceSummary, Record<string, unknown> {}

export interface ReintegrationRecordInput {
  workerTaskId: string;
  sourceNoteId: string | null;
  soulActionId: string | null;
  taskType: WorkerTaskType;
  terminalStatus: TerminalWorkerTaskStatus;
  signalKind: ReintegrationSignalKind;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface ReintegrationRecord extends ReintegrationRecordInput {
  id: string;
  reviewStatus: ReintegrationReviewStatus;
  reviewReason: string | null;
  nextActionSummary?: ReintegrationNextActionSummary | null;
  displaySummary?: ReintegrationOutcomeDisplaySummary | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface CreateWorkerTaskRequest {
  taskType: WorkerTaskType;
  input?: WorkerTaskInputMap[WorkerTaskType];
  sourceNoteId?: string;
  sourceReintegrationId?: string;
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

export interface NoteWorkerTasksUpdatedEventData {
  sourceNoteId: string;
  task: WorkerTask;
}

export interface NoteUpdatedEventData {
  noteId: string;
}

export interface NoteCreatedEventData {
  filePath: string;
}

export interface NoteDeletedEventData {
  noteId: string;
  filePath: string;
}

export interface EventNodeUpdatedEventData {
  eventNode: EventNode;
}

export interface ContinuityRecordUpdatedEventData {
  continuityRecord: ContinuityRecord;
}

export type WsEvent =
  | { type: 'file-changed'; data: { filePath: string; operation: IndexOperation } }
  | { type: 'index-complete'; data: IndexResult }
  | { type: 'index-queue-complete' }
  | { type: 'index-error'; data: IndexErrorEventData }
  | { type: 'worker-task-updated'; data: WorkerTask }
  | { type: 'note-worker-tasks-updated'; data: NoteWorkerTasksUpdatedEventData }
  | { type: 'note-updated'; data: NoteUpdatedEventData }
  | { type: 'note-created'; data: NoteCreatedEventData }
  | { type: 'note-deleted'; data: NoteDeletedEventData }
  | { type: 'soul-action-updated'; data: SoulAction }
  | { type: 'reintegration-record-updated'; data: ReintegrationRecord }
  | { type: 'event-node-updated'; data: EventNodeUpdatedEventData }
  | { type: 'continuity-record-updated'; data: ContinuityRecordUpdatedEventData }
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

export interface EventPromotionExplanation {
  whyHighThreshold: string;
  whyNow: string;
  reviewBacked: true;
}

export interface ContinuityPromotionExplanation {
  whyNotOrdinaryArtifact: string;
  whyReviewBacked: string;
  reviewBacked: true;
}

export function buildEventPromotionExplanation(
  record: Pick<ReintegrationRecord, 'summary' | 'evidence'>,
): EventPromotionExplanation {
  const nextActionCandidate = getReintegrationNextActionCandidate(record);
  return {
    whyHighThreshold: 'review-backed PR6 promotion',
    whyNow: nextActionCandidate?.title ?? record.summary,
    reviewBacked: true,
  };
}

export function buildContinuityPromotionExplanation(
  record: Pick<ReintegrationRecord, 'reviewReason'>,
): ContinuityPromotionExplanation {
  return {
    whyNotOrdinaryArtifact: 'PR6 continuity promotion',
    whyReviewBacked: record.reviewReason ?? 'accepted reintegration record',
    reviewBacked: true,
  };
}

export function formatEventKindLabel(eventNode: Pick<EventNode, 'eventKind'>): string {
  return eventNode.eventKind === 'persona_shift'
    ? '人格切换'
    : eventNode.eventKind === 'milestone_report'
      ? '里程碑'
      : '周回顾';
}

export function formatEventNodeThresholdLabel(eventNode: Pick<EventNode, 'threshold'>): string {
  return eventNode.threshold === 'high' ? '高阈值' : eventNode.threshold;
}

export function formatEventNodeStatusLabel(eventNode: Pick<EventNode, 'status'>): string {
  return eventNode.status === 'active' ? '生效中' : eventNode.status;
}

export function formatContinuityKindLabel(record: Pick<ContinuityRecord, 'continuityKind'>): string {
  return record.continuityKind === 'persona_direction'
    ? '人格走向'
    : record.continuityKind === 'daily_rhythm'
      ? '日节律'
      : '周主题';
}

export function formatReintegrationSignalKindLabel(record: Pick<ReintegrationRecord, 'signalKind'>): string {
  return record.signalKind === 'summary_reintegration'
    ? '摘要回流'
    : record.signalKind === 'classification_reintegration'
      ? '分类回流'
      : record.signalKind === 'task_extraction_reintegration'
        ? '任务提取回流'
        : record.signalKind === 'persona_snapshot_reintegration'
          ? '人格快照回流'
          : record.signalKind === 'daily_report_reintegration'
            ? '日报回流'
            : record.signalKind === 'weekly_report_reintegration'
              ? '周报回流'
              : 'OpenClaw 回流';
}

export function formatContinuityTargetLabel(record: Pick<ContinuityRecord, 'target'>): string {
  return record.target === 'source_note'
    ? '源笔记'
    : record.target === 'derived_outputs'
      ? '派生产物'
      : '任务记录';
}

export function formatReintegrationTargetLabel(record: Pick<ReintegrationRecord, 'target'>): string {
  return formatContinuityTargetLabel({ target: record.target });
}

export function formatContinuityStrengthLabel(record: { strength: ContinuityStrength }): string {
  return record.strength === 'medium' ? '中' : '低';
}

export function formatReintegrationStrengthLabel(record: Pick<ReintegrationRecord, 'strength'>): string {
  return formatContinuityStrengthLabel({ strength: record.strength });
}

export interface ProjectionExplanationSummary {
  primaryReason: string | null;
  rationale: string | null;
  reviewBacked: boolean;
}

export interface ProjectionContinuitySummary {
  anchor: string | null;
  scope: string | null;
}

export function getProjectionExplanationSummary(
  projection: Pick<EventNode, 'explanation' | 'explanationSummary'> | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'>,
): ProjectionExplanationSummary | null {
  const explanation = projection.explanation && typeof projection.explanation === 'object'
    ? projection.explanation as Record<string, unknown>
    : null;
  const derivedPrimaryReason = typeof explanation?.whyNow === 'string'
    ? explanation.whyNow
    : typeof explanation?.whyReviewBacked === 'string'
      ? explanation.whyReviewBacked
      : typeof explanation?.whyNotOrdinaryArtifact === 'string'
        ? explanation.whyNotOrdinaryArtifact
        : typeof explanation?.whyHighThreshold === 'string'
          ? explanation.whyHighThreshold
          : null;
  const derivedRationale = typeof explanation?.whyHighThreshold === 'string'
    ? explanation.whyHighThreshold
    : typeof explanation?.whyNotOrdinaryArtifact === 'string'
      ? explanation.whyNotOrdinaryArtifact
      : typeof explanation?.whyReviewBacked === 'string' && explanation.whyReviewBacked !== derivedPrimaryReason
        ? explanation.whyReviewBacked
        : null;
  const derivedReviewBacked = explanation?.reviewBacked === true;

  const summary = projection.explanationSummary;
  const primaryReason = summary?.primaryReason ?? derivedPrimaryReason;
  const rationale = summary?.rationale ?? derivedRationale;
  const reviewBacked = summary?.reviewBacked ?? derivedReviewBacked;

  if (!primaryReason && !rationale && !reviewBacked) {
    return null;
  }

  return {
    primaryReason,
    rationale,
    reviewBacked,
  };
}

export function buildProjectionExplanationSummary(
  projection: Pick<EventNode, 'explanation'> | Pick<ContinuityRecord, 'explanation'>,
): ProjectionExplanationSummary | null {
  return getProjectionExplanationSummary({
    explanation: projection.explanation,
    explanationSummary: null,
  });
}

export interface PromotionExplanationRow {
  label: string;
  value: string;
}

export function getProjectionExplanationRows(
  projection: Pick<EventNode, 'explanation' | 'explanationSummary'> | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'>,
): PromotionExplanationRow[] {
  const summary = getProjectionExplanationSummary(projection);
  const rows: PromotionExplanationRow[] = [];

  if (summary?.primaryReason) {
    rows.push({ label: '主要原因', value: summary.primaryReason });
  }
  if (summary?.rationale) {
    rows.push({ label: '提升理由', value: summary.rationale });
  }
  if (summary?.reviewBacked) {
    rows.push({ label: '治理依据', value: 'review-backed' });
  }

  return rows;
}

function isProjectionExplanationSource(
  item: Pick<SoulAction, 'promotionSummary' | 'governanceReason'>
    | Pick<EventNode, 'explanation' | 'explanationSummary'>
    | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'>,
): item is Pick<EventNode, 'explanation' | 'explanationSummary'> | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'> {
  return 'explanation' in item;
}

export function getPromotionExplanationRows(
  item: Pick<SoulAction, 'promotionSummary' | 'governanceReason'>
    | Pick<EventNode, 'explanation' | 'explanationSummary'>
    | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'>,
): PromotionExplanationRow[] {
  if ('promotionSummary' in item) {
    const summary = item.promotionSummary;
    const rows: PromotionExplanationRow[] = [];
    if (summary?.sourceSummary) {
      rows.push({ label: '来源摘要', value: summary.sourceSummary });
    }
    if (summary?.primaryReason) {
      rows.push({ label: '主要原因', value: summary.primaryReason });
    }
    if (summary?.rationale) {
      rows.push({ label: '提升理由', value: summary.rationale });
    }
    if (summary?.reviewBacked) {
      rows.push({ label: '治理依据', value: 'review-backed' });
    }
    if (!rows.length && item.governanceReason) {
      rows.push({ label: '治理理由', value: item.governanceReason });
    }
    return rows;
  }

  return isProjectionExplanationSource(item) ? getProjectionExplanationRows(item) : [];
}

export function formatProjectionExplanationSummary(
  projection: Pick<EventNode, 'explanation' | 'explanationSummary'> | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'>,
): string | null {
  const summary = getProjectionExplanationSummary(projection);
  if (!summary) {
    return null;
  }

  const segments = [summary.primaryReason, summary.rationale, summary.reviewBacked ? 'review-backed' : null].filter(Boolean);
  return segments.length ? segments.join(' · ') : null;
}

export function formatProjectionExplanationDetails(
  projection: Pick<EventNode, 'explanation' | 'explanationSummary'> | Pick<ContinuityRecord, 'explanation' | 'explanationSummary'>,
): string[] {
  return getProjectionExplanationRows(projection).map((row) => `${row.label}：${row.value}`);
}

export function getProjectionContinuitySummary(
  record: Pick<ContinuityRecord, 'continuity'>,
): ProjectionContinuitySummary | null {
  const continuity = record.continuity && typeof record.continuity === 'object'
    ? record.continuity as Record<string, unknown>
    : null;
  if (!continuity) {
    return null;
  }

  const anchor = typeof continuity.anchor === 'string' ? continuity.anchor : null;
  const scope = typeof continuity.scope === 'string' ? continuity.scope : null;
  if (!anchor && !scope) {
    return null;
  }

  return {
    anchor,
    scope,
  };
}

export function formatProjectionContinuitySummary(
  record: Pick<ContinuityRecord, 'continuity'>,
): string | null {
  const summary = getProjectionContinuitySummary(record);
  if (!summary) {
    return null;
  }

  const segments = [summary.anchor, summary.scope ? `scope ${summary.scope}` : null].filter(Boolean);
  return segments.length ? segments.join(' · ') : null;
}

export function formatProjectionContinuityDetails(
  record: Pick<ContinuityRecord, 'continuity'>,
): string[] {
  const continuity = record.continuity && typeof record.continuity === 'object'
    ? record.continuity as Record<string, unknown>
    : null;
  if (!continuity) {
    return [];
  }

  const detailEntries: Array<[string, string | null]> = [
    ['锚点', typeof continuity.anchor === 'string' ? continuity.anchor : null],
    ['范围', typeof continuity.scope === 'string' ? continuity.scope : null],
    ['主张', typeof continuity.claim === 'string' ? continuity.claim : null],
    ['趋势', typeof continuity.trend === 'string' ? continuity.trend : null],
  ];

  return detailEntries
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}：${value}`);
}

export interface ReintegrationPromotionSource {
  sourceNoteId: string;
  sourceReintegrationId: string;
}

export interface ReintegrationProjectionSource {
  sourceNoteId: string | null;
  sourceReintegrationId: string;
}

export function getPromotionSourceForReintegration(record: Pick<ReintegrationRecord, 'id' | 'sourceNoteId'>): ReintegrationPromotionSource {
  return {
    sourceNoteId: record.sourceNoteId ?? record.id,
    sourceReintegrationId: record.id,
  };
}

export function getPromotionProjectionSourceForReintegration(record: Pick<ReintegrationRecord, 'id' | 'sourceNoteId'>): ReintegrationProjectionSource {
  return {
    sourceNoteId: record.sourceNoteId,
    sourceReintegrationId: record.id,
  };
}

export function formatSoulActionPromotionSummary(
  action: Pick<SoulAction, 'promotionSummary'>,
): string | null {
  const summary = action.promotionSummary;
  if (!summary) {
    return null;
  }

  const segments = [
    summary.projectionKind === 'event'
      ? '投射 EventNode'
      : summary.projectionKind === 'continuity'
        ? '投射 ContinuityRecord'
        : null,
    summary.reviewBacked ? 'review-backed' : null,
    summary.sourceSummary,
    summary.primaryReason,
    summary.rationale,
  ].filter(Boolean);

  return segments.length ? segments.join(' · ') : null;
}

export function formatSoulActionSourceLabel(
  action: Pick<SoulAction, 'sourceNoteId' | 'sourceReintegrationId'>,
): string {
  if (action.sourceReintegrationId && action.sourceNoteId) {
    return `Reintegration ${action.sourceReintegrationId} (source note ${action.sourceNoteId})`;
  }
  if (action.sourceReintegrationId) {
    return `Reintegration ${action.sourceReintegrationId}`;
  }
  return `source note ${action.sourceNoteId}`;
}

export function formatSoulActionKindLabel(actionKind: SoulAction['actionKind'] | 'ask_followup_question'): string {
  if (actionKind === 'ask_followup_question') return '提出追问';
  if (actionKind === 'extract_tasks') return '提取任务';
  if (actionKind === 'update_persona_snapshot') return '更新 Persona Snapshot';
  if (actionKind === 'create_event_node') return '创建 Event Node';
  if (actionKind === 'promote_event_node') return '提升 Event Node';
  if (actionKind === 'promote_continuity_record') return '提升 Continuity Record';
  return actionKind;
}

export function getSoulActionGovernanceMessage(
  action: Pick<SoulAction, 'actionKind'>,
  operation: 'approved' | 'deferred' | 'discarded',
): string {
  const actionLabel = formatSoulActionKindLabel(action.actionKind);
  const operationLabel = operation === 'approved'
    ? '已批准'
    : operation === 'deferred'
      ? '已延后'
      : '已丢弃';
  return `${actionLabel} ${operationLabel}`;
}

export interface SoulActionResponse {
  soulAction: SoulAction;
}

export interface SoulActionDispatchExecutionSummary {
  objectType: 'event_node' | 'continuity_record' | 'worker_task' | null;
  objectId: string | null;
  operation: 'created' | 'updated' | 'enqueued' | null;
  summary: string | null;
}

export interface DispatchSoulActionResponse {
  result: {
    dispatched: boolean;
    reason: string;
    soulActionId?: string | null;
    workerTaskId?: string | null;
    executionSummary?: SoulActionDispatchExecutionSummary | null;
  };
  soulAction: SoulAction | null;
  task: WorkerTask | null;
  eventNode: EventNode | null;
  continuityRecord: ContinuityRecord | null;
}

export function getDispatchExecutionMessage(
  result: Pick<DispatchSoulActionResponse['result'], 'reason' | 'executionSummary'>,
): string {
  const summary = result.executionSummary;
  if (!summary?.summary) {
    return result.reason;
  }

  const objectLabel = summary.objectType === 'event_node'
    ? 'Event Node'
    : summary.objectType === 'continuity_record'
      ? 'Continuity Record'
      : summary.objectType === 'worker_task'
        ? 'Worker Task'
        : null;
  const operationLabel = summary.operation === 'created'
    ? '已创建'
    : summary.operation === 'updated'
      ? '已更新'
      : summary.operation === 'enqueued'
        ? '已入队'
        : null;

  if (objectLabel && operationLabel && summary.objectId) {
    return `${operationLabel} ${objectLabel} · ${summary.summary} (${summary.objectId})`;
  }

  return summary.summary;
}

export function formatSoulActionOutcomeSummary(
  action: Pick<SoulAction, 'workerTaskId' | 'resultSummary' | 'executionStatus' | 'error' | 'executionSummary'>,
): string | null {
  if (action.error) {
    return `执行错误：${action.error}`;
  }

  if (action.executionSummary) {
    return getDispatchExecutionMessage({
      reason: action.resultSummary ?? action.executionSummary.summary ?? 'approved soul action dispatched through worker host',
      executionSummary: action.executionSummary,
    });
  }

  if (!action.resultSummary) {
    if (action.executionStatus === 'running') {
      return '执行中';
    }
    if (action.executionStatus === 'pending' && action.workerTaskId) {
      return `已入队 Worker Task · ${action.workerTaskId}`;
    }
    return null;
  }

  if (action.workerTaskId && action.executionStatus !== 'succeeded') {
    return `${action.resultSummary} · Worker Task ${action.workerTaskId}`;
  }

  return action.resultSummary;
}

export function getSoulActionPromotionSummary(
  action: Pick<SoulAction, 'actionKind' | 'sourceReintegrationId' | 'governanceReason'>,
  record?: Pick<ReintegrationRecord, 'summary' | 'reviewReason'> | null,
): SoulActionPromotionSummary | null {
  if (!action.sourceReintegrationId) {
    return null;
  }

  const projectionKind = action.actionKind === 'promote_continuity_record'
    ? 'continuity'
    : action.actionKind === 'promote_event_node' || action.actionKind === 'create_event_node'
      ? 'event'
      : null;
  if (!projectionKind) {
    return null;
  }

  const sourceSummary = record?.summary ?? null;
  const primaryReason = record?.reviewReason ?? action.governanceReason ?? null;
  const rationale = projectionKind === 'event'
    ? 'review-backed PR6 promotion'
    : projectionKind === 'continuity'
      ? 'PR6 continuity promotion'
      : null;
  return {
    sourceSummary,
    primaryReason,
    rationale,
    reviewBacked: true,
    projectionKind,
  };
}

export interface ListReintegrationRecordsResponse {
  reintegrationRecords: ReintegrationRecord[];
  filters: {
    reviewStatus?: ReintegrationRecord['reviewStatus'];
    sourceNoteId?: string;
  };
}

export interface ReintegrationReviewRequest {
  reason?: string | null;
}

export interface ReintegrationOutcomeSummary {
  signalKind: ReintegrationSignalKind;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  suggestedActionKinds: SoulActionKind[];
}

export interface ReintegrationSummaryContext extends ReintegrationOutcomeSummary {
  summary: string;
}

export interface ReintegrationEvidenceSummary {
  taskId: string;
  taskType: WorkerTaskType;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  sourceReintegrationId: string | null;
  resultSummary: string | null;
  error: string | null;
  outputNotePaths: string[];
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
  nextActionCandidate: ExtractTaskReintegrationEvidenceItem | null;
  personaSnapshotId: string | null;
  personaSnapshotSummary: string | null;
  personaContentPreview: string | null;
}

export interface ActionOutcomePacket {
  taskId: string;
  taskType: WorkerTaskType;
  status: TerminalWorkerTaskStatus;
  resultSummary: string | null;
  error: string | null;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  sourceReintegrationId: string | null;
  outputNotePaths: string[];
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
}

export interface ReintegrationNextActionSummary {
  createdCount: number | null;
  candidateTitle: string | null;
  candidatePriority: string | null;
  candidateDue: string | null;
  candidateOutputNoteId: string | null;
}

export function getSuggestedSoulActionKindsForReintegrationSignal(
  signalKind: ReintegrationSignalKind,
): SoulActionKind[] {
  return signalKind === 'task_extraction_reintegration'
    ? ['create_event_node']
    : signalKind === 'persona_snapshot_reintegration'
      || signalKind === 'daily_report_reintegration'
      || signalKind === 'weekly_report_reintegration'
      ? ['promote_event_node', 'promote_continuity_record']
      : [];
}

export function getReintegrationOutcomeSummary(
  record: Pick<ReintegrationRecord, 'signalKind' | 'target' | 'strength'>,
): ReintegrationOutcomeSummary {
  return {
    signalKind: record.signalKind,
    target: record.target,
    strength: record.strength,
    suggestedActionKinds: getSuggestedSoulActionKindsForReintegrationSignal(record.signalKind),
  };
}

export type ReintegrationNoPlanReason =
  | 'no_suggested_actions'
  | 'next_action_evidence_only'
  | 'no_outcome_signal';

export interface ReintegrationOutcomeDisplaySummary {
  plannedActionCount: number;
  nextActionCreatedCount: number | null;
  nextActionText: string | null;
  hasNextActionEvidence: boolean;
  noPlanReason: ReintegrationNoPlanReason | null;
}

export interface ReintegrationOutcomeStripRow {
  label: string;
  value: string | number;
}

export function getReintegrationOutcomeStripRows(display: ReintegrationOutcomeDisplaySummary | null | undefined): ReintegrationOutcomeStripRow[] {
  if (!display) {
    return [];
  }

  const rows: ReintegrationOutcomeStripRow[] = [];
  if (display.nextActionCreatedCount !== null) {
    rows.push({ label: '产出行动项', value: display.nextActionCreatedCount });
  }
  if (display.nextActionText) {
    rows.push({ label: '下一步候选', value: display.nextActionText });
  }
  return rows;
}

export interface ReintegrationOutcomeDetailRow {
  label: string;
  value: string | number;
}

export function getReintegrationOutcomeNoPlanReason(display: ReintegrationOutcomeDisplaySummary | null | undefined): string | null {
  if (!display || display.plannedActionCount > 0) {
    return null;
  }
  return formatReintegrationNoPlanReason(display.noPlanReason);
}

export function getReintegrationOutcomeDetailRows(display: ReintegrationOutcomeDisplaySummary | null | undefined): ReintegrationOutcomeDetailRow[] {
  if (!display) {
    return [];
  }

  const rows: ReintegrationOutcomeDetailRow[] = [
    { label: '已规划候选动作', value: display.plannedActionCount },
  ];

  if (display.nextActionCreatedCount !== null) {
    rows.push({ label: '产出行动项', value: display.nextActionCreatedCount });
  }
  if (display.nextActionText) {
    rows.push({ label: '下一步候选', value: display.nextActionText });
  }

  const noPlanReasonText = getReintegrationOutcomeNoPlanReason(display);
  if (noPlanReasonText) {
    rows.push({ label: '未进入规划原因', value: noPlanReasonText });
  }

  return rows;
}

export function formatReintegrationOutcomeNextActionText(summary: ReintegrationNextActionSummary | null | undefined): string | null {
  if (!summary?.candidateTitle) {
    return null;
  }

  const suffix = [summary.candidatePriority, summary.candidateDue ? `due ${summary.candidateDue}` : null]
    .filter(Boolean)
    .join(' · ');
  return suffix ? `${summary.candidateTitle}（${suffix}）` : summary.candidateTitle;
}

export function getReintegrationOutcomeDisplaySummary(
  result: {
    soulActions: Pick<SoulAction, 'id'>[];
    nextActionSummary?: ReintegrationNextActionSummary | null;
  },
  fallbackRecord?: Pick<ReintegrationRecord, 'evidence' | 'signalKind'> | null,
): ReintegrationOutcomeDisplaySummary {
  const plannedActionCount = result.soulActions.length;
  const nextActionSummary = result.nextActionSummary ?? (fallbackRecord ? getReintegrationNextActionSummary(fallbackRecord) : null);
  const nextActionText = formatReintegrationOutcomeNextActionText(nextActionSummary);
  const hasNextActionEvidence = Boolean(nextActionSummary?.createdCount || nextActionText);
  const suggestedActionKinds = fallbackRecord ? getSuggestedSoulActionKindsForReintegrationSignal(fallbackRecord.signalKind) : [];

  return {
    plannedActionCount,
    nextActionCreatedCount: nextActionSummary?.createdCount ?? null,
    nextActionText,
    hasNextActionEvidence,
    noPlanReason: plannedActionCount > 0
      ? null
      : hasNextActionEvidence
        ? 'next_action_evidence_only'
        : suggestedActionKinds.length > 0
          ? 'no_outcome_signal'
          : 'no_suggested_actions',
  };
}

export function formatReintegrationNoPlanReason(reason: ReintegrationNoPlanReason | null): string | null {
  return reason === 'next_action_evidence_only'
    ? '已有 next-action evidence，但尚未形成可规划动作'
    : reason === 'no_outcome_signal'
      ? '当前没有足够 outcome signal 进入可规划状态'
      : reason === 'no_suggested_actions'
        ? '该类回流当前不生成后续治理动作'
        : null;
}

export type ReintegrationReviewOperation = 'accept' | 'reject' | 'plan';

export function getReintegrationReviewMessage(
  operation: ReintegrationReviewOperation,
  display?: ReintegrationOutcomeDisplaySummary | null,
): string {
  if (operation === 'reject') {
    return '已拒绝该回流记录';
  }
  if (!display) {
    return operation === 'accept' ? '已接受该回流记录' : '当前没有可规划的候选动作';
  }
  return operation === 'accept'
    ? getAcceptReintegrationMessageFromDisplaySummary(display)
    : getPlanReintegrationMessageFromDisplaySummary(display);
}

export function getAcceptReintegrationMessageFromDisplaySummary(display: ReintegrationOutcomeDisplaySummary): string {
  if (display.plannedActionCount) {
    return `已接受并自动规划 ${display.plannedActionCount} 条候选动作`;
  }

  const reasonText = formatReintegrationNoPlanReason(display.noPlanReason);
  if (display.hasNextActionEvidence) {
    return `已接受，但${reasonText ?? '当前没有可规划的候选动作'}${display.nextActionText ? ` · 已记录 next-action evidence：${display.nextActionText}` : ' · 已记录 next-action evidence'}`;
  }

  return `已接受，但${reasonText ?? '当前没有可规划的候选动作'}`;
}

export function getAcceptReintegrationMessage(
  result: {
    soulActions: Pick<SoulAction, 'id'>[];
    nextActionSummary?: ReintegrationNextActionSummary | null;
  },
  fallbackRecord?: Pick<ReintegrationRecord, 'evidence' | 'signalKind'> | null,
): string {
  return getAcceptReintegrationMessageFromDisplaySummary(
    getReintegrationOutcomeDisplaySummary(result, fallbackRecord),
  );
}

export function getRejectReintegrationMessage(): string {
  return '已拒绝该回流记录';
}

export function getPlanReintegrationMessageFromDisplaySummary(display: ReintegrationOutcomeDisplaySummary): string {
  if (display.plannedActionCount > 0) {
    return display.nextActionText
      ? `已规划 ${display.plannedActionCount} 条候选动作 · 下一步候选：${display.nextActionText}`
      : `已规划 ${display.plannedActionCount} 条候选动作`;
  }

  const reasonText = formatReintegrationNoPlanReason(display.noPlanReason);
  if (display.hasNextActionEvidence) {
    return `${reasonText ?? '当前没有可规划的候选动作'}${display.nextActionText ? ` · 已记录 next-action evidence：${display.nextActionText}` : ' · 已记录 next-action evidence'}`;
  }

  return reasonText ?? '当前没有可规划的候选动作';
}

export function getPlanReintegrationMessage(
  result: {
    soulActions: Pick<SoulAction, 'id'>[];
    nextActionSummary?: ReintegrationNextActionSummary | null;
  },
  fallbackRecord?: Pick<ReintegrationRecord, 'evidence' | 'signalKind'> | null,
): string {
  return getPlanReintegrationMessageFromDisplaySummary(
    getReintegrationOutcomeDisplaySummary(result, fallbackRecord),
  );
}

export function getReintegrationExtractTaskCount(record: Pick<ReintegrationRecord, 'evidence'>): number | null {
  const evidence = record.evidence && typeof record.evidence === 'object'
    ? record.evidence as Record<string, unknown>
    : null;
  const count = evidence?.extractTaskCreated;
  return typeof count === 'number' ? count : null;
}

export function normalizeReintegrationNextActionCandidate(candidate: unknown): ExtractTaskReintegrationEvidenceItem | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const normalized = candidate as Record<string, unknown>;
  if (typeof normalized.title !== 'string') {
    return null;
  }

  return {
    title: normalized.title,
    dimension: typeof normalized.dimension === 'string' ? normalized.dimension : '',
    priority: typeof normalized.priority === 'string' ? normalized.priority : '',
    due: typeof normalized.due === 'string' ? normalized.due : null,
    filePath: typeof normalized.filePath === 'string' ? normalized.filePath : '',
    outputNoteId: typeof normalized.outputNoteId === 'string' ? normalized.outputNoteId : null,
  };
}

export function pickReintegrationNextActionCandidate(
  candidates: ReadonlyArray<ExtractTaskReintegrationEvidenceItem | null | undefined>,
): ExtractTaskReintegrationEvidenceItem | null {
  const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
  } as const;

  const items = candidates.filter((item): item is ExtractTaskReintegrationEvidenceItem => !!item);
  if (!items.length) {
    return null;
  }

  return [...items].sort((left, right) => {
    const priorityCompare = (priorityRank[left.priority as keyof typeof priorityRank] ?? 99)
      - (priorityRank[right.priority as keyof typeof priorityRank] ?? 99);
    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    const leftDue = left.due ?? '9999-12-31';
    const rightDue = right.due ?? '9999-12-31';
    const dueCompare = leftDue.localeCompare(rightDue);
    if (dueCompare !== 0) {
      return dueCompare;
    }

    return left.filePath.localeCompare(right.filePath);
  })[0] ?? null;
}

export function getReintegrationNextActionCandidate(record: Pick<ReintegrationRecord, 'evidence'>): ExtractTaskReintegrationEvidenceItem | null {
  const evidence = record.evidence && typeof record.evidence === 'object'
    ? record.evidence as Record<string, unknown>
    : null;
  return normalizeReintegrationNextActionCandidate(evidence?.nextActionCandidate);
}

export function getReintegrationExtractTaskItems(record: Pick<ReintegrationRecord, 'evidence'>): ExtractTaskReintegrationEvidenceItem[] {
  const evidence = record.evidence && typeof record.evidence === 'object'
    ? record.evidence as Record<string, unknown>
    : null;
  const items = evidence?.extractTaskItems;
  return Array.isArray(items)
    ? items.filter((item): item is ExtractTaskReintegrationEvidenceItem => !!item && typeof item === 'object' && typeof (item as { filePath?: unknown }).filePath === 'string')
    : [];
}

export function getReintegrationNextActionSummary(record: Pick<ReintegrationRecord, 'evidence'>): ReintegrationNextActionSummary | null {
  const createdCount = getReintegrationExtractTaskCount(record);
  const candidate = getReintegrationNextActionCandidate(record);
  if (createdCount === null && !candidate) {
    return null;
  }

  return {
    createdCount,
    candidateTitle: candidate?.title ?? null,
    candidatePriority: candidate?.priority ?? null,
    candidateDue: candidate?.due ?? null,
    candidateOutputNoteId: candidate?.outputNoteId ?? null,
  };
}

export interface AcceptReintegrationRecordResponse {
  reintegrationRecord: ReintegrationRecord;
  soulActions: SoulAction[];
  nextActionSummary: ReintegrationNextActionSummary | null;
  displaySummary: ReintegrationOutcomeDisplaySummary;
}

export interface RejectReintegrationRecordResponse {
  reintegrationRecord: ReintegrationRecord;
}

export interface PlanReintegrationPromotionsResponse {
  reintegrationRecord: ReintegrationRecord;
  soulActions: SoulAction[];
  nextActionSummary: ReintegrationNextActionSummary | null;
  displaySummary: ReintegrationOutcomeDisplaySummary;
}
