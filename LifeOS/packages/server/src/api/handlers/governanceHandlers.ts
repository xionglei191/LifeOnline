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
import { sendSuccess, sendError } from '../responseHelper.js';
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

function getGovernanceReason(body: Record<string, unknown> | undefined): string | null {
  return typeof body?.reason === 'string' && (body.reason as string).trim() ? (body.reason as string).trim() : null;
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
    displaySummary: responseRecord.displaySummary!,
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

    const data: ListSoulActionsResponse = {
      soulActions: soulActions.map((soulAction) => attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)).filter((soulAction): soulAction is NonNullable<ReturnType<typeof attachSoulActionExecutionSummaryAndPromotionSummary>> => !!soulAction),
      filters: { ...filters, ...normalizedSourceFilters },
    };
    sendSuccess(res, data);
  } catch (error) {
    console.error('List soul actions error:', error);
    sendError(res, String(error));
  }
}

export async function getSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = getSoulAction(req.params.id);
    if (!soulAction) { sendError(res, 'Soul action not found', 404); return; }
    sendSuccess(res, { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! } as SoulActionResponse);
  } catch (error) {
    console.error('Get soul action error:', error);
    sendError(res, String(error));
  }
}

export async function approveSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = approveSoulAction(req.params.id, getGovernanceReason(req.body as Record<string, unknown>));
    if (!soulAction) { sendError(res, 'Soul action not found', 404); return; }
    broadcastSoulActionUpdate(soulAction);
    sendSuccess(res, { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! } as SoulActionResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, message, 400);
  }
}

export async function deferSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = deferSoulAction(req.params.id, getGovernanceReason(req.body as Record<string, unknown>));
    if (!soulAction) { sendError(res, 'Soul action not found', 404); return; }
    broadcastSoulActionUpdate(soulAction);
    sendSuccess(res, { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! } as SoulActionResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, message, 400);
  }
}

export async function discardSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const soulAction = discardSoulAction(req.params.id, getGovernanceReason(req.body as Record<string, unknown>));
    if (!soulAction) { sendError(res, 'Soul action not found', 404); return; }
    broadcastSoulActionUpdate(soulAction);
    sendSuccess(res, { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(soulAction)! } as SoulActionResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, message, 400);
  }
}

export async function dispatchSoulActionHandler(
  req: Request<{ id: string }, ApiResponse<DispatchSoulActionResponse>>,
  res: Response<ApiResponse<DispatchSoulActionResponse>>,
): Promise<void> {
  try {
    const result = await dispatchApprovedSoulAction(req.params.id);
    if (!result.soulActionId) { sendError(res, result.reason, 404); return; }
    if (!result.dispatched) { sendError(res, result.reason, 400); return; }

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
    const data: DispatchSoulActionResponse = {
      result: responseResult,
      soulAction: responseSoulAction ?? null,
      task,
      eventNode: responseEventNode,
      continuityRecord: responseContinuityRecord,
    };
    sendSuccess(res, data, 202);
  } catch (error) {
    console.error('Dispatch soul action error:', error);
    sendError(res, String(error));
  }
}

export async function answerFollowupHandler(
  req: Request<{ id: string }, ApiResponse<SoulActionResponse>, { answer: string }>,
  res: Response<ApiResponse<SoulActionResponse>>,
): Promise<void> {
  try {
    const answer = req.body?.answer?.trim();
    if (!answer) { sendError(res, 'answer is required', 400); return; }

    const soulAction = getSoulAction(req.params.id);
    if (!soulAction) { sendError(res, 'Soul action not found', 404); return; }
    if (soulAction.actionKind !== 'ask_followup_question') {
      sendError(res, 'only ask_followup_question actions can be answered', 400); return;
    }
    if (soulAction.executionStatus !== 'pending') {
      sendError(res, 'only pending followup questions can be answered', 400); return;
    }

    // Append answer to source note
    if (soulAction.sourceNoteId) {
      try {
        const note = getDb().prepare('SELECT file_path FROM notes WHERE id = ?').get(soulAction.sourceNoteId) as { file_path: string } | undefined;
        if (note) {
          const { rewriteMarkdownContent } = await import('../../vault/fileManager.js');
          const { broadcastUpdate, getIndexQueue } = await import('../../index.js');
          const timestamp = new Date().toLocaleString('zh-CN');
          await rewriteMarkdownContent(note.file_path, (content) =>
            `${content.trimEnd()}\n\n---\n\n**追问回答** (${timestamp})\n\n${answer}\n`
          );
          broadcastUpdate({ type: 'note-updated', data: { noteId: soulAction.sourceNoteId } });
          getIndexQueue()?.enqueue(note.file_path, 'upsert');
        }
      } catch (appendError) {
        console.warn('[answerFollowup] Failed to append to note:', appendError);
      }
    }

    // Mark as succeeded
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'succeeded', updated_at = ?, finished_at = ?, result_summary = ?
      WHERE id = ?
    `).run(now, now, `用户回答: ${answer.slice(0, 200)}`, soulAction.id);

    const updated = getSoulAction(soulAction.id);
    broadcastSoulActionUpdate(updated);
    sendSuccess(res, { soulAction: attachSoulActionExecutionSummaryAndPromotionSummary(updated)! } as SoulActionResponse);
  } catch (error) {
    console.error('Answer followup error:', error);
    sendError(res, String(error));
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
    const data: ListReintegrationRecordsResponse = {
      reintegrationRecords: listReintegrationRecords({ reviewStatus, sourceNoteId }).map((record) => attachReintegrationRecordDisplaySummary(record)).filter((record): record is NonNullable<ReturnType<typeof attachReintegrationRecordDisplaySummary>> => !!record),
      filters: { reviewStatus, sourceNoteId },
    };
    sendSuccess(res, data);
  } catch (error) {
    console.error('List reintegration records error:', error);
    sendError(res, String(error));
  }
}

export async function acceptReintegrationRecordHandler(
  req: Request<{ id: string }, ApiResponse<AcceptReintegrationRecordResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<AcceptReintegrationRecordResponse>>,
): Promise<void> {
  try {
    const result = acceptReintegrationRecordAndPlanPromotions(req.params.id, getGovernanceReason(req.body as Record<string, unknown>));
    if (!result) { sendError(res, 'Reintegration record not found', 404); return; }
    broadcastReintegrationRecordUpdate(result.reintegrationRecord, result.soulActions);
    result.soulActions.forEach((soulAction) => broadcastSoulActionUpdate(soulAction));
    const planningResponse = buildReintegrationPlanningResponse(result.reintegrationRecord, result.soulActions);
    const data: AcceptReintegrationRecordResponse = {
      reintegrationRecord: planningResponse.reintegrationRecord,
      soulActions: planningResponse.soulActions,
      nextActionSummary: planningResponse.nextActionSummary,
      displaySummary: planningResponse.displaySummary,
    };
    sendSuccess(res, data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, message, 400);
  }
}

export async function rejectReintegrationRecordHandler(
  req: Request<{ id: string }, ApiResponse<RejectReintegrationRecordResponse>, ReintegrationReviewRequest>,
  res: Response<ApiResponse<RejectReintegrationRecordResponse>>,
): Promise<void> {
  try {
    const record = rejectReintegrationRecord(req.params.id, getGovernanceReason(req.body as Record<string, unknown>));
    if (!record) { sendError(res, 'Reintegration record not found', 404); return; }
    const responseRecord = attachReintegrationRecordDisplaySummary(record);
    broadcastReintegrationRecordUpdate(record);
    sendSuccess(res, { reintegrationRecord: responseRecord ?? record } as RejectReintegrationRecordResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, message, 400);
  }
}

export async function planPromotionsHandler(
  req: Request<{ id: string }, ApiResponse<PlanReintegrationPromotionsResponse>>,
  res: Response<ApiResponse<PlanReintegrationPromotionsResponse>>,
): Promise<void> {
  try {
    const record = getReintegrationRecord(req.params.id);
    if (!record) { sendError(res, 'Reintegration record not found', 404); return; }
    const soulActions = planPromotionSoulActions(record);
    const planningResponse = buildReintegrationPlanningResponse(record, soulActions);
    broadcastReintegrationRecordUpdate(record, soulActions);
    soulActions.forEach((soulAction) => broadcastSoulActionUpdate(soulAction));
    const data: PlanReintegrationPromotionsResponse = {
      reintegrationRecord: planningResponse.reintegrationRecord,
      soulActions: planningResponse.soulActions,
      nextActionSummary: planningResponse.nextActionSummary,
      displaySummary: planningResponse.displaySummary,
    };
    sendSuccess(res, data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, message, 400);
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
    const data: ListEventNodesResponse = {
      eventNodes: visibleSourceReintegrationIds.length === 0
        ? []
        : listEventNodes(visibleSourceReintegrationIds)
            .map((eventNode) => attachEventNodeProjectionSummary(eventNode))
            .filter((eventNode): eventNode is NonNullable<ReturnType<typeof attachEventNodeProjectionSummary>> => !!eventNode),
      filters: { sourceReintegrationIds },
    };
    sendSuccess(res, data);
  } catch (error) {
    console.error('List event nodes error:', error);
    sendError(res, String(error));
  }
}

export async function listContinuityRecordsHandler(
  req: Request<Record<string, never>, ApiResponse<ListContinuityRecordsResponse>, Record<string, never>, { sourceReintegrationIds?: string }>,
  res: Response<ApiResponse<ListContinuityRecordsResponse>>,
): Promise<void> {
  try {
    const sourceReintegrationIds = getSourceReintegrationIds(req.query);
    const visibleSourceReintegrationIds = getVisibleProjectionReintegrationIds(sourceReintegrationIds);
    const data: ListContinuityRecordsResponse = {
      continuityRecords: visibleSourceReintegrationIds.length === 0
        ? []
        : listContinuityRecords(visibleSourceReintegrationIds)
            .map((continuityRecord) => attachContinuityRecordProjectionSummary(continuityRecord))
            .filter((continuityRecord): continuityRecord is NonNullable<ReturnType<typeof attachContinuityRecordProjectionSummary>> => !!continuityRecord),
      filters: { sourceReintegrationIds },
    };
    sendSuccess(res, data);
  } catch (error) {
    console.error('List continuity records error:', error);
    sendError(res, String(error));
  }
}

// ── BrainstormSession Handlers ─────────────────────────

export async function listBrainstormSessionsHandler(
  req: Request<Record<string, never>, unknown, Record<string, never>, { limit?: string; offset?: string }>,
  res: Response,
): Promise<void> {
  try {
    const { listBrainstormSessions } = await import('../../soul/brainstormSessions.js');
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 100);
    const offset = parseInt(req.query.offset ?? '0', 10) || 0;
    const result = listBrainstormSessions(limit, offset);
    sendSuccess(res, result);
  } catch (error) {
    console.error('List brainstorm sessions error:', error);
    sendError(res, String(error));
  }
}

export async function getBrainstormSessionHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  try {
    const { getBrainstormSession } = await import('../../soul/brainstormSessions.js');
    const session = getBrainstormSession(req.params.id);
    if (!session) { sendError(res, 'Brainstorm session not found', 404); return; }
    sendSuccess(res, { session });
  } catch (error) {
    console.error('Get brainstorm session error:', error);
    sendError(res, String(error));
  }
}

export async function getBrainstormSessionRelatedHandler(
  req: Request<{ id: string }, unknown, unknown, { limit?: string }>,
  res: Response,
): Promise<void> {
  try {
    const { findRelatedBrainstormSessions } = await import('../../soul/brainstormSessions.js');
    const limit = Math.min(parseInt(req.query.limit ?? '5', 10) || 5, 20);
    const related = findRelatedBrainstormSessions(req.params.id, limit);
    sendSuccess(res, { sessions: related });
  } catch (error) {
    console.error('Get related brainstorm sessions error:', error);
    sendError(res, String(error));
  }
}
