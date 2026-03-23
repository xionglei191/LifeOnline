import { getDb } from '../db/client.js';
import type { ReintegrationSignalKind } from '../workers/feedbackReintegration.js';
import { getReintegrationNextActionSummary as getSharedReintegrationNextActionSummary, type ReintegrationNextActionSummary, type ReintegrationRecord } from '@lifeos/shared';
import { planPromotionSoulActions } from './reintegrationPromotionPlanner.js';
import { getReintegrationRecordByWorkerTaskId } from './reintegrationRecords.js';

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
    evidence: JSON.parse(row.evidence_json),
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  };
}

export function listReintegrationRecords(filters?: {
  reviewStatus?: ReintegrationRecord['reviewStatus'];
  sourceNoteId?: string;
}): ReintegrationRecord[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filters?.reviewStatus) {
    clauses.push('review_status = ?');
    params.push(filters.reviewStatus);
  }
  if (filters?.sourceNoteId) {
    clauses.push('source_note_id = ?');
    params.push(filters.sourceNoteId);
  }
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().prepare(`SELECT * FROM reintegration_records ${whereClause} ORDER BY created_at DESC`).all(...params) as ReintegrationRecordRow[];
  return rows.map(rowToReintegrationRecord);
}

function updateReintegrationReviewStatus(id: string, reviewStatus: 'accepted' | 'rejected', reason: string | null, now = new Date().toISOString()): ReintegrationRecord | null {
  const row = getDb().prepare('SELECT * FROM reintegration_records WHERE id = ?').get(id) as ReintegrationRecordRow | undefined;
  if (!row) return null;
  if (row.review_status !== 'pending_review') {
    throw new Error(`Only pending_review reintegration records can be marked as ${reviewStatus}`);
  }
  getDb().prepare(`
    UPDATE reintegration_records
    SET review_status = ?, review_reason = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reviewStatus, reason, now, now, id);
  const updated = getDb().prepare('SELECT * FROM reintegration_records WHERE id = ?').get(id) as ReintegrationRecordRow | undefined;
  return updated ? rowToReintegrationRecord(updated) : null;
}

export function getReintegrationNextActionSummary(record: ReintegrationRecord): ReintegrationNextActionSummary | null {
  return getSharedReintegrationNextActionSummary(record);
}

export function acceptReintegrationRecord(id: string, reason: string | null): ReintegrationRecord | null {
  return updateReintegrationReviewStatus(id, 'accepted', reason);
}

export function acceptReintegrationRecordAndPlanPromotions(id: string, reason: string | null): {
  reintegrationRecord: ReintegrationRecord;
  soulActions: ReturnType<typeof planPromotionSoulActions>;
} | null {
  const reintegrationRecord = acceptReintegrationRecord(id, reason);
  if (!reintegrationRecord) {
    return null;
  }

  return {
    reintegrationRecord,
    soulActions: planPromotionSoulActions(reintegrationRecord),
  };
}

export function rejectReintegrationRecord(id: string, reason: string | null): ReintegrationRecord | null {
  return updateReintegrationReviewStatus(id, 'rejected', reason);
}

export function getReintegrationRecord(id: string): ReintegrationRecord | null {
  const row = getDb().prepare('SELECT * FROM reintegration_records WHERE id = ?').get(id) as ReintegrationRecordRow | undefined;
  return row ? rowToReintegrationRecord(row) : null;
}

export function hasAcceptedProjectionVisibility(sourceReintegrationId: string | null | undefined): boolean {
  if (!sourceReintegrationId) {
    return false;
  }

  return getReintegrationRecord(sourceReintegrationId)?.reviewStatus === 'accepted';
}

export function filterAcceptedProjectionReintegrationIds(sourceReintegrationIds: string[] | undefined): string[] | undefined {
  if (!sourceReintegrationIds?.length) {
    return sourceReintegrationIds;
  }

  const visibleIds = sourceReintegrationIds.filter((id) => hasAcceptedProjectionVisibility(id));
  return visibleIds.length ? visibleIds : [];
}

export function listAcceptedProjectionReintegrationIds(): string[] {
  const rows = getDb().prepare(`
    SELECT id FROM reintegration_records
    WHERE review_status = 'accepted'
    ORDER BY created_at DESC
  `).all() as Array<{ id: string }>;
  return rows.map((row) => row.id);
}
