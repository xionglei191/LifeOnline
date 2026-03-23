import { getDb } from '../db/client.js';
import type { ReintegrationRecord, ReintegrationRecordInput, TerminalWorkerTaskStatus } from '@lifeos/shared';
import type { SupportedReintegrationTaskType } from '../workers/feedbackReintegration.js';
import type { ContinuityStrength, ContinuityTarget } from '../workers/continuityIntegrator.js';

export type ReintegrationReviewStatus = 'pending_review' | 'accepted' | 'rejected';
export type ReintegrationSignalKind =
  | 'summary_reintegration'
  | 'classification_reintegration'
  | 'task_extraction_reintegration'
  | 'persona_snapshot_reintegration'
  | 'daily_report_reintegration'
  | 'weekly_report_reintegration'
  | 'openclaw_reintegration';

export type { ReintegrationRecord } from '@lifeos/shared';

interface ReintegrationRecordRow {
  id: string;
  worker_task_id: string;
  source_note_id: string | null;
  soul_action_id: string | null;
  task_type: SupportedReintegrationTaskType;
  terminal_status: TerminalWorkerTaskStatus;
  signal_kind: string;
  review_status: ReintegrationReviewStatus;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  summary: string;
  evidence_json: string;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

function rowToReintegrationRecord(row: ReintegrationRecordRow): ReintegrationRecord {
  return {
    id: row.id,
    workerTaskId: row.worker_task_id,
    sourceNoteId: row.source_note_id,
    soulActionId: row.soul_action_id,
    taskType: row.task_type,
    terminalStatus: row.terminal_status,
    signalKind: row.signal_kind as ReintegrationSignalKind,
    reviewStatus: row.review_status,
    target: row.target,
    strength: row.strength,
    summary: row.summary,
    evidence: JSON.parse(row.evidence_json),
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  };
}

export function buildReintegrationRecordId(workerTaskId: string): string {
  return `reint:${workerTaskId}`;
}

export function getReintegrationRecordByWorkerTaskId(workerTaskId: string): ReintegrationRecord | null {
  const row = getDb().prepare('SELECT * FROM reintegration_records WHERE worker_task_id = ?').get(workerTaskId) as ReintegrationRecordRow | undefined;
  return row ? rowToReintegrationRecord(row) : null;
}

export function upsertReintegrationRecord(input: ReintegrationRecordInput & {
  reviewStatus?: ReintegrationReviewStatus;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  now?: string;
}): ReintegrationRecord {
  const existing = getReintegrationRecordByWorkerTaskId(input.workerTaskId);
  const now = input.now ?? new Date().toISOString();
  const id = existing?.id ?? buildReintegrationRecordId(input.workerTaskId);
  const createdAt = existing?.createdAt ?? now;
  const reviewStatus = input.reviewStatus ?? existing?.reviewStatus ?? 'pending_review';
  const reviewReason = input.reviewReason ?? existing?.reviewReason ?? null;
  const reviewedAt = input.reviewedAt !== undefined
    ? input.reviewedAt
    : existing?.reviewedAt ?? (reviewStatus === 'pending_review' ? null : now);

  if (existing) {
    getDb().prepare(`
      UPDATE reintegration_records
      SET source_note_id = ?, soul_action_id = ?, task_type = ?, terminal_status = ?, signal_kind = ?,
          review_status = ?, target = ?, strength = ?, summary = ?, evidence_json = ?, review_reason = ?,
          updated_at = ?, reviewed_at = ?
      WHERE worker_task_id = ?
    `).run(
      input.sourceNoteId ?? null,
      input.soulActionId ?? null,
      input.taskType,
      input.terminalStatus,
      input.signalKind,
      reviewStatus,
      input.target,
      input.strength,
      input.summary,
      JSON.stringify(input.evidence),
      reviewReason,
      now,
      reviewedAt,
      input.workerTaskId,
    );
  } else {
    getDb().prepare(`
      INSERT INTO reintegration_records (
        id, worker_task_id, source_note_id, soul_action_id, task_type, terminal_status, signal_kind,
        review_status, target, strength, summary, evidence_json, review_reason, created_at, updated_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.workerTaskId,
      input.sourceNoteId ?? null,
      input.soulActionId ?? null,
      input.taskType,
      input.terminalStatus,
      input.signalKind,
      reviewStatus,
      input.target,
      input.strength,
      input.summary,
      JSON.stringify(input.evidence),
      reviewReason,
      createdAt,
      now,
      reviewedAt,
    );
  }

  const record = getReintegrationRecordByWorkerTaskId(input.workerTaskId);
  if (!record) {
    throw new Error('Reintegration record disappeared after upsert');
  }
  return record;
}
