import { createOrReuseSoulAction } from './soulActions.js';
import { type ReintegrationRecord } from './reintegrationRecords.js';

export function planPromotionSoulActions(record: ReintegrationRecord) {
  if (record.reviewStatus !== 'accepted') {
    throw new Error('Only accepted reintegration records can plan promotions');
  }

  const sourceNoteId = record.id;
  const planned = [] as ReturnType<typeof createOrReuseSoulAction>[];

  if (['daily_report_reintegration', 'weekly_report_reintegration', 'persona_snapshot_reintegration'].includes(record.signalKind)) {
    planned.push(createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'promote_event_node',
      governanceReason: `PR6 promotion planned from reintegration record ${record.id}`,
    }));
  }

  if (['daily_report_reintegration', 'weekly_report_reintegration', 'persona_snapshot_reintegration'].includes(record.signalKind)) {
    planned.push(createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'promote_continuity_record',
      governanceReason: `PR6 promotion planned from reintegration record ${record.id}`,
    }));
  }

  return planned;
}
