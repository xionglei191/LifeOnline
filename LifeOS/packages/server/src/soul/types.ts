import {
  SUPPORTED_SOUL_ACTION_KINDS,
  type SoulActionKind,
  SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES,
  type SoulActionGovernanceStatus,
  SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES,
  type SoulActionExecutionStatus,
  normalizeSoulActionSourceFilters as normalizeSharedSoulActionSourceFilters,
  type ListSoulActionsResponse as SharedListSoulActionsResponse,
  type SoulActionPromotionSummary,
} from '@lifeos/shared';

// Re-export core types from shared (single source of truth)
export {
  SUPPORTED_SOUL_ACTION_KINDS,
  type SoulActionKind,
  SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES,
  type SoulActionGovernanceStatus,
  SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES,
  type SoulActionExecutionStatus,
};

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

// Server-internal SoulAction — mirrors the shared interface without the
// presentation-only `executionSummary` field, and maps 1-to-1 with the DB row.
export interface SoulAction {
  id: string;
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
  governanceStatus: SoulActionGovernanceStatus;
  executionStatus: SoulActionExecutionStatus;
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

