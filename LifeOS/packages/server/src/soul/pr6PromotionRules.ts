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

export function getContinuityKindForReintegrationSignal(signalKind: ReintegrationRecord['signalKind']): ContinuityRecordKind {
  const continuityKind = PR6_SIGNAL_CONTINUITY_KIND[signalKind];
  if (!continuityKind) {
    throw new Error(`Unsupported PR6 continuity promotion signal kind: ${signalKind}`);
  }
  return continuityKind;
}
