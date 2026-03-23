/**
 * Governance Handlers — soul actions, reintegration records, event nodes, continuity records
 */
import { Request, Response } from 'express';
import { getDb } from '../../db/client.js';
import { broadcastUpdate } from '../../index.js';
import { approveSoulAction, deferSoulAction, discardSoulAction, getSoulAction, isSupportedSoulActionKind, listSoulActions } from '../../soul/soulActions.js';
import { normalizeSoulActionSourceFilters } from '../../soul/types.js';
import { dispatchApprovedSoulAction } from '../../soul/soulActionDispatcher.js';
import { listReintegrationRecords, acceptReintegrationRecordAndPlanPromotions, rejectReintegrationRecord, getReintegrationRecord, getReintegrationNextActionSummary, filterAcceptedProjectionReintegrationIds, hasAcceptedProjectionVisibility, listAcceptedProjectionReintegrationIds } from '../../soul/reintegrationReview.js';
import { planPromotionSoulActions } from '../../soul/reintegrationPromotionPlanner.js';
import { listEventNodes, getEventNodeBySourceReintegrationId, type EventNode } from '../../soul/eventNodes.js';
import { listContinuityRecords, getContinuityRecordBySourceReintegrationId, type ContinuityRecord } from '../../soul/continuityRecords.js';
import { buildProjectionExplanationSummary, getProjectionContinuitySummary, getReintegrationOutcomeDisplaySummary, getSoulActionPromotionSummary, type SoulActionDispatchExecutionSummary } from '@lifeos/shared';
import type { ApiResponse, ListSoulActionsResponse, SoulActionResponse, DispatchSoulActionResponse, ListEventNodesResponse, ListContinuityRecordsResponse, ListReintegrationRecordsResponse, ReintegrationReviewRequest, AcceptReintegrationRecordResponse, RejectReintegrationRecordResponse, PlanReintegrationPromotionsResponse, ReintegrationRecord } from '@lifeos/shared';

// ── Shared Helpers ─────────────────────────────────────

function parseSoulActionGovernanceStatus(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return ['pending_review', 'approved', 'deferred', 'discarded'].includes(normalized)
    ? normalized as 'pending_review' | 'approved' | 'deferred' | 'discarded'
    : undefined;
}

function parseSoulActionExecutionStatus(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return ['not_dispatched', 'pending', 'running', 'succeeded', 'failed', 'cancelled'].includes(normalized)
    ? normalized as 'not_dispatched' | 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
    : undefined;
}

function parseSoulActionKind(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return isSupportedSoulActionKind(normalized) ? normalized : undefined;
}

function getGovernanceReason(body: any): string | null {
  return typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
}

function getPersistedSoulActionExecutionSummary(soulAction: ReturnType<typeof getSoulAction> | null | undefined): SoulActionDispatchExecutionSummary | null {
  if (!soulAction) return null;

  if (soulAction.workerTaskId) {
    return {
      objectType: 'worker_task',
      objectId: soulAction.workerTaskId,
      operation: soulAction.executionStatus === 'pending' ? 'enqueued' : null,
      summary: soulAction.resultSummary,
    };
  }

  if (!hasAcceptedProjectionVisibility(soulAction.sourceReintegrationId)) return null;

  if (soulAction.actionKind === 'create_event_node' || soulAction.actionKind === 'promote_event_node') {
    const eventNode = getEventNodeBySourceReintegrationId(soulAction.sourceReintegrationId ?? '');
    if (eventNode?.promotionSoulActionId === soulAction.id) {
      return {
        objectType: 'event_node',
        objectId: eventNode.id,
        operation: soulAction.resultSummary?.startsWith('已更新') ? 'updated' : 'created',
        summary: soulAction.resultSummary,
      };
    }
  }

  if (soulAction.actionKind === 'promote_continuity_record') {
    const continuityRecord = getContinuityRecordBySourceReintegrationId(soulAction.sourceReintegrationId ?? '');
    if (continuityRecord?.promotionSoulActionId === soulAction.id) {
      return {
        objectType: 'continuity_record',
        objectId: continuityRecord.id,
        operation: soulAction.resultSummary?.startsWith('已更新') ? 'updated' : 'created',
        summary: soulAction.resultSummary,
      };
    }
  }

  return null;
}

function attachSoulActionExecutionSummary(soulAction: ReturnType<typeof getSoulAction> | null | undefined) {
  if (!soulAction) return soulAction;
  return { ...soulAction, executionSummary: getPersistedSoulActionExecutionSummary(soulAction) };
}

export function attachSoulActionExecutionSummaryAndPromotionSummary(soulAction: ReturnType<typeof getSoulAction> | null | undefined) {
  const withExecutionSummary = attachSoulActionExecutionSummary(soulAction);
  if (!withExecutionSummary?.sourceReintegrationId) return withExecutionSummary;
  const reintegrationRecord = getReintegrationRecord(withExecutionSummary.sourceReintegrationId);
  return {
    ...withExecutionSummary,
    promotionSummary: hasAcceptedProjectionVisibility(withExecutionSummary.sourceReintegrationId)
      ? getSoulActionPromotionSummary(withExecutionSummary, reintegrationRecord)
      : null,
  };
}

function buildPlannedSoulActionResponse(soulActions: ReturnType<typeof listSoulActions>) {
  return soulActions
    .map((soulAction) => attachSoulActionExecutionSummaryAndPromotionSummary(soulAction))
    .filter((soulAction): soulAction is NonNullable<ReturnType<typeof attachSoulActionExecutionSummaryAndPromotionSummary>> => !!soulAction);
}

export function attachReintegrationRecordDisplaySummary(
  record: ReturnType<typeof getReintegrationRecord> | null | undefined,
  soulActions?: ReturnType<typeof listSoulActions>,
) {
  if (!record) return record;
  const responseSoulActions = soulActions
    ? buildPlannedSoulActionResponse(soulActions)
    : record.reviewStatus === 'accepted'
      ? buildPlannedSoulActionResponse(listSoulActions({ sourceReintegrationId: record.id }))
      : [];
  const nextActionSummary = getReintegrationNextActionSummary(record);
  return {
    ...record,
    nextActionSummary,
    displaySummary: getReintegrationOutcomeDisplaySummary({ soulActions: responseSoulActions, nextActionSummary }, record),
  };
}

function buildReintegrationPlanningResponse(
  record: ReintegrationRecord,
  soulActions: ReturnType<typeof listSoulActions>,
): Pick<AcceptReintegrationRecordResponse, 'reintegrationRecord' | 'soulActions' | 'nextActionSummary' | 'displaySummary'> {
  const responseSoulActions = buildPlannedSoulActionResponse(soulActions);
  const responseRecord = attachReintegrationRecordDisplaySummary(record, soulActions) ?? record;
  return {
    reintegrationRecord: responseRecord,
    soulActions: responseSoulActions,
    nextActionSummary: responseRecord.nextActionSummary ?? null,
    displaySummary: responseRecord.displaySummary,
  };
}

function broadcastSoulActionUpdate(soulAction: ReturnType<typeof getSoulAction> | null | undefined): void {
  if (!soulAction) return;
  broadcastUpdate({ type: 'soul-action-updated', data: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! });
}

function broadcastReintegrationRecordUpdate(
  record: ReturnType<typeof getReintegrationRecord> | null | undefined,
  soulActions?: ReturnType<typeof listSoulActions>,
): void {
  if (!record) return;
  broadcastUpdate({ type: 'reintegration-record-updated', data: attachReintegrationRecordDisplaySummary(record, soulActions)! });
}

export function attachEventNodeProjectionSummary(eventNode: EventNode | null | undefined) {
  if (!eventNode) return eventNode;
  return { ...eventNode, explanationSummary: buildProjectionExplanationSummary(eventNode) };
}

export function attachContinuityRecordProjectionSummary(continuityRecord: ContinuityRecord | null | undefined) {
  if (!continuityRecord) return continuityRecord;
  return {
    ...continuityRecord,
    continuitySummary: getProjectionContinuitySummary(continuityRecord),
    explanationSummary: buildProjectionExplanationSummary(continuityRecord),
  };
}

function broadcastEventNodeUpdate(eventNode: EventNode | null | undefined): void {
  const responseEventNode = attachEventNodeProjectionSummary(eventNode);
  if (!responseEventNode) return;
  broadcastUpdate({ type: 'event-node-updated', data: { eventNode: responseEventNode } });
}

function broadcastContinuityRecordUpdate(continuityRecord: ContinuityRecord | null | undefined): void {
  const responseContinuityRecord = attachContinuityRecordProjectionSummary(continuityRecord);
  if (!responseContinuityRecord) return;
  broadcastUpdate({ type: 'continuity-record-updated', data: { continuityRecord: responseContinuityRecord } });
}

function getSourceReintegrationIds(query: unknown): string[] | undefined {
  const raw = (query as { sourceReintegrationIds?: unknown })?.sourceReintegrationIds;
  if (typeof raw !== 'string') return undefined;
  const ids = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
  return ids.length ? ids : undefined;
}

function getVisibleProjectionReintegrationIds(sourceReintegrationIds: string[] | undefined): string[] {
  return sourceReintegrationIds
    ? filterAcceptedProjectionReintegrationIds(sourceReintegrationIds) ?? []
    : listAcceptedProjectionReintegrationIds();
}

// ── Soul Action Handlers ───────────────────────────────

export async function listSoulActionsHandler(
  req: Request<Record<string, never>, ApiResponse<ListSoulActionsResponse>, Record<string, never>, {
    sourceNoteId?: string;
    sourceReintegrationId?: string;
    governanceStatus?: string;
    executionStatus?: string;
    actionKind?: string;
  }>,
  res: Response<ApiResponse<ListSoulActionsResponse>>,
): Promise<void> {
  try {
    const sourceNoteId = typeof req.query.sourceNoteId === 'string' && req.query.sourceNoteId.trim()
      ? req.query.sourceNoteId.trim()
      : undefined;
    const sourceReintegrationId = typeof req.query.sourceReintegrationId === 'string' && req.query.sourceReintegrationId.trim()
      ? req.query.sourceReintegrationId.trim()
      : undefined;

    const filters: ListSoulActionsResponse['filters'] = {
      sourceNoteId,
      sourceReintegrationId,
      governanceStatus: parseSoulActionGovernanceStatus(req.query.governanceStatus),
      executionStatus: parseSoulActionExecutionStatus(req.query.executionStatus),
      actionKind: parseSoulActionKind(req.query.actionKind),
    };

    const soulActions = listSoulActions(filters);
    const normalizedSourceFilters = normalizeSoulActionSourceFilters(filters, soulActions);

    const response: ListSoulActionsResponse = {
      soulActions: soulActions.map((soulAction) => attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)).filter((soulAction): soulAction is NonNullable<ReturnType<typeof attachSoulActionExecutionSummaryAndPromotionSummary>> => !!soulAction),
      filters: { ...filters, ...normalizedSourceFilters },
    };
    res.json(response);
  } catch (error) {
    console.error('List soul actions error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function getSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = getSoulAction(req.params.id);
    if (!soulAction) { res.status(404).json({ error: 'Soul action not found' }); return; }
    const response: SoulActionResponse = { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! };
    res.json(response);
  } catch (error) {
    console.error('Get soul action error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function approveSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = approveSoulAction(req.params.id, getGovernanceReason(req.body));
    if (!soulAction) { res.status(404).json({ error: 'Soul action not found' }); return; }
    broadcastSoulActionUpdate(soulAction);
    const response: SoulActionResponse = { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! };
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
}

export async function deferSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = deferSoulAction(req.params.id, getGovernanceReason(req.body));
    if (!soulAction) { res.status(404).json({ error: 'Soul action not found' }); return; }
    broadcastSoulActionUpdate(soulAction);
    const response: SoulActionResponse = { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! };
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
}

export async function discardSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = discardSoulAction(req.params.id, getGovernanceReason(req.body));
    if (!soulAction) { res.status(404).json({ error: 'Soul action not found' }); return; }
    broadcastSoulActionUpdate(soulAction);
    const response: SoulActionResponse = { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! };
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
}

export async function dispatchSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<DispatchSoulActionResponse>>,
  res: Response<ApiResponse<DispatchSoulActionResponse>>,
): Promise<void> {
  try {
    const result = await dispatchApprovedSoulAction(req.params.id);
    if (!result.soulActionId) { res.status(404).json({ error: result.reason }); return; }
    if (!result.dispatched) { res.status(400).json({ error: result.reason, result }); return; }

    const soulAction = getSoulAction(result.soulActionId);
    const task = result.workerTaskId ? (await import('../../workers/workerTasks.js')).getWorkerTask(result.workerTaskId) : null;
    const responseSoulAction = attachSoulActionExecutionSummaryAndPromotionSummary(soulAction);
    const responseResult: DispatchSoulActionResponse['result'] = {
      ...result,
      reason: responseSoulAction?.resultSummary ?? task?.error ?? result.reason,
      executionSummary: responseSoulAction?.executionSummary ?? result.executionSummary ?? null,
    };
    const responseEventNode = attachEventNodeProjectionSummary(result.eventNode) ?? null;
    const responseContinuityRecord = attachContinuityRecordProjectionSummary(result.continuityRecord) ?? null;
    broadcastSoulActionUpdate(soulAction);
    broadcastEventNodeUpdate(result.eventNode);
    broadcastContinuityRecordUpdate(result.continuityRecord);
    const response: DispatchSoulActionResponse = {
      result: responseResult,
      soulAction: responseSoulAction ?? null,
      task,
      eventNode: responseEventNode,
      continuityRecord: responseContinuityRecord,
    };
    res.status(202).json(response);
  } catch (error) {
    console.error('Dispatch soul action error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// ── Reintegration Handlers ─────────────────────────────

export async function listReintegrationRecordsHandler(
  req: Request<Record<string, never>, ApiResponse<ListReintegrationRecordsResponse>, Record<string, never>, { reviewStatus?: 'pending_review' | 'accepted' | 'rejected'; sourceNoteId?: string }>,
  res: Response<ApiResponse<ListReintegrationRecordsResponse>>,
): Promise<void> {
  try {
    const reviewStatus = typeof req.query.reviewStatus === 'string' ? req.query.reviewStatus.trim() as 'pending_review' | 'accepted' | 'rejected' : undefined;
    const sourceNoteId = typeof req.query.sourceNoteId === 'string' && req.query.sourceNoteId.trim()
      ? req.query.sourceNoteId.trim()
      : undefined;
    const response: ListReintegrationRecordsResponse = {
      reintegrationRecords: listReintegrationRecords({ reviewStatus, sourceNoteId }).map((record) => attachReintegrationRecordDisplaySummary(record)).filter((record): record is NonNullable<ReturnType<typeof attachReintegrationRecordDisplaySummary>> => !!record),
      filters: { reviewStatus, sourceNoteId },
    };
    res.json(response);
  } catch (error) {
    console.error('List reintegration records error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function acceptReintegrationRecordHandler(
  req: Request<{ id: string }, ApiResponse<AcceptReintegrationRecordResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<AcceptReintegrationRecordResponse>>,
): Promise<void> {
  try {
    const result = acceptReintegrationRecordAndPlanPromotions(req.params.id, getGovernanceReason(req.body));
    if (!result) { res.status(404).json({ error: 'Reintegration record not found' }); return; }
    broadcastReintegrationRecordUpdate(result.reintegrationRecord, result.soulActions);
    result.soulActions.forEach((soulAction) => broadcastSoulActionUpdate(soulAction));
    const planningResponse = buildReintegrationPlanningResponse(result.reintegrationRecord, result.soulActions);
    const response: AcceptReintegrationRecordResponse = {
      reintegrationRecord: planningResponse.reintegrationRecord,
      soulActions: planningResponse.soulActions,
      nextActionSummary: planningResponse.nextActionSummary,
      displaySummary: planningResponse.displaySummary,
    };
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
}

export async function rejectReintegrationRecordHandler(
  req: Request<{ id: string }, ApiResponse<RejectReintegrationRecordResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<RejectReintegrationRecordResponse>>,
): Promise<void> {
  try {
    const record = rejectReintegrationRecord(req.params.id, getGovernanceReason(req.body));
    if (!record) { res.status(404).json({ error: 'Reintegration record not found' }); return; }
    const responseRecord = attachReintegrationRecordDisplaySummary(record);
    broadcastReintegrationRecordUpdate(record);
    const response: RejectReintegrationRecordResponse = { reintegrationRecord: responseRecord ?? record };
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
}

export async function planPromotionsHandler(
  req: Request<{ id: string }, ApiResponse<PlanReintegrationPromotionsResponse>>,
  res: Response<ApiResponse<PlanReintegrationPromotionsResponse>>,
): Promise<void> {
  try {
    const record = getReintegrationRecord(req.params.id);
    if (!record) { res.status(404).json({ error: 'Reintegration record not found' }); return; }
    const soulActions = planPromotionSoulActions(record);
    const planningResponse = buildReintegrationPlanningResponse(record, soulActions);
    broadcastReintegrationRecordUpdate(record, soulActions);
    soulActions.forEach((soulAction) => broadcastSoulActionUpdate(soulAction));
    const response: PlanReintegrationPromotionsResponse = {
      reintegrationRecord: planningResponse.reintegrationRecord,
      soulActions: planningResponse.soulActions,
      nextActionSummary: planningResponse.nextActionSummary,
      displaySummary: planningResponse.displaySummary,
    };
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
}

// ── Projection Handlers ────────────────────────────────

export async function listEventNodesHandler(
  req: Request<Record<string, never>, ApiResponse<ListEventNodesResponse>, Record<string, never>, { sourceReintegrationIds?: string }>,
  res: Response<ApiResponse<ListEventNodesResponse>>,
): Promise<void> {
  try {
    const sourceReintegrationIds = getSourceReintegrationIds(req.query);
    const visibleSourceReintegrationIds = getVisibleProjectionReintegrationIds(sourceReintegrationIds);
    const response: ListEventNodesResponse = {
      eventNodes: visibleSourceReintegrationIds.length === 0
        ? []
        : listEventNodes(visibleSourceReintegrationIds)
            .map((eventNode) => attachEventNodeProjectionSummary(eventNode))
            .filter((eventNode): eventNode is NonNullable<ReturnType<typeof attachEventNodeProjectionSummary>> => !!eventNode),
      filters: { sourceReintegrationIds },
    };
    res.json(response);
  } catch (error) {
    console.error('List event nodes error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function listContinuityRecordsHandler(
  req: Request<Record<string, never>, ApiResponse<ListContinuityRecordsResponse>, Record<string, never>, { sourceReintegrationIds?: string }>,
  res: Response<ApiResponse<ListContinuityRecordsResponse>>,
): Promise<void> {
  try {
    const sourceReintegrationIds = getSourceReintegrationIds(req.query);
    const visibleSourceReintegrationIds = getVisibleProjectionReintegrationIds(sourceReintegrationIds);
    const response: ListContinuityRecordsResponse = {
      continuityRecords: visibleSourceReintegrationIds.length === 0
        ? []
        : listContinuityRecords(visibleSourceReintegrationIds)
            .map((continuityRecord) => attachContinuityRecordProjectionSummary(continuityRecord))
            .filter((continuityRecord): continuityRecord is NonNullable<ReturnType<typeof attachContinuityRecordProjectionSummary>> => !!continuityRecord),
      filters: { sourceReintegrationIds },
    };
    res.json(response);
  } catch (error) {
    console.error('List continuity records error:', error);
    res.status(500).json({ error: String(error) });
  }
}
