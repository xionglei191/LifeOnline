import { createOrReuseSoulAction } from './soulActions.js';
import { type ReintegrationRecord } from './reintegrationRecords.js';
import { assertAcceptedPromotionReintegration, getPromotionActionKindsForReintegration, getPromotionGovernanceReason, getPromotionSourceForReintegration } from './pr6PromotionRules.js';

export function planPromotionSoulActions(record: ReintegrationRecord) {
  assertAcceptedPromotionReintegration(record);

  const { sourceNoteId, sourceReintegrationId } = getPromotionSourceForReintegration(record);
  const planned = [] as ReturnType<typeof createOrReuseSoulAction>[];

  for (const actionKind of getPromotionActionKindsForReintegration(record)) {
    planned.push(createOrReuseSoulAction({
      sourceNoteId,
      sourceReintegrationId,
      actionKind,
      governanceReason: getPromotionGovernanceReason(record),
    }));
  }

  return planned;
}
