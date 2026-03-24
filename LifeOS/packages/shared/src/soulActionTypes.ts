// ── Soul Action Types ──────────────────────────────────

import type { SoulActionKind, SoulActionGovernanceStatus, SoulActionExecutionStatus } from './core.js';
import type { WorkerTask } from './workerTypes.js';
import type { EventNode, ContinuityRecord } from './projectionTypes.js';
import type { ReintegrationRecord } from './reintegrationTypes.js';

export interface SoulActionPromotionSummary {
  sourceSummary: string | null;
  primaryReason: string | null;
  rationale: string | null;
  reviewBacked: boolean;
  projectionKind: 'event' | 'continuity' | null;
}

export interface SoulActionDispatchExecutionSummary {
  objectType: 'event_node' | 'continuity_record' | 'worker_task' | null;
  objectId: string | null;
  operation: 'created' | 'updated' | 'enqueued' | null;
  summary: string | null;
}

export interface SoulAction {
  id: string;
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
  governanceStatus: SoulActionGovernanceStatus;
  executionStatus: SoulActionExecutionStatus;
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

// ── Soul Action Responses ──────────────────────────────

export interface SoulActionResponse {
  soulAction: SoulAction;
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

// ── Soul Action Functions ──────────────────────────────

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

export function formatSoulActionKindLabel(actionKind: SoulAction['actionKind'] | 'ask_followup_question'): string {
  if (actionKind === 'ask_followup_question') return '提出追问';
  if (actionKind === 'extract_tasks') return '提取任务';
  if (actionKind === 'update_persona_snapshot') return '更新 Persona Snapshot';
  if (actionKind === 'create_event_node') return '创建 Event Node';
  if (actionKind === 'promote_event_node') return '提升 Event Node';
  if (actionKind === 'promote_continuity_record') return '提升 Continuity Record';
  if (actionKind === 'launch_daily_report') return '生成日报';
  if (actionKind === 'launch_weekly_report') return '生成周报';
  if (actionKind === 'launch_openclaw_task') return '执行 OpenClaw 任务';
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
