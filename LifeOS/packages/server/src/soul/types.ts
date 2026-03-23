import {
  normalizeSoulActionSourceFilters as normalizeSharedSoulActionSourceFilters,
  type ListSoulActionsResponse as SharedListSoulActionsResponse,
  type SoulActionPromotionSummary,
} from '@lifeos/shared';

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

export type EventKind = 'weekly_reflection' | 'persona_shift' | 'milestone_report';
export type ContinuityRecordKind = 'persona_direction' | 'daily_rhythm' | 'weekly_theme';

export function resolveSoulActionSourceReintegrationId(action: Pick<SoulAction, 'sourceReintegrationId' | 'sourceNoteId'>): string | null {
  return action.sourceReintegrationId
    ?? (action.sourceNoteId.startsWith('reint:') ? action.sourceNoteId : null);
}

export function normalizeSoulActionSourceFilters(
  filters: Pick<SharedListSoulActionsResponse['filters'], 'sourceNoteId' | 'sourceReintegrationId'>,
  soulActions: Array<Pick<SoulAction, 'sourceReintegrationId'>>,
): Pick<SharedListSoulActionsResponse['filters'], 'sourceNoteId' | 'sourceReintegrationId'> {
  return normalizeSharedSoulActionSourceFilters(filters, soulActions);
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
