import { getDb } from '../db/client.js';
import type { ReintegrationSignalKind } from '../workers/feedbackReintegration.js';
import { getReintegrationRecordByWorkerTaskId, type ReintegrationRecord } from './reintegrationRecords.js';

interface ReintegrationRecordRow {
  id: string;
  worker_task_id: string;
  source_note_id: string | null;
  soul_action_id: string | null;
  task_type: string;
  terminal_status: 'succeeded' | 'failed' | 'cancelled';
  signal_kind: string;
  review_status: 'pending_review' | 'accepted' | 'rejected';
  target: 'source_note' | 'derived_outputs' | 'task_record';
  strength: 'low' | 'medium';
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
    taskType: row.task_type as ReintegrationRecord['taskType'],
    terminalStatus: row.terminal_status,
    signalKind: row.signal_kind as ReintegrationSignalKind,
    reviewStatus: row.review_status,
    target: row.target,
    strength: row.strength,
    summary: row.summary,
    evidence: JSON.parse(row.evidence_json) as Record<string, unknown>,
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  };
}

export function listReintegrationRecords(filters?: { reviewStatus?: ReintegrationRecord['reviewStatus'] }): ReintegrationRecord[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filters?.reviewStatus) {
    clauses.push('review_status = ?');
    params.push(filters.reviewStatus);
  }
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().prepare(`SELECT * FROM reintegration_records ${whereClause} ORDER BY created_at DESC`).all(...params) as ReintegrationRecordRow[];
  return rows.map(rowToReintegrationRecord);
}

function updateReintegrationReviewStatus(id: string, reviewStatus: 'accepted' | 'rejected', reason: string | null, now = new Date().toISOString()): ReintegrationRecord | null {
  const row = getDb().prepare('SELECT * FROM reintegration_records WHERE id = ?').get(id) as ReintegrationRecordRow | undefined;
  if (!row) return null;
  getDb().prepare(`
    UPDATE reintegration_records
    SET review_status = ?, review_reason = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reviewStatus, reason, now, now, id);
  const updated = getDb().prepare('SELECT * FROM reintegration_records WHERE id = ?').get(id) as ReintegrationRecordRow | undefined;
  return updated ? rowToReintegrationRecord(updated) : null;
}

export function acceptReintegrationRecord(id: string, reason: string | null): ReintegrationRecord | null {
  return updateReintegrationReviewStatus(id, 'accepted', reason);
}

export function rejectReintegrationRecord(id: string, reason: string | null): ReintegrationRecord | null {
  return updateReintegrationReviewStatus(id, 'rejected', reason);
}

export function getReintegrationRecord(id: string): ReintegrationRecord | null {
  const row = getDb().prepare('SELECT * FROM reintegration_records WHERE id = ?').get(id) as ReintegrationRecordRow | undefined;
  return row ? rowToReintegrationRecord(row) : null;
}
