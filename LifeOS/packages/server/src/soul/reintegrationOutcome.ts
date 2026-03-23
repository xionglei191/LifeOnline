import type { ActionOutcomePacket, ExtractTaskReintegrationEvidenceItem, ReintegrationEvidenceSummary, ReintegrationOutcomeSummary, ReintegrationSummaryContext as SharedReintegrationSummaryContext, WorkerTask } from '@lifeos/shared';
import {
  getReintegrationOutcomeSummary as getSharedReintegrationOutcomeSummary,
  getSuggestedSoulActionKindsForReintegrationSignal,
  normalizeReintegrationNextActionCandidate,
  pickReintegrationNextActionCandidate,
} from '@lifeos/shared';
import type { ReintegrationRecordInput, ReintegrationRecordEvidence } from '@lifeos/shared';
import type { SupportedReintegrationTaskType } from '../workers/feedbackReintegration.js';
import type { PersonaSnapshot } from './personaSnapshots.js';
import type { ReintegrationRecord } from './reintegrationRecords.js';

export interface ReintegrationOutcomeContext {
  nextActionCandidate: ExtractTaskReintegrationEvidenceItem | null;
  suggestedActionKinds: SoulActionKind[];
}

export interface ReintegrationSummaryContext extends SharedReintegrationSummaryContext, ReintegrationOutcomeContext {}

export interface ReintegrationEvidenceContext {
  evidence: ReintegrationEvidenceSummary;
}

export interface PacketToRecordBuilderOptions {
  soulActionId?: string | null;
  sourceReintegrationId?: string | null;
  personaSnapshot?: PersonaSnapshot | null;
}

export interface OutcomePacketExtractTaskEvidence {
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
}

const TASK_TYPE_SIGNAL_KIND_MATRIX: Record<ActionOutcomePacket['taskType'], ReintegrationRecord['signalKind']> = {
  summarize_note: 'summary_reintegration',
  classify_inbox: 'classification_reintegration',
  extract_tasks: 'task_extraction_reintegration',
  update_persona_snapshot: 'persona_snapshot_reintegration',
  daily_report: 'daily_report_reintegration',
  weekly_report: 'weekly_report_reintegration',
  openclaw_task: 'openclaw_reintegration',
};

function getOutputNoteIdByPath(task: WorkerTask<'extract_tasks'>): Map<string, string> {
  return new Map((task.outputNotes ?? []).flatMap((note) => note.id ? [[note.filePath, note.id] as const] : []));
}

export function buildOutcomePacketExtractTaskEvidence(task: WorkerTask<'extract_tasks'>): OutcomePacketExtractTaskEvidence {
  const result = task.result;
  if (!result) {
    return {
      extractTaskCreated: null,
      extractTaskItems: [],
    };
  }

  const outputNoteIdByPath = getOutputNoteIdByPath(task);
  return {
    extractTaskCreated: result.created,
    extractTaskItems: result.items.map((item) => ({
      title: item.title,
      dimension: item.dimension,
      priority: item.priority,
      due: item.due ?? null,
      filePath: item.filePath,
      outputNoteId: outputNoteIdByPath.get(item.filePath) ?? null,
    })),
  };
}

export function getReintegrationNextActionCandidate(record: ReintegrationRecord): ExtractTaskReintegrationEvidenceItem | null {
  const evidence = record.evidence && typeof record.evidence === 'object'
    ? record.evidence as Record<string, unknown>
    : null;
  return normalizeReintegrationNextActionCandidate(evidence?.nextActionCandidate);
}

export function getOutcomePacketNextActionCandidate(packet: ActionOutcomePacket): ExtractTaskReintegrationEvidenceItem | null {
  return pickReintegrationNextActionCandidate(packet.extractTaskItems
    .map((item) => normalizeReintegrationNextActionCandidate(item)));
}

export function getOutcomeTaskSignalKind(taskType: SupportedReintegrationTaskType): ReintegrationRecord['signalKind'] {
  return TASK_TYPE_SIGNAL_KIND_MATRIX[taskType];
}

export function getOutcomePacketSignalKind(packet: ActionOutcomePacket): ReintegrationRecord['signalKind'] {
  return getOutcomeTaskSignalKind(packet.taskType);
}

export function generateSoulActionsFromOutcome(record: ReintegrationRecord): ReintegrationOutcomeContext {
  const summary = getSharedReintegrationOutcomeSummary(record);
  return {
    nextActionCandidate: getReintegrationNextActionCandidate(record),
    suggestedActionKinds: [...summary.suggestedActionKinds],
  };
}

export function generateSoulActionsFromOutcomePacket(packet: ActionOutcomePacket): ReintegrationOutcomeContext {
  const nextActionCandidate = getOutcomePacketNextActionCandidate(packet);
  const canGenerateSuggestedActions = packet.status === 'succeeded'
    && (Boolean(packet.resultSummary?.trim()) || packet.outputNotePaths.length > 0 || !!nextActionCandidate);
  const signalKind = getOutcomePacketSignalKind(packet);
  return {
    nextActionCandidate,
    suggestedActionKinds: canGenerateSuggestedActions
      ? getSuggestedSoulActionKindsForReintegrationSignal(signalKind)
      : [],
  };
}

export function buildReintegrationSummaryFromOutcomePacket(
  packet: ActionOutcomePacket,
  continuity: ContinuityIntegrationResult,
): ReintegrationSummaryContext {
  const signalKind = getOutcomePacketSignalKind(packet);
  const outcomeSummary: ReintegrationOutcomeSummary = getSharedReintegrationOutcomeSummary({
    signalKind,
    target: continuity.target,
    strength: continuity.strength,
  });
  return {
    ...outcomeSummary,
    summary: continuity.summary,
    nextActionCandidate: getOutcomePacketNextActionCandidate(packet),
  };
}

export function buildReintegrationEvidenceFromOutcomePacket(
  packet: ActionOutcomePacket,
  summary: ReintegrationSummaryContext,
  personaSnapshot: PersonaSnapshot | null,
): ReintegrationRecordEvidence {
  return {
    taskId: packet.taskId,
    taskType: packet.taskType,
    sourceNoteId: packet.sourceNoteId,
    sourceSoulActionId: packet.sourceSoulActionId,
    sourceReintegrationId: packet.sourceReintegrationId,
    resultSummary: packet.resultSummary,
    error: packet.error,
    outputNotePaths: packet.outputNotePaths,
    extractTaskCreated: packet.extractTaskCreated,
    extractTaskItems: packet.extractTaskItems,
    nextActionCandidate: summary.nextActionCandidate,
    personaSnapshotId: personaSnapshot?.id ?? null,
    personaSnapshotSummary: personaSnapshot?.summary ?? null,
    personaContentPreview: personaSnapshot?.snapshot.contentPreview ?? null,
  };
}

export function buildReintegrationRecordInputFromOutcomePacket(
  packet: ActionOutcomePacket,
  continuity: ContinuityIntegrationResult,
  options: PacketToRecordBuilderOptions = {},
): ReintegrationRecordInput {
  const summary = buildReintegrationSummaryFromOutcomePacket(packet, continuity);
  const personaSnapshot = options.personaSnapshot ?? null;
  const evidence = buildReintegrationEvidenceFromOutcomePacket(packet, summary, personaSnapshot);

  return {
    workerTaskId: packet.taskId,
    sourceNoteId: packet.sourceNoteId,
    soulActionId: options.soulActionId ?? packet.sourceSoulActionId,
    taskType: packet.taskType,
    terminalStatus: packet.status,
    signalKind: summary.signalKind,
    target: summary.target,
    strength: summary.strength,
    summary: summary.summary,
    evidence: {
      ...evidence,
      sourceReintegrationId: options.sourceReintegrationId ?? evidence.sourceReintegrationId,
    },
  };
}

export function hasReintegrationSignalFromOutcomePacket(packet: ActionOutcomePacket): boolean {
  if (packet.resultSummary?.trim() || packet.outputNotePaths.length > 0) {
    return true;
  }

  const outcome = generateSoulActionsFromOutcomePacket(packet);
  return !!outcome.nextActionCandidate || outcome.suggestedActionKinds.length > 0;
}
