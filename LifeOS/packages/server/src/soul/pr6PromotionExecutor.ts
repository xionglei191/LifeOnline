import { getReintegrationRecord } from './reintegrationReview.js';
import { getEventNodeBySourceReintegrationId, upsertEventNode } from './eventNodes.js';
import { getContinuityRecordBySourceReintegrationId, upsertContinuityRecord } from './continuityRecords.js';
import { assertAcceptedPromotionReintegration, buildContinuityPromotionInput, buildEventNodePromotionInput } from './pr6PromotionRules.js';
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
    const node = upsertEventNode(buildEventNodePromotionInput(record, action.id));
    return { summary: existing ? `已更新 event node: ${node.id}` : `已创建 event node: ${node.id}` };
  }

  if (action.actionKind === 'promote_continuity_record') {
    const existing = getContinuityRecordBySourceReintegrationId(record.id);
    const continuity = upsertContinuityRecord(buildContinuityPromotionInput(record, action.id));
    return { summary: existing ? `已更新 continuity record: ${continuity.id}` : `已创建 continuity record: ${continuity.id}` };
  }

  throw new Error(`Unsupported PR6 promotion action kind: ${action.actionKind}`);
}
