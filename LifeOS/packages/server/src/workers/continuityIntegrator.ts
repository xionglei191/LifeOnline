import type { ActionOutcomePacket, SupportedReintegrationTaskType, TerminalWorkerTaskStatus } from './feedbackReintegration.js';

export type ContinuityTarget = 'source_note' | 'derived_outputs' | 'task_record';
export type ContinuityStrength = 'low' | 'medium';

export interface ContinuityIntegrationResult {
  taskId: string;
  taskType: SupportedReintegrationTaskType;
  status: TerminalWorkerTaskStatus;
  shouldReintegrate: boolean;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  summary: string;
}

const TASK_TYPE_TARGETS: Record<SupportedReintegrationTaskType, ContinuityTarget> = {
  summarize_note: 'source_note',
  classify_inbox: 'derived_outputs',
  extract_tasks: 'derived_outputs',
  update_persona_snapshot: 'source_note',
  daily_report: 'derived_outputs',
  weekly_report: 'derived_outputs',
  openclaw_task: 'task_record',
};

export function integrateContinuity(packet: ActionOutcomePacket): ContinuityIntegrationResult {
  const shouldReintegrate = packet.status === 'succeeded' && (!!packet.resultSummary || packet.outputNotePaths.length > 0);
  const target = packet.sourceNoteId ? 'source_note' : TASK_TYPE_TARGETS[packet.taskType];
  const strength: ContinuityStrength = packet.outputNotePaths.length > 0 || packet.status === 'succeeded' ? 'medium' : 'low';

  const summary = buildContinuitySummary(packet, target, shouldReintegrate);

  return {
    taskId: packet.taskId,
    taskType: packet.taskType,
    status: packet.status,
    shouldReintegrate,
    target,
    strength,
    summary,
  };
}

function buildContinuitySummary(packet: ActionOutcomePacket, target: ContinuityTarget, shouldReintegrate: boolean): string {
  if (!shouldReintegrate) {
    return packet.error
      ? `${packet.taskType} ended as ${packet.status}; continuity remains observational only (${packet.error}).`
      : `${packet.taskType} ended as ${packet.status}; no reintegration candidate was produced.`;
  }

  const summarySource = packet.resultSummary?.trim() || `${packet.taskType} completed with ${packet.outputNotePaths.length} output note(s).`;
  return `${summarySource} Continuity target: ${target}.`;
}
