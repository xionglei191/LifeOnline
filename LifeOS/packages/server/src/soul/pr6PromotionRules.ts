import type { ReintegrationRecord } from './reintegrationRecords.js';
import type { ContinuityRecordKind, EventKind, SoulActionKind } from './types.js';

const PR6_SIGNAL_ACTION_MATRIX: Partial<Record<ReintegrationRecord['signalKind'], SoulActionKind[]>> = {
  persona_snapshot_reintegration: ['promote_event_node', 'promote_continuity_record'],
  daily_report_reintegration: ['promote_event_node', 'promote_continuity_record'],
  weekly_report_reintegration: ['promote_event_node', 'promote_continuity_record'],
};

const PR6_SIGNAL_EVENT_KIND: Partial<Record<ReintegrationRecord['signalKind'], EventKind>> = {
  persona_snapshot_reintegration: 'persona_shift',
  daily_report_reintegration: 'milestone_report',
  weekly_report_reintegration: 'weekly_reflection',
};

const PR6_SIGNAL_EVENT_TITLE: Partial<Record<ReintegrationRecord['signalKind'], string>> = {
  persona_snapshot_reintegration: '人格切换事件',
  daily_report_reintegration: '里程碑事件',
  weekly_report_reintegration: '周回顾事件',
};

const PR6_SIGNAL_CONTINUITY_KIND: Partial<Record<ReintegrationRecord['signalKind'], ContinuityRecordKind>> = {
  persona_snapshot_reintegration: 'persona_direction',
  daily_report_reintegration: 'daily_rhythm',
  weekly_report_reintegration: 'weekly_theme',
};

export function assertAcceptedPromotionReintegration(record: ReintegrationRecord, errorMessage = 'Only accepted reintegration records can plan promotions'): void {
  if (record.reviewStatus !== 'accepted') {
    throw new Error(errorMessage);
  }
}

export function getPromotionSourceForReintegration(record: ReintegrationRecord): {
  sourceNoteId: string;
  sourceReintegrationId: string;
} {
  return {
    sourceNoteId: record.sourceNoteId ?? record.id,
    sourceReintegrationId: record.id,
  };
}

export function getPromotionActionKindsForReintegration(record: ReintegrationRecord): SoulActionKind[] {
  assertAcceptedPromotionReintegration(record);
  return [...(PR6_SIGNAL_ACTION_MATRIX[record.signalKind] ?? [])];
}

export function getEventKindForReintegrationSignal(signalKind: ReintegrationRecord['signalKind']): EventKind {
  const eventKind = PR6_SIGNAL_EVENT_KIND[signalKind];
  if (!eventKind) {
    throw new Error(`Unsupported PR6 event promotion signal kind: ${signalKind}`);
  }
  return eventKind;
}

export function getEventTitleForReintegrationSignal(signalKind: ReintegrationRecord['signalKind']): string {
  const title = PR6_SIGNAL_EVENT_TITLE[signalKind];
  if (!title) {
    throw new Error(`Unsupported PR6 event promotion title signal kind: ${signalKind}`);
  }
  return title;
}

export function getContinuityKindForReintegrationSignal(signalKind: ReintegrationRecord['signalKind']): ContinuityRecordKind {
  const continuityKind = PR6_SIGNAL_CONTINUITY_KIND[signalKind];
  if (!continuityKind) {
    throw new Error(`Unsupported PR6 continuity promotion signal kind: ${signalKind}`);
  }
  return continuityKind;
}

export function getContinuityScopeForKind(continuityKind: ContinuityRecordKind): 'persona' | 'daily' | 'weekly' {
  return continuityKind === 'persona_direction'
    ? 'persona'
    : continuityKind === 'daily_rhythm'
      ? 'daily'
      : 'weekly';
}

export function buildEventPromotionExplanation(record: ReintegrationRecord): Record<string, unknown> {
  return {
    whyHighThreshold: 'review-backed PR6 promotion',
    whyNow: record.summary,
    reviewBacked: true,
  };
}

export function buildContinuityPromotionExplanation(record: ReintegrationRecord): Record<string, unknown> {
  return {
    whyNotOrdinaryArtifact: 'PR6 continuity promotion',
    whyReviewBacked: record.reviewReason ?? 'accepted reintegration record',
    reviewBacked: true,
  };
}
