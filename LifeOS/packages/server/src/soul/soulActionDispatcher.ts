import { createWorkerTask, executeWorkerTask } from '../workers/workerTasks.js';
import { createOrReuseSoulAction, getSoulAction } from './soulActions.js';
import { getDb } from '../db/client.js';
import { executePromotionSoulAction } from './pr6PromotionExecutor.js';
import type { EventNode } from './eventNodes.js';
import type { ContinuityRecord } from './continuityRecords.js';
import type { SoulActionCandidate } from './soulActionGenerator.js';
import type { InterventionGateDecision } from './interventionGate.js';
import type { SoulAction } from './types.js';

export interface SoulActionDispatchResult {
  dispatched: boolean;
  reason: string;
  soulActionId: string | null;
  workerTaskId: string | null;
  executionSummary?: {
    objectType: 'event_node' | 'continuity_record' | 'worker_task' | null;
    objectId: string | null;
    operation: 'created' | 'updated' | 'enqueued' | null;
    summary: string | null;
  } | null;
  eventNode?: EventNode | null;
  continuityRecord?: ContinuityRecord | null;
}

function buildWorkerTaskRequestFromSoulAction(action: SoulAction) {
  if (action.actionKind === 'update_persona_snapshot') {
    return {
      taskType: 'update_persona_snapshot' as const,
      input: { noteId: action.sourceNoteId },
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'extract_tasks') {
    return {
      taskType: 'extract_tasks' as const,
      input: { noteId: action.sourceNoteId },
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'launch_daily_report') {
    return {
      taskType: 'daily_report' as const,
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'launch_weekly_report') {
    return {
      taskType: 'weekly_report' as const,
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  if (action.actionKind === 'launch_openclaw_task') {
    return {
      taskType: 'openclaw_task' as const,
      input: { instruction: action.governanceReason ?? '' },
      sourceNoteId: action.sourceNoteId,
      sourceReintegrationId: action.sourceReintegrationId ?? undefined,
    };
  }

  throw new Error(`Unsupported soul action kind for worker dispatch: ${action.actionKind}`);
}

export async function dispatchSoulActionCandidate(
  candidate: SoulActionCandidate,
  gateDecision: InterventionGateDecision,
): Promise<SoulActionDispatchResult> {
  // observe_only / discard → do nothing
  if (gateDecision.decision === 'observe_only' || gateDecision.decision === 'discard') {
    return {
      dispatched: false,
      reason: gateDecision.reason,
      soulActionId: null,
      workerTaskId: null,
    };
  }

  // queue_for_review → create pending soul action for human review
  if (gateDecision.decision === 'queue_for_review') {
    const soulAction = createOrReuseSoulAction({
      sourceNoteId: candidate.sourceNoteId,
      actionKind: candidate.actionKind,
      governanceReason: gateDecision.reason,
    });

    return {
      dispatched: false,
      reason: gateDecision.reason,
      soulActionId: soulAction.id,
      workerTaskId: null,
    };
  }

  // dispatch_now → create pre-approved soul action and dispatch immediately
  const soulAction = createOrReuseSoulAction({
    sourceNoteId: candidate.sourceNoteId,
    actionKind: candidate.actionKind,
    governanceStatus: 'approved',
    governanceReason: gateDecision.reason,
  });

  return dispatchApprovedSoulAction(soulAction.id);
}

export async function dispatchApprovedSoulAction(soulActionId: string): Promise<SoulActionDispatchResult> {
  const soulAction = getSoulAction(soulActionId);
  if (!soulAction) {
    return {
      dispatched: false,
      reason: 'soul action not found',
      soulActionId: null,
      workerTaskId: null,
    };
  }

  if (soulAction.governanceStatus !== 'approved') {
    return {
      dispatched: false,
      reason: 'only approved soul actions can be dispatched',
      soulActionId: soulAction.id,
      workerTaskId: null,
    };
  }

  if (soulAction.executionStatus !== 'not_dispatched') {
    return {
      dispatched: false,
      reason: 'only not_dispatched soul actions can be dispatched',
      soulActionId: soulAction.id,
      workerTaskId: soulAction.workerTaskId,
    };
  }

  if (
    soulAction.actionKind === 'create_event_node'
    || soulAction.actionKind === 'promote_event_node'
    || soulAction.actionKind === 'promote_continuity_record'
  ) {
    const result = executePromotionSoulAction(soulAction);
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = ?, updated_at = ?, started_at = ?, finished_at = ?, error = NULL, result_summary = ?
      WHERE id = ?
    `).run('succeeded', now, now, now, result.summary, soulAction.id);
    return {
      dispatched: true,
      reason: result.summary,
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: result.eventNode
        ? {
            objectType: 'event_node',
            objectId: result.eventNode.id,
            operation: result.summary.startsWith('已更新') ? 'updated' : 'created',
            summary: result.summary,
          }
        : result.continuityRecord
          ? {
              objectType: 'continuity_record',
              objectId: result.continuityRecord.id,
              operation: result.summary.startsWith('已更新') ? 'updated' : 'created',
              summary: result.summary,
            }
          : null,
      eventNode: result.eventNode,
      continuityRecord: result.continuityRecord,
    };
  }

  // ask_followup_question → mark as pending (awaiting user answer), no worker task
  if (soulAction.actionKind === 'ask_followup_question') {
    const now = new Date().toISOString();
    getDb().prepare(`
      UPDATE soul_actions
      SET execution_status = 'pending', updated_at = ?, started_at = ?
      WHERE id = ?
    `).run(now, now, soulAction.id);
    return {
      dispatched: true,
      reason: '追问已发出，等待用户回答',
      soulActionId: soulAction.id,
      workerTaskId: null,
      executionSummary: {
        objectType: 'followup_question',
        objectId: soulAction.id,
        operation: 'awaiting_answer',
        summary: soulAction.governanceReason ?? '追问已发出',
      },
      eventNode: null,
      continuityRecord: null,
    };
  }

  const request = buildWorkerTaskRequestFromSoulAction(soulAction);
  const task = createWorkerTask(request);
  await executeWorkerTask(task.id);

  return {
    dispatched: true,
    reason: 'approved soul action dispatched through worker host',
    soulActionId: soulAction.id,
    workerTaskId: task.id,
    executionSummary: {
      objectType: 'worker_task',
      objectId: task.id,
      operation: 'enqueued',
      summary: 'approved soul action dispatched through worker host',
    },
    eventNode: null,
    continuityRecord: null,
  };
}
