import type {
  ActionOutcomePacket,
  ReintegrationRecordInput,
  TerminalWorkerTaskStatus,
  WorkerTask,
} from '@lifeos/shared';
import type { PersonaSnapshot } from '../soul/personaSnapshots.js';
import type { ReintegrationSignalKind as StoredReintegrationSignalKind } from '../soul/reintegrationRecords.js';
import { integrateContinuity } from './continuityIntegrator.js';
import {
  buildOutcomePacketExtractTaskEvidence,
  buildReintegrationRecordInputFromOutcomePacket,
  getOutcomeTaskSignalKind,
} from '../soul/reintegrationOutcome.js';
import { getSoulActionByWorkerTaskId } from '../soul/soulActions.js';

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

export type ReintegrationSignalKind = StoredReintegrationSignalKind;

export interface FeedbackReintegrationPayload extends ActionOutcomePacket {}
export type { ActionOutcomePacket } from '@lifeos/shared';

export function isSupportedReintegrationTaskType(taskType: WorkerTask['taskType']): taskType is SupportedReintegrationTaskType {
  return (SUPPORTED_REINTEGRATION_TASK_TYPES as readonly string[]).includes(taskType);
}

export function isTerminalWorkerTaskStatus(status: WorkerTask['status']): status is TerminalWorkerTaskStatus {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

export function getReintegrationSignalKind(taskType: SupportedReintegrationTaskType): ReintegrationSignalKind {
  return getOutcomeTaskSignalKind(taskType);
}

export function createFeedbackReintegrationPayload(task: WorkerTask): FeedbackReintegrationPayload {
  if (!isSupportedReintegrationTaskType(task.taskType)) {
    throw new Error(`Unsupported reintegration task type: ${task.taskType}`);
  }

  if (!isTerminalWorkerTaskStatus(task.status)) {
    throw new Error(`Feedback reintegration requires a terminal WorkerTask: ${task.status}`);
  }

  const extractTaskEvidence = task.taskType === 'extract_tasks'
    ? buildOutcomePacketExtractTaskEvidence(task as WorkerTask<'extract_tasks'>)
    : { extractTaskCreated: null, extractTaskItems: [] };

  const linkedSoulAction = getSoulActionByWorkerTaskId(task.id);

  return {
    taskId: task.id,
    taskType: task.taskType,
    status: task.status,
    resultSummary: task.resultSummary ?? null,
    error: task.error ?? null,
    sourceNoteId: task.sourceNoteId ?? null,
    sourceSoulActionId: linkedSoulAction?.id ?? null,
    sourceReintegrationId: linkedSoulAction?.sourceReintegrationId ?? null,
    outputNotePaths: [...(task.outputNotePaths ?? [])],
    extractTaskCreated: extractTaskEvidence.extractTaskCreated,
    extractTaskItems: extractTaskEvidence.extractTaskItems,
  };
}

export function createReintegrationRecordInput(task: WorkerTask, options: {
  soulActionId?: string | null;
  sourceReintegrationId?: string | null;
  personaSnapshot?: PersonaSnapshot | null;
} = {}): ReintegrationRecordInput {
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);
  return buildReintegrationRecordInputFromOutcomePacket(packet, continuity, options);
}
