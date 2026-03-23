import type { ExtractTaskReintegrationEvidenceItem, WorkerTask } from '@lifeos/shared';
import type { PersonaSnapshot } from '../soul/personaSnapshots.js';
import type { ReintegrationSignalKind as StoredReintegrationSignalKind } from '../soul/reintegrationRecords.js';
import type { ContinuityIntegrationResult } from './continuityIntegrator.js';
import { integrateContinuity } from './continuityIntegrator.js';

export const SUPPORTED_REINTEGRATION_TASK_TYPES = [
  'summarize_note',
  'classify_inbox',
  'extract_tasks',
  'update_persona_snapshot',
  'daily_report',
  'weekly_report',
  'openclaw_task',
] as const;

export type SupportedReintegrationTaskType = typeof SUPPORTED_REINTEGRATION_TASK_TYPES[number];
export type TerminalWorkerTaskStatus = 'succeeded' | 'failed' | 'cancelled';

export type ReintegrationSignalKind = StoredReintegrationSignalKind;

export interface ReintegrationRecordEvidence extends Record<string, unknown> {
  taskId: string;
  taskType: SupportedReintegrationTaskType;
  sourceNoteId: string | null;
  resultSummary: string | null;
  error: string | null;
  outputNotePaths: string[];
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
  nextActionCandidate: ExtractTaskReintegrationEvidenceItem | null;
  personaSnapshotId: string | null;
  personaSnapshotSummary: string | null;
  personaContentPreview: string | null;
}

export interface ReintegrationRecordInput {
  workerTaskId: string;
  sourceNoteId: string | null;
  soulActionId: string | null;
  taskType: SupportedReintegrationTaskType;
  terminalStatus: TerminalWorkerTaskStatus;
  signalKind: ReintegrationSignalKind;
  target: ContinuityIntegrationResult['target'];
  strength: ContinuityIntegrationResult['strength'];
  summary: string;
  evidence: ReintegrationRecordEvidence;
}

export interface FeedbackReintegrationPayload {
  taskId: string;
  taskType: SupportedReintegrationTaskType;
  status: TerminalWorkerTaskStatus;
  resultSummary: string | null;
  error: string | null;
  sourceNoteId: string | null;
  outputNotePaths: string[];
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
}

export interface ActionOutcomePacket extends FeedbackReintegrationPayload {}

export function isSupportedReintegrationTaskType(taskType: WorkerTask['taskType']): taskType is SupportedReintegrationTaskType {
  return (SUPPORTED_REINTEGRATION_TASK_TYPES as readonly string[]).includes(taskType);
}

export function isTerminalWorkerTaskStatus(status: WorkerTask['status']): status is TerminalWorkerTaskStatus {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

export function getReintegrationSignalKind(taskType: SupportedReintegrationTaskType): ReintegrationSignalKind {
  switch (taskType) {
    case 'summarize_note':
      return 'summary_reintegration';
    case 'classify_inbox':
      return 'classification_reintegration';
    case 'extract_tasks':
      return 'task_extraction_reintegration';
    case 'update_persona_snapshot':
      return 'persona_snapshot_reintegration';
    case 'daily_report':
      return 'daily_report_reintegration';
    case 'weekly_report':
      return 'weekly_report_reintegration';
    case 'openclaw_task':
      return 'openclaw_reintegration';
  }
}

function getExtractTaskEvidence(task: WorkerTask<'extract_tasks'>): {
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
} {
  const result = task.result;
  if (!result) {
    return {
      extractTaskCreated: null,
      extractTaskItems: [],
    };
  }

  const outputNoteByPath = new Map((task.outputNotes ?? []).map((note) => [note.filePath, note]));
  return {
    extractTaskCreated: result.created,
    extractTaskItems: result.items.map((item) => ({
      title: item.title,
      dimension: item.dimension,
      priority: item.priority,
      due: item.due ?? null,
      filePath: item.filePath,
      outputNoteId: outputNoteByPath.get(item.filePath)?.id ?? null,
    })),
  };
}

function pickNextActionCandidate(items: ExtractTaskReintegrationEvidenceItem[]): ExtractTaskReintegrationEvidenceItem | null {
  if (!items.length) {
    return null;
  }

  const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
  } as const;

  return [...items].sort((left, right) => {
    const priorityCompare = (priorityRank[left.priority as keyof typeof priorityRank] ?? 99)
      - (priorityRank[right.priority as keyof typeof priorityRank] ?? 99);
    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    const leftDue = left.due ?? '9999-12-31';
    const rightDue = right.due ?? '9999-12-31';
    const dueCompare = leftDue.localeCompare(rightDue);
    if (dueCompare !== 0) {
      return dueCompare;
    }

    return left.filePath.localeCompare(right.filePath);
  })[0] ?? null;
}

export function createFeedbackReintegrationPayload(task: WorkerTask): FeedbackReintegrationPayload {
  if (!isSupportedReintegrationTaskType(task.taskType)) {
    throw new Error(`Unsupported reintegration task type: ${task.taskType}`);
  }

  if (!isTerminalWorkerTaskStatus(task.status)) {
    throw new Error(`Feedback reintegration requires a terminal WorkerTask: ${task.status}`);
  }

  const extractTaskEvidence = task.taskType === 'extract_tasks'
    ? getExtractTaskEvidence(task)
    : { extractTaskCreated: null, extractTaskItems: [] };

  return {
    taskId: task.id,
    taskType: task.taskType,
    status: task.status,
    resultSummary: task.resultSummary ?? null,
    error: task.error ?? null,
    sourceNoteId: task.sourceNoteId ?? null,
    outputNotePaths: [...(task.outputNotePaths ?? [])],
    extractTaskCreated: extractTaskEvidence.extractTaskCreated,
    extractTaskItems: extractTaskEvidence.extractTaskItems,
  };
}

export function createReintegrationRecordInput(task: WorkerTask, options: {
  soulActionId?: string | null;
  personaSnapshot?: PersonaSnapshot | null;
} = {}): ReintegrationRecordInput {
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);
  const personaSnapshot = options.personaSnapshot ?? null;
  const nextActionCandidate = pickNextActionCandidate(packet.extractTaskItems);

  return {
    workerTaskId: packet.taskId,
    sourceNoteId: packet.sourceNoteId,
    soulActionId: options.soulActionId ?? null,
    taskType: packet.taskType,
    terminalStatus: packet.status,
    signalKind: getReintegrationSignalKind(packet.taskType),
    target: continuity.target,
    strength: continuity.strength,
    summary: continuity.summary,
    evidence: {
      taskId: packet.taskId,
      taskType: packet.taskType,
      sourceNoteId: packet.sourceNoteId,
      resultSummary: packet.resultSummary,
      error: packet.error,
      outputNotePaths: packet.outputNotePaths,
      extractTaskCreated: packet.extractTaskCreated,
      extractTaskItems: packet.extractTaskItems,
      nextActionCandidate,
      personaSnapshotId: personaSnapshot?.id ?? null,
      personaSnapshotSummary: personaSnapshot?.summary ?? null,
      personaContentPreview: personaSnapshot?.snapshot.contentPreview ?? null,
    },
  };
}
