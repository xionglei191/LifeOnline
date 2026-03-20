import { createWorkerTask, executeWorkerTask } from '../workers/workerTasks.js';
import { createOrReuseSoulAction, getSoulAction } from './soulActions.js';
import { executePromotionSoulAction } from './pr6PromotionExecutor.js';
import type { SoulActionCandidate } from './soulActionGenerator.js';
import type { InterventionGateDecision } from './interventionGate.js';
import type { SoulAction } from './types.js';

export interface SoulActionDispatchResult {
  dispatched: boolean;
  reason: string;
  soulActionId: string | null;
  workerTaskId: string | null;
}

function buildWorkerTaskRequestFromSoulAction(action: SoulAction) {
  if (action.actionKind === 'update_persona_snapshot') {
    return {
      taskType: 'update_persona_snapshot' as const,
      input: { noteId: action.sourceNoteId },
      sourceNoteId: action.sourceNoteId,
    };
  }

  if (action.actionKind === 'extract_tasks') {
    return {
      taskType: 'extract_tasks' as const,
      input: { noteId: action.sourceNoteId },
      sourceNoteId: action.sourceNoteId,
    };
  }

  throw new Error(`Unsupported soul action kind: ${action.actionKind}`);
}

export async function dispatchSoulActionCandidate(
  candidate: SoulActionCandidate,
  gateDecision: InterventionGateDecision,
): Promise<SoulActionDispatchResult> {
  if (gateDecision.decision !== 'queue_for_review') {
    return {
      dispatched: false,
      reason: gateDecision.reason,
      soulActionId: null,
      workerTaskId: null,
    };
  }

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

  if (soulAction.actionKind === 'promote_event_node' || soulAction.actionKind === 'promote_continuity_record') {
    const result = executePromotionSoulAction(soulAction);
    return {
      dispatched: true,
      reason: result.summary,
      soulActionId: soulAction.id,
      workerTaskId: null,
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
  };
}
