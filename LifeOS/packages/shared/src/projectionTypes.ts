// ── Projection Types (EventNode + ContinuityRecord) ───

import type { ContinuityTarget } from './core.js';
import type { SoulAction } from './soulActionTypes.js';
import type { ReintegrationRecord } from './reintegrationTypes.js';

export type EventKind = 'weekly_reflection' | 'persona_shift' | 'milestone_report';
export type ContinuityRecordKind = 'persona_direction' | 'daily_rhythm' | 'weekly_theme';

export interface ProjectionExplanationSummary {
  primaryReason: string | null;
  rationale: string | null;
  reviewBacked: boolean;
}

export interface ProjectionContinuitySummary {
  anchor: string | null;
  scope: string | null;
}

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

// ── Projection Promotion Interfaces ────────────────────

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

export interface ReintegrationPromotionSource {
  sourceNoteId: string;
  sourceReintegrationId: string;
}

export interface ReintegrationProjectionSource {
  sourceNoteId: string | null;
  sourceReintegrationId: string;
}

export interface PromotionExplanationRow {
  label: string;
  value: string;
}

// ── Projection Functions ───────────────────────────────

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

export function formatContinuityTargetLabel(record: Pick<ContinuityRecord, 'target'>): string {
  return record.target === 'source_note'
    ? '源笔记'
    : record.target === 'derived_outputs'
      ? '派生产物'
      : '任务记录';
}

export function formatContinuityStrengthLabel(record: { strength: 'low' | 'medium' }): string {
  return record.strength === 'medium' ? '中' : '低';
}

export function buildEventPromotionExplanation(
  record: Pick<ReintegrationRecord, 'summary' | 'evidence'>,
): EventPromotionExplanation {
  const evidence = record.evidence && typeof record.evidence === 'object'
    ? record.evidence as Record<string, unknown>
    : null;
  const nextActionTitle = evidence?.nextActionCandidate
    && typeof evidence.nextActionCandidate === 'object'
    && typeof (evidence.nextActionCandidate as Record<string, unknown>).title === 'string'
    ? (evidence.nextActionCandidate as Record<string, unknown>).title as string
    : null;
  return {
    whyHighThreshold: 'review-backed PR6 promotion',
    whyNow: nextActionTitle ?? record.summary,
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
