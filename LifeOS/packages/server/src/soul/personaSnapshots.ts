import { getDb } from '../db/client.js';

export interface PersonaSnapshotPayload {
  sourceNoteTitle: string;
  summary: string;
  contentPreview: string;
  updatedAt: string;
}

export interface PersonaSnapshot {
  id: string;
  sourceNoteId: string;
  soulActionId: string | null;
  workerTaskId: string | null;
  summary: string;
  snapshot: PersonaSnapshotPayload;
  createdAt: string;
  updatedAt: string;
}

interface PersonaSnapshotRow {
  id: string;
  source_note_id: string;
  soul_action_id: string | null;
  worker_task_id: string | null;
  summary: string;
  snapshot_json: string;
  created_at: string;
  updated_at: string;
}

function rowToPersonaSnapshot(row: PersonaSnapshotRow): PersonaSnapshot {
  return {
    id: row.id,
    sourceNoteId: row.source_note_id,
    soulActionId: row.soul_action_id,
    workerTaskId: row.worker_task_id,
    summary: row.summary,
    snapshot: JSON.parse(row.snapshot_json) as PersonaSnapshotPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildPersonaSnapshotId(sourceNoteId: string): string {
  return `persona:${sourceNoteId}`;
}

export function getPersonaSnapshotBySourceNoteId(sourceNoteId: string): PersonaSnapshot | null {
  const row = getDb()
    .prepare('SELECT * FROM persona_snapshots WHERE source_note_id = ?')
    .get(sourceNoteId) as PersonaSnapshotRow | undefined;
  return row ? rowToPersonaSnapshot(row) : null;
}

export function upsertPersonaSnapshot(input: {
  sourceNoteId: string;
  soulActionId?: string | null;
  workerTaskId?: string | null;
  summary: string;
  snapshot: PersonaSnapshotPayload;
  now?: string;
}): PersonaSnapshot {
  const existing = getPersonaSnapshotBySourceNoteId(input.sourceNoteId);
  const now = input.now ?? new Date().toISOString();
  const id = existing?.id ?? buildPersonaSnapshotId(input.sourceNoteId);
  const createdAt = existing?.createdAt ?? now;

  getDb().prepare(`
    INSERT INTO persona_snapshots (
      id, source_note_id, soul_action_id, worker_task_id, summary, snapshot_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_note_id) DO UPDATE SET
      soul_action_id = excluded.soul_action_id,
      worker_task_id = excluded.worker_task_id,
      summary = excluded.summary,
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `).run(
    id,
    input.sourceNoteId,
    input.soulActionId ?? null,
    input.workerTaskId ?? null,
    input.summary,
    JSON.stringify(input.snapshot),
    createdAt,
    now,
  );

  const snapshot = getPersonaSnapshotBySourceNoteId(input.sourceNoteId);
  if (!snapshot) {
    throw new Error('Persona snapshot disappeared after upsert');
  }
  return snapshot;
}
