import { getReintegrationRecord } from './reintegrationReview.js';
import { getEventNodeBySourceReintegrationId, upsertEventNode } from './eventNodes.js';
import { getContinuityRecordBySourceReintegrationId, upsertContinuityRecord } from './continuityRecords.js';
import { assertAcceptedPromotionReintegration, getContinuityKindForReintegrationSignal, getEventKindForReintegrationSignal, getEventTitleForReintegrationSignal } from './pr6PromotionRules.js';
import { resolveSoulActionSourceReintegrationId, type SoulAction } from './types.js';

export interface PromotionExecutionResult {
  summary: string;
}

export function executePromotionSoulAction(action: SoulAction): PromotionExecutionResult {
  const sourceReintegrationId = resolveSoulActionSourceReintegrationId(action);
  if (!sourceReintegrationId) {
    throw new Error('PR6 promotion soul action requires sourceReintegrationId or reintegration-record sourceNoteId');
  }

  const record = getReintegrationRecord(sourceReintegrationId);
  if (!record) {
    throw new Error('Source reintegration record not found');
  }

  assertAcceptedPromotionReintegration(record, 'PR6 promotion requires accepted reintegration review');

  if (action.actionKind === 'promote_event_node' || action.actionKind === 'create_event_node') {
    const existing = getEventNodeBySourceReintegrationId(record.id);
    const eventKind = getEventKindForReintegrationSignal(record.signalKind);
    const title = getEventTitleForReintegrationSignal(record.signalKind);
    const node = upsertEventNode({
      sourceReintegrationId: record.id,
      sourceNoteId: record.sourceNoteId,
      sourceSoulActionId: record.soulActionId,
      promotionSoulActionId: action.id,
      eventKind,
      title,
      summary: record.summary,
      threshold: 'high',
      status: 'active',
      evidence: record.evidence,
      explanation: { whyHighThreshold: 'review-backed PR6 promotion', whyNow: record.summary, reviewBacked: true },
      occurredAt: record.updatedAt,
    });
    return { summary: existing ? `已更新 event node: ${node.id}` : `已创建 event node: ${node.id}` };
  }

  if (action.actionKind === 'promote_continuity_record') {
    const existing = getContinuityRecordBySourceReintegrationId(record.id);
    const continuityKind = getContinuityKindForReintegrationSignal(record.signalKind);
    const continuity = upsertContinuityRecord({
      sourceReintegrationId: record.id,
      sourceNoteId: record.sourceNoteId,
      sourceSoulActionId: record.soulActionId,
      promotionSoulActionId: action.id,
      continuityKind,
      target: record.target,
      strength: 'medium',
      summary: record.summary,
      continuity: {
        anchor: record.summary,
        observationWindow: 'single_reviewed_signal',
        claim: record.summary,
        scope: continuityKind === 'persona_direction'
          ? 'persona'
          : continuityKind === 'daily_rhythm'
            ? 'daily'
            : 'weekly',
      },
      evidence: record.evidence,
      explanation: { whyNotOrdinaryArtifact: 'PR6 continuity promotion', whyReviewBacked: record.reviewReason ?? 'accepted reintegration record', reviewBacked: true },
      recordedAt: record.updatedAt,
    });
    return { summary: existing ? `已更新 continuity record: ${continuity.id}` : `已创建 continuity record: ${continuity.id}` };
  }

  throw new Error(`Unsupported PR6 promotion action kind: ${action.actionKind}`);
}
