import { generateSoulActionsFromOutcome as generateOutcomeContext } from './reintegrationOutcome.js';
import { createOrReuseSoulAction } from './soulActions.js';
import { type ReintegrationRecord } from './reintegrationRecords.js';
import { assertAcceptedPromotionReintegration, getPromotionGovernanceReason, getPromotionSourceForReintegration } from './pr6PromotionRules.js';

export function generateSoulActionsFromOutcome(record: ReintegrationRecord) {
  assertAcceptedPromotionReintegration(record);

  const { sourceNoteId, sourceReintegrationId } = getPromotionSourceForReintegration(record);
  const outcome = generateOutcomeContext(record);
  const planned = [] as ReturnType<typeof createOrReuseSoulAction>[];

  for (const actionKind of outcome.suggestedActionKinds) {
    planned.push(createOrReuseSoulAction({
      sourceNoteId,
      sourceReintegrationId,
      actionKind,
      governanceReason: getPromotionGovernanceReason(record),
    }));
  }

  return planned;
}

export function planPromotionSoulActions(record: ReintegrationRecord) {
  return generateSoulActionsFromOutcome(record);
}
