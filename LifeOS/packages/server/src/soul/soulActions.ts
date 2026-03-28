import type { WorkerTask, SoulActionDispatchExecutionSummary } from '@lifeos/shared';
import { getDb } from '../db/client.js';
import {
  SUPPORTED_SOUL_ACTION_KINDS,
  resolveSoulActionSourceReintegrationId,
  type SoulAction,
  type SoulActionExecutionStatus,
  type SoulActionGovernanceStatus,
  type SoulActionKind,
} from './types.js';
import { recordGateOutcome } from './gateLearning.js';

interface SoulActionRow {
  id: string;
  source_note_id: string;
  source_reintegration_id: string | null;
  action_kind: SoulActionKind;
  governance_status: SoulActionGovernanceStatus;
  execution_status: SoulActionExecutionStatus;
  governance_reason: string | null;
  worker_task_id: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  deferred_at: string | null;
  discarded_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  result_summary: string | null;
}

interface ListSoulActionsFilters {
  governanceStatus?: SoulActionGovernanceStatus;
  executionStatus?: SoulActionExecutionStatus;
  sourceNoteId?: string;
  sourceReintegrationId?: string;
  actionKind?: SoulActionKind;
}

function rowToSoulAction(row: SoulActionRow): SoulAction {
  return {
    id: row.id,
    sourceNoteId: row.source_note_id,
    sourceReintegrationId: row.source_reintegration_id,
    actionKind: row.action_kind,
    governanceStatus: row.governance_status,
    executionStatus: row.execution_status,
    governanceReason: row.governance_reason,
    workerTaskId: row.worker_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    deferredAt: row.deferred_at,
    discardedAt: row.discarded_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    resultSummary: row.result_summary,
  };
}

function usesReintegrationSourceIdentity(actionKind: SoulActionKind): boolean {
  return actionKind === 'create_event_node'
    || actionKind === 'promote_event_node'
    || actionKind === 'promote_continuity_record';
}

function getReintegrationIdentityActionKinds(): SoulActionKind[] {
  return SUPPORTED_SOUL_ACTION_KINDS.filter(usesReintegrationSourceIdentity);
}

function getSoulActionIdentityKey(input: {
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
}): string {
  if (usesReintegrationSourceIdentity(input.actionKind)) {
    return resolveSoulActionSourceReintegrationId(input) ?? input.sourceNoteId;
  }
  return input.sourceNoteId;
}

function buildSoulActionId(input: {
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
}): string {
  return `soul:${input.actionKind}:${getSoulActionIdentityKey(input)}`;
}

function getPersistedSoulActionExecutionSummary(soulAction: SoulAction | null | undefined): SoulActionDispatchExecutionSummary | null {
  if (!soulAction) {
    return null;
  }

  if (soulAction.workerTaskId) {
    return {
      objectType: 'worker_task',
      objectId: soulAction.workerTaskId,
      operation: soulAction.executionStatus === 'pending' ? 'enqueued' : null,
      summary: soulAction.resultSummary,
    };
  }

  return null;
}

export function attachSoulActionExecutionSummary(soulAction: SoulAction | null | undefined): (SoulAction & { executionSummary: SoulActionDispatchExecutionSummary | null }) | null {
  if (!soulAction) {
    return null;
  }

  return {
    ...soulAction,
    executionSummary: getPersistedSoulActionExecutionSummary(soulAction),
  };
}

function mapWorkerTaskStatusToExecutionStatus(status: WorkerTask['status']): SoulActionExecutionStatus {
  if (status === 'pending') return 'pending';
  if (status === 'running') return 'running';
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed') return 'failed';
  return 'cancelled';
}

function updateSoulActionGovernanceState(input: {
  id: string;
  governanceStatus: SoulActionGovernanceStatus;
  governanceReason?: string | null;
  approvedAt?: string | null;
  deferredAt?: string | null;
  discardedAt?: string | null;
  updatedAt?: string;
}): SoulAction | null {
  const now = input.updatedAt ?? new Date().toISOString();
  getDb().prepare(`
    UPDATE soul_actions
    SET governance_status = ?, governance_reason = ?, approved_at = ?, deferred_at = ?, discarded_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.governanceStatus,
    input.governanceReason ?? null,
    input.approvedAt ?? null,
    input.deferredAt ?? null,
    input.discardedAt ?? null,
    now,
    input.id,
  );

  return getSoulAction(input.id);
}

export function isSupportedSoulActionKind(value: unknown): value is SoulActionKind {
  return typeof value === 'string' && SUPPORTED_SOUL_ACTION_KINDS.includes(value as SoulActionKind);
}

export function deriveSoulActionKindFromWorkerTask(task: Pick<WorkerTask, 'taskType' | 'sourceNoteId'>): SoulActionKind | null {
  if (!task.sourceNoteId) return null;
  if (task.taskType === 'extract_tasks') return 'extract_tasks';
  if (task.taskType === 'update_persona_snapshot') return 'update_persona_snapshot';
  if (task.taskType === 'daily_report') return 'launch_daily_report';
  if (task.taskType === 'weekly_report') return 'launch_weekly_report';
  if (task.taskType === 'openclaw_task') return 'launch_openclaw_task';
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

export function getSoulActionBySourceReintegrationIdAndKind(sourceReintegrationId: string, actionKind: SoulActionKind): SoulAction | null {
  const row = getDb()
    .prepare('SELECT * FROM soul_actions WHERE source_reintegration_id = ? AND action_kind = ?')
    .get(sourceReintegrationId, actionKind) as SoulActionRow | undefined;
  return row ? rowToSoulAction(row) : null;
}

export function getSoulActionByIdentityAndKind(input: {
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
}): SoulAction | null {
  if (usesReintegrationSourceIdentity(input.actionKind)) {
    const sourceReintegrationId = resolveSoulActionSourceReintegrationId(input);
    if (sourceReintegrationId) {
      return getSoulActionBySourceReintegrationIdAndKind(sourceReintegrationId, input.actionKind);
    }
  }
  return getSoulActionBySourceNoteIdAndKind(input.sourceNoteId, input.actionKind);
}

export function getSoulActionByWorkerTaskId(workerTaskId: string): SoulAction | null {
  const row = getDb().prepare('SELECT * FROM soul_actions WHERE worker_task_id = ?').get(workerTaskId) as SoulActionRow | undefined;
  return row ? rowToSoulAction(row) : null;
}

export function createOrReuseSoulAction(input: {
  sourceNoteId: string;
  sourceReintegrationId?: string | null;
  actionKind: SoulActionKind;
  now?: string;
  governanceStatus?: SoulActionGovernanceStatus;
  executionStatus?: SoulActionExecutionStatus;
  governanceReason?: string | null;
}): SoulAction {
  const normalizedSourceReintegrationId = usesReintegrationSourceIdentity(input.actionKind)
    ? resolveSoulActionSourceReintegrationId(input)
    : input.sourceReintegrationId ?? null;
  const normalizedInput = {
    ...input,
    sourceReintegrationId: normalizedSourceReintegrationId,
  };
  const existing = getSoulActionByIdentityAndKind(normalizedInput);
  if (existing) {
    return existing;
  }

  const now = input.now ?? new Date().toISOString();
  const governanceStatus = input.governanceStatus ?? 'pending_review';
  const executionStatus = input.executionStatus ?? 'not_dispatched';
  const action: SoulAction = {
    id: buildSoulActionId(normalizedInput),
    sourceNoteId: input.sourceNoteId,
    sourceReintegrationId: normalizedSourceReintegrationId,
    actionKind: input.actionKind,
    governanceStatus,
    executionStatus,
    governanceReason: input.governanceReason ?? null,
    workerTaskId: null,
    createdAt: now,
    updatedAt: now,
    approvedAt: governanceStatus === 'approved' ? now : null,
    deferredAt: governanceStatus === 'deferred' ? now : null,
    discardedAt: governanceStatus === 'discarded' ? now : null,
    startedAt: null,
    finishedAt: null,
    error: null,
    resultSummary: null,
  };

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    action.id,
    action.sourceNoteId,
    action.sourceReintegrationId,
    action.actionKind,
    action.governanceStatus,
    action.executionStatus,
    action.governanceReason,
    action.workerTaskId,
    action.createdAt,
    action.updatedAt,
    action.approvedAt,
    action.deferredAt,
    action.discardedAt,
    action.startedAt,
    action.finishedAt,
    action.error,
    action.resultSummary,
  );

  return action;
}

export function approveSoulAction(id: string, governanceReason?: string | null, now = new Date().toISOString()): SoulAction | null {
  const action = getSoulAction(id);
  if (!action) return null;
  if (action.governanceStatus !== 'pending_review') {
    throw new Error('Only pending_review soul actions can be approved');
  }
  if (action.executionStatus !== 'not_dispatched') {
    throw new Error('Only not_dispatched soul actions can be approved');
  }

  const result = updateSoulActionGovernanceState({
    id,
    governanceStatus: 'approved',
    governanceReason: governanceReason ?? action.governanceReason,
    approvedAt: now,
    deferredAt: null,
    discardedAt: null,
    updatedAt: now,
  });

  if (result) {
    recordGateOutcome(result.actionKind, 'approved');
  }

  return result;
}

export function deferSoulAction(id: string, governanceReason?: string | null, now = new Date().toISOString()): SoulAction | null {
  const action = getSoulAction(id);
  if (!action) return null;
  if (!['pending_review', 'approved'].includes(action.governanceStatus)) {
    throw new Error('Only pending_review or approved soul actions can be deferred');
  }
  if (action.executionStatus !== 'not_dispatched') {
    throw new Error('Only not_dispatched soul actions can be deferred');
  }

  const result = updateSoulActionGovernanceState({
    id,
    governanceStatus: 'deferred',
    governanceReason: governanceReason ?? action.governanceReason,
    approvedAt: action.approvedAt,
    deferredAt: now,
    discardedAt: null,
    updatedAt: now,
  });

  if (result) {
    recordGateOutcome(result.actionKind, 'deferred');
  }

  return result;
}

export function discardSoulAction(id: string, governanceReason?: string | null, now = new Date().toISOString()): SoulAction | null {
  const action = getSoulAction(id);
  if (!action) return null;
  if (!['pending_review', 'approved', 'deferred'].includes(action.governanceStatus)) {
    throw new Error('Only pending_review, approved, or deferred soul actions can be discarded');
  }
  if (action.executionStatus !== 'not_dispatched') {
    throw new Error('Only not_dispatched soul actions can be discarded');
  }

  const result = updateSoulActionGovernanceState({
    id,
    governanceStatus: 'discarded',
    governanceReason: governanceReason ?? action.governanceReason,
    approvedAt: action.approvedAt,
    deferredAt: action.deferredAt,
    discardedAt: now,
    updatedAt: now,
  });

  if (result) {
    recordGateOutcome(result.actionKind, 'discarded');
  }

  return result;
}

export function resetSoulActionForRetry(id: string, now = new Date().toISOString()): SoulAction | null {
  const action = getSoulAction(id);
  if (!action) return null;
  if (action.executionStatus !== 'failed') {
    throw new Error('Only failed soul actions can be retried');
  }
  if (action.governanceStatus !== 'approved') {
    throw new Error('Only approved soul actions can be retried');
  }

  getDb().prepare(`
    UPDATE soul_actions
    SET execution_status = 'not_dispatched', worker_task_id = NULL, started_at = NULL, finished_at = NULL, error = NULL, result_summary = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, id);

  return getSoulAction(id);
}

export function attachWorkerTaskToSoulAction(soulActionId: string, workerTaskId: string, now = new Date().toISOString()): SoulAction | null {
  getDb().prepare(`
    UPDATE soul_actions
    SET worker_task_id = ?, execution_status = ?, updated_at = ?, started_at = NULL, finished_at = NULL, error = NULL, result_summary = NULL
    WHERE id = ?
  `).run(workerTaskId, 'pending', now, soulActionId);

  return getSoulAction(soulActionId);
}

export function markSoulActionDispatched(id: string, workerTaskId: string, now = new Date().toISOString()): SoulAction | null {
  const action = getSoulAction(id);
  if (!action) return null;
  if (action.governanceStatus !== 'approved') {
    throw new Error('Only approved soul actions can be dispatched');
  }
  if (action.executionStatus !== 'not_dispatched') {
    throw new Error('Only not_dispatched soul actions can be dispatched');
  }

  return attachWorkerTaskToSoulAction(id, workerTaskId, now);
}

export function syncSoulActionFromWorkerTask(task: WorkerTask): SoulAction | null {
  const actionKind = deriveSoulActionKindFromWorkerTask(task);
  if (!actionKind || !task.sourceNoteId) {
    return null;
  }

  const existing = getSoulActionByIdentityAndKind({
    sourceNoteId: task.sourceNoteId,
    sourceReintegrationId: task.sourceReintegrationId ?? null,
    actionKind,
  })
    ?? createOrReuseSoulAction({
      sourceNoteId: task.sourceNoteId,
      sourceReintegrationId: task.sourceReintegrationId ?? null,
      actionKind,
      now: task.updatedAt,
      governanceStatus: 'approved',
      executionStatus: mapWorkerTaskStatusToExecutionStatus(task.status),
    });

  getDb().prepare(`
    UPDATE soul_actions
    SET execution_status = ?, worker_task_id = ?, updated_at = ?, started_at = ?, finished_at = ?, error = ?, result_summary = ?
    WHERE id = ?
  `).run(
    mapWorkerTaskStatusToExecutionStatus(task.status),
    task.id,
    task.updatedAt,
    task.startedAt ?? null,
    task.finishedAt ?? null,
    task.error ?? null,
    task.resultSummary ?? null,
    existing.id,
  );

  return attachSoulActionExecutionSummary(getSoulAction(existing.id));
}

export function listSoulActions(filters?: ListSoulActionsFilters): SoulAction[] {
  const clauses: string[] = [];
  const params: Array<string> = [];

  if (filters?.governanceStatus) {
    clauses.push('governance_status = ?');
    params.push(filters.governanceStatus);
  }
  if (filters?.executionStatus) {
    clauses.push('execution_status = ?');
    params.push(filters.executionStatus);
  }
  if (filters?.sourceNoteId) {
    if (filters.sourceNoteId.startsWith('reint:') && !filters.sourceReintegrationId) {
      clauses.push(`(
        source_note_id = ?
        OR (
          action_kind IN (${getReintegrationIdentityActionKinds().map(() => '?').join(', ')})
          AND source_reintegration_id = ?
        )
      )`);
      params.push(filters.sourceNoteId, ...getReintegrationIdentityActionKinds(), filters.sourceNoteId);
    } else if (!filters.sourceReintegrationId) {
      clauses.push(`(
        source_note_id = ?
        OR (
          action_kind IN (${getReintegrationIdentityActionKinds().map(() => '?').join(', ')})
          AND source_reintegration_id IN (
            SELECT id FROM reintegration_records WHERE source_note_id = ?
          )
        )
      )`);
      params.push(filters.sourceNoteId, ...getReintegrationIdentityActionKinds(), filters.sourceNoteId);
    } else {
      clauses.push('source_note_id = ?');
      params.push(filters.sourceNoteId);
    }
  }
  if (filters?.sourceReintegrationId) {
    clauses.push('source_reintegration_id = ?');
    params.push(filters.sourceReintegrationId);
  }
  if (filters?.actionKind) {
    clauses.push('action_kind = ?');
    params.push(filters.actionKind);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().prepare(`SELECT * FROM soul_actions ${whereClause} ORDER BY created_at DESC`).all(...params) as SoulActionRow[];
  return rows.map(rowToSoulAction);
}
