import { getDb } from '../db/client.js';
import type { ContinuityRecordKind } from './types.js';
import type { ContinuityTarget } from '../workers/continuityIntegrator.js';

export interface ContinuityRecord {
  id: string;
  sourceReintegrationId: string;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  promotionSoulActionId: string;
  continuityKind: ContinuityRecordKind;
  target: ContinuityTarget;
  strength: 'medium';
  summary: string;
  continuity: Record<string, unknown>;
  evidence: Record<string, unknown>;
  explanation: Record<string, unknown>;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ContinuityRecordRow {
  id: string;
  source_reintegration_id: string;
  source_note_id: string | null;
  source_soul_action_id: string | null;
  promotion_soul_action_id: string;
  continuity_kind: ContinuityRecordKind;
  target: ContinuityTarget;
  strength: 'medium';
  summary: string;
  continuity_json: string;
  evidence_json: string;
  explanation_json: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

function rowToContinuityRecord(row: ContinuityRecordRow): ContinuityRecord {
  return {
    id: row.id,
    sourceReintegrationId: row.source_reintegration_id,
    sourceNoteId: row.source_note_id,
    sourceSoulActionId: row.source_soul_action_id,
    promotionSoulActionId: row.promotion_soul_action_id,
    continuityKind: row.continuity_kind,
    target: row.target,
    strength: row.strength,
    summary: row.summary,
    continuity: JSON.parse(row.continuity_json) as Record<string, unknown>,
    evidence: JSON.parse(row.evidence_json) as Record<string, unknown>,
    explanation: JSON.parse(row.explanation_json) as Record<string, unknown>,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildContinuityRecordId(sourceReintegrationId: string): string {
  return `continuity:${sourceReintegrationId}`;
}

export function getContinuityRecordBySourceReintegrationId(sourceReintegrationId: string): ContinuityRecord | null {
  const row = getDb().prepare('SELECT * FROM continuity_records WHERE source_reintegration_id = ?').get(sourceReintegrationId) as ContinuityRecordRow | undefined;
  return row ? rowToContinuityRecord(row) : null;
}

export function upsertContinuityRecord(input: Omit<ContinuityRecord, 'id' | 'createdAt' | 'updatedAt'> & { now?: string }): ContinuityRecord {
  const existing = getContinuityRecordBySourceReintegrationId(input.sourceReintegrationId);
  const now = input.now ?? new Date().toISOString();
  const id = existing?.id ?? buildContinuityRecordId(input.sourceReintegrationId);
  const createdAt = existing?.createdAt ?? now;

  getDb().prepare(`
    INSERT INTO continuity_records (
      id, source_reintegration_id, source_note_id, source_soul_action_id, promotion_soul_action_id,
      continuity_kind, target, strength, summary, continuity_json, evidence_json, explanation_json,
      recorded_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_reintegration_id) DO UPDATE SET
      source_note_id = excluded.source_note_id,
      source_soul_action_id = excluded.source_soul_action_id,
      promotion_soul_action_id = excluded.promotion_soul_action_id,
      continuity_kind = excluded.continuity_kind,
      target = excluded.target,
      strength = excluded.strength,
      summary = excluded.summary,
      continuity_json = excluded.continuity_json,
      evidence_json = excluded.evidence_json,
      explanation_json = excluded.explanation_json,
      recorded_at = excluded.recorded_at,
      updated_at = excluded.updated_at
  `).run(
    id,
    input.sourceReintegrationId,
    input.sourceNoteId,
    input.sourceSoulActionId,
    input.promotionSoulActionId,
    input.continuityKind,
    input.target,
    input.strength,
    input.summary,
    JSON.stringify(input.continuity),
    JSON.stringify(input.evidence),
    JSON.stringify(input.explanation),
    input.recordedAt,
    createdAt,
    now,
  );

  const continuityRecord = getContinuityRecordBySourceReintegrationId(input.sourceReintegrationId);
  if (!continuityRecord) {
    throw new Error('Continuity record disappeared after upsert');
  }
  return continuityRecord;
}

export function listContinuityRecords(): ContinuityRecord[] {
  const rows = getDb().prepare('SELECT * FROM continuity_records ORDER BY created_at DESC').all() as ContinuityRecordRow[];
  return rows.map(rowToContinuityRecord);
}
