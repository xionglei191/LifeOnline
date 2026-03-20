import { getDb } from '../db/client.js';
import type { EventKind } from './types.js';

export interface EventNode {
  id: string;
  sourceReintegrationId: string;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  promotionSoulActionId: string;
  eventKind: EventKind;
  title: string;
  summary: string;
  threshold: 'high';
  status: 'active';
  evidence: Record<string, unknown>;
  explanation: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

interface EventNodeRow {
  id: string;
  source_reintegration_id: string;
  source_note_id: string | null;
  source_soul_action_id: string | null;
  promotion_soul_action_id: string;
  event_kind: EventKind;
  title: string;
  summary: string;
  threshold: 'high';
  status: 'active';
  evidence_json: string;
  explanation_json: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

function rowToEventNode(row: EventNodeRow): EventNode {
  return {
    id: row.id,
    sourceReintegrationId: row.source_reintegration_id,
    sourceNoteId: row.source_note_id,
    sourceSoulActionId: row.source_soul_action_id,
    promotionSoulActionId: row.promotion_soul_action_id,
    eventKind: row.event_kind,
    title: row.title,
    summary: row.summary,
    threshold: row.threshold,
    status: row.status,
    evidence: JSON.parse(row.evidence_json) as Record<string, unknown>,
    explanation: JSON.parse(row.explanation_json) as Record<string, unknown>,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildEventNodeId(sourceReintegrationId: string): string {
  return `event:${sourceReintegrationId}`;
}

export function getEventNodeBySourceReintegrationId(sourceReintegrationId: string): EventNode | null {
  const row = getDb().prepare('SELECT * FROM event_nodes WHERE source_reintegration_id = ?').get(sourceReintegrationId) as EventNodeRow | undefined;
  return row ? rowToEventNode(row) : null;
}

export function upsertEventNode(input: Omit<EventNode, 'id' | 'createdAt' | 'updatedAt'> & { now?: string }): EventNode {
  const existing = getEventNodeBySourceReintegrationId(input.sourceReintegrationId);
  const now = input.now ?? new Date().toISOString();
  const id = existing?.id ?? buildEventNodeId(input.sourceReintegrationId);
  const createdAt = existing?.createdAt ?? now;

  getDb().prepare(`
    INSERT INTO event_nodes (
      id, source_reintegration_id, source_note_id, source_soul_action_id, promotion_soul_action_id,
      event_kind, title, summary, threshold, status, evidence_json, explanation_json, occurred_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_reintegration_id) DO UPDATE SET
      source_note_id = excluded.source_note_id,
      source_soul_action_id = excluded.source_soul_action_id,
      promotion_soul_action_id = excluded.promotion_soul_action_id,
      event_kind = excluded.event_kind,
      title = excluded.title,
      summary = excluded.summary,
      threshold = excluded.threshold,
      status = excluded.status,
      evidence_json = excluded.evidence_json,
      explanation_json = excluded.explanation_json,
      occurred_at = excluded.occurred_at,
      updated_at = excluded.updated_at
  `).run(
    id,
    input.sourceReintegrationId,
    input.sourceNoteId,
    input.sourceSoulActionId,
    input.promotionSoulActionId,
    input.eventKind,
    input.title,
    input.summary,
    input.threshold,
    input.status,
    JSON.stringify(input.evidence),
    JSON.stringify(input.explanation),
    input.occurredAt,
    createdAt,
    now,
  );

  const eventNode = getEventNodeBySourceReintegrationId(input.sourceReintegrationId);
  if (!eventNode) {
    throw new Error('Event node disappeared after upsert');
  }
  return eventNode;
}

export function listEventNodes(): EventNode[] {
  const rows = getDb().prepare('SELECT * FROM event_nodes ORDER BY created_at DESC').all() as EventNodeRow[];
  return rows.map(rowToEventNode);
}
