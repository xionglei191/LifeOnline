export const SUPPORTED_SOUL_ACTION_KINDS = [
  'extract_tasks',
  'update_persona_snapshot',
  'promote_event_node',
  'promote_continuity_record',
] as const;
export type SoulActionKind = typeof SUPPORTED_SOUL_ACTION_KINDS[number];

export const SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES = ['pending_review', 'approved', 'deferred', 'discarded'] as const;
export type SoulActionGovernanceStatus = typeof SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES[number];

export const SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES = ['not_dispatched', 'pending', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type SoulActionExecutionStatus = typeof SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES[number];

export type EventKind = 'weekly_reflection' | 'persona_shift' | 'milestone_report';
export type ContinuityRecordKind = 'persona_direction' | 'weekly_theme';

export interface SoulAction {
  id: string;
  sourceNoteId: string;
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
