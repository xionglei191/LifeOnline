import type { WorkerTask } from '@lifeos/shared';
import { getDb } from '../db/client.js';
import {
  SUPPORTED_SOUL_ACTION_KINDS,
  type SoulAction,
  type SoulActionKind,
  type SoulActionStatus,
} from './types.js';

interface SoulActionRow {
  id: string;
  source_note_id: string;
  action_kind: SoulActionKind;
  status: SoulActionStatus;
  worker_task_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  result_summary: string | null;
}

function rowToSoulAction(row: SoulActionRow): SoulAction {
  return {
    id: row.id,
    sourceNoteId: row.source_note_id,
    actionKind: row.action_kind,
    status: row.status,
    workerTaskId: row.worker_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    resultSummary: row.result_summary,
  };
}

function buildSoulActionId(sourceNoteId: string, actionKind: SoulActionKind): string {
  return `soul:${actionKind}:${sourceNoteId}`;
}

export function isSupportedSoulActionKind(value: unknown): value is SoulActionKind {
  return typeof value === 'string' && SUPPORTED_SOUL_ACTION_KINDS.includes(value as SoulActionKind);
}

export function deriveSoulActionKindFromWorkerTask(task: Pick<WorkerTask, 'taskType' | 'sourceNoteId'>): SoulActionKind | null {
  if (!task.sourceNoteId) return null;
  if (task.taskType === 'extract_tasks') return 'extract_tasks';
  if (task.taskType === 'update_persona_snapshot') return 'update_persona_snapshot';
  return null;
}

export function getSoulAction(id: string): SoulAction | null {
  const row = getDb().prepare('SELECT * FROM soul_actions WHERE id = ?').get(id) as SoulActionRow | undefined;
  return row ? rowToSoulAction(row) : null;
}

export function getSoulActionBySourceNoteIdAndKind(sourceNoteId: string, actionKind: SoulActionKind): SoulAction | null {
  const row = getDb()
    .prepare('SELECT * FROM soul_actions WHERE source_note_id = ? AND action_kind = ?')
    .get(sourceNoteId, actionKind) as SoulActionRow | undefined;
  return row ? rowToSoulAction(row) : null;
}

export function getSoulActionByWorkerTaskId(workerTaskId: string): SoulAction | null {
  const row = getDb().prepare('SELECT * FROM soul_actions WHERE worker_task_id = ?').get(workerTaskId) as SoulActionRow | undefined;
  return row ? rowToSoulAction(row) : null;
}

export function createOrReuseSoulAction(input: { sourceNoteId: string; actionKind: SoulActionKind; now?: string }): SoulAction {
  const existing = getSoulActionBySourceNoteIdAndKind(input.sourceNoteId, input.actionKind);
  if (existing) {
    return existing;
  }

  const now = input.now ?? new Date().toISOString();
  const action: SoulAction = {
    id: buildSoulActionId(input.sourceNoteId, input.actionKind),
    sourceNoteId: input.sourceNoteId,
    actionKind: input.actionKind,
    status: 'pending',
    workerTaskId: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    error: null,
    resultSummary: null,
  };

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, action_kind, status, worker_task_id,
      created_at, updated_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    action.id,
    action.sourceNoteId,
    action.actionKind,
    action.status,
    action.workerTaskId,
    action.createdAt,
    action.updatedAt,
    action.startedAt,
    action.finishedAt,
    action.error,
    action.resultSummary,
  );

  return action;
}

export function attachWorkerTaskToSoulAction(soulActionId: string, workerTaskId: string, now = new Date().toISOString()): SoulAction | null {
  getDb().prepare(`
    UPDATE soul_actions
    SET worker_task_id = ?, updated_at = ?
    WHERE id = ?
  `).run(workerTaskId, now, soulActionId);

  return getSoulAction(soulActionId);
}

export function syncSoulActionFromWorkerTask(task: WorkerTask): SoulAction | null {
  const actionKind = deriveSoulActionKindFromWorkerTask(task);
  if (!actionKind || !task.sourceNoteId) {
    return null;
  }

  const existing = getSoulActionBySourceNoteIdAndKind(task.sourceNoteId, actionKind)
    ?? createOrReuseSoulAction({ sourceNoteId: task.sourceNoteId, actionKind, now: task.updatedAt });

  getDb().prepare(`
    UPDATE soul_actions
    SET status = ?, worker_task_id = ?, updated_at = ?, started_at = ?, finished_at = ?, error = ?, result_summary = ?
    WHERE id = ?
  `).run(
    task.status,
    task.id,
    task.updatedAt,
    task.startedAt ?? null,
    task.finishedAt ?? null,
    task.error ?? null,
    task.resultSummary ?? null,
    existing.id,
  );

  return getSoulAction(existing.id);
}

export function listSoulActions(): SoulAction[] {
  const rows = getDb().prepare('SELECT * FROM soul_actions ORDER BY created_at DESC').all() as SoulActionRow[];
  return rows.map(rowToSoulAction);
}
