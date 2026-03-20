import { createWorkerTask, executeWorkerTask } from '../workers/workerTasks.js';
import { createOrReuseSoulAction } from './soulActions.js';
import type { SoulActionCandidate } from './soulActionGenerator.js';
import type { InterventionGateDecision } from './interventionGate.js';

export interface SoulActionDispatchResult {
  dispatched: boolean;
  reason: string;
  workerTaskId: string | null;
}

export async function dispatchSoulActionCandidate(
  candidate: SoulActionCandidate,
  gateDecision: InterventionGateDecision,
): Promise<SoulActionDispatchResult> {
  if (gateDecision.decision !== 'dispatch_now') {
    return {
      dispatched: false,
      reason: gateDecision.reason,
      workerTaskId: null,
    };
  }

  createOrReuseSoulAction({
    sourceNoteId: candidate.sourceNoteId,
    actionKind: candidate.actionKind,
  });

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: candidate.noteId },
    sourceNoteId: candidate.sourceNoteId,
  });
  await executeWorkerTask(task.id);

  return {
    dispatched: true,
    reason: gateDecision.reason,
    workerTaskId: task.id,
  };
}
