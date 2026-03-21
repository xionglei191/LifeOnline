import { createOrReuseSoulAction } from './soulActions.js';
import { type ReintegrationRecord } from './reintegrationRecords.js';
import { assertAcceptedPromotionReintegration, getPromotionActionKindsForReintegration } from './pr6PromotionRules.js';

export function planPromotionSoulActions(record: ReintegrationRecord) {
  assertAcceptedPromotionReintegration(record);

  const sourceNoteId = record.id;
  const sourceReintegrationId = record.id;
  const planned = [] as ReturnType<typeof createOrReuseSoulAction>[];

  for (const actionKind of getPromotionActionKindsForReintegration(record)) {
    planned.push(createOrReuseSoulAction({
      sourceNoteId,
      sourceReintegrationId,
      actionKind,
      governanceReason: `PR6 promotion planned from reintegration record ${record.id}`,
    }));
  }

  return planned;
}
