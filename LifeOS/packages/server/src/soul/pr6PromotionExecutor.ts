import { getReintegrationRecord } from './reintegrationReview.js';
import { getEventNodeBySourceReintegrationId, upsertEventNode, type EventNode } from './eventNodes.js';
import { getContinuityRecordBySourceReintegrationId, upsertContinuityRecord, type ContinuityRecord } from './continuityRecords.js';
import { assertAcceptedPromotionReintegration, buildContinuityPromotionInput, buildEventNodePromotionInput, getPromotionExecutionSummary } from './pr6PromotionRules.js';
import { resolveSoulActionSourceReintegrationId, type SoulAction } from './types.js';

export interface PromotionExecutionResult {
  summary: string;
  eventNode: EventNode | null;
  continuityRecord: ContinuityRecord | null;
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
    const node = upsertEventNode(buildEventNodePromotionInput(record, action.id));
    return {
      summary: getPromotionExecutionSummary(action.actionKind, node.id, Boolean(existing)),
      eventNode: node,
      continuityRecord: null,
    };
  }

  if (action.actionKind === 'promote_continuity_record') {
    const existing = getContinuityRecordBySourceReintegrationId(record.id);
    const continuity = upsertContinuityRecord(buildContinuityPromotionInput(record, action.id));
    return {
      summary: getPromotionExecutionSummary(action.actionKind, continuity.id, Boolean(existing)),
      eventNode: null,
      continuityRecord: continuity,
    };
  }

  throw new Error(`Unsupported PR6 promotion action kind: ${action.actionKind}`);
}
