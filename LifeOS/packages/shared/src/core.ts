// ── Core Enums and Primitives ──────────────────────────

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
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// Soul action enums (shared by soulActionTypes and reintegrationTypes)
export const SUPPORTED_SOUL_ACTION_KINDS = [
  'extract_tasks',
  'update_persona_snapshot',
  'create_event_node',
  'promote_event_node',
  'promote_continuity_record',
  'launch_daily_report',
  'launch_weekly_report',
  'launch_openclaw_task',
  'ask_followup_question',
  'persist_continuity_markdown',
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

export interface ApiErrorResponse {
  error: string;
}

export type ApiResponse<T> = T | ApiErrorResponse;
