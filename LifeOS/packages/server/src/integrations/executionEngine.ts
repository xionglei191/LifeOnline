/**
 * Execution Engine — manages the lifecycle of PhysicalActions.
 *
 * State machine: pending → approved → executing → completed / failed
 *                pending → rejected
 *
 * All state transitions are persisted to the `physical_actions` DB table.
 */
import { getDb } from '../db/client.js';
import { Logger } from '../utils/logger.js';
import type { PhysicalAction, PhysicalActionType, PhysicalActionPayload, CalendarEventPayload } from '@lifeos/shared';
import { evaluateActionStatus } from './approvalGate.js';
import { executeCalendarEvent } from './calendarProtocol.js';
import { createWorkerTask, startWorkerTaskExecution } from '../workers/workerTasks.js';
import { isBreakerOpen } from './circuitBreaker.js';
import { randomUUID } from 'crypto';

const logger = new Logger('executionEngine');

// ---------------------------------------------------------------------------
// DB Helpers
// ---------------------------------------------------------------------------

function rowToAction(row: any): PhysicalAction {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    sourceSoulActionId: row.source_soul_action_id,
    sourceNoteId: row.source_note_id,
    title: row.title,
    description: row.description || '',
    payload: JSON.parse(row.payload_json),
    approvalPolicy: row.approval_policy,
    autoApproveKey: row.auto_approve_key,
    executionLog: row.execution_log,
    externalId: row.external_id,
    errorMessage: row.error_message,
    dryRunPreview: row.dry_run_preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    executedAt: row.executed_at,
  };
}

function insertAction(action: PhysicalAction): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO physical_actions (
      id, type, status, source_soul_action_id, source_note_id,
      title, description, payload_json, approval_policy, auto_approve_key,
      execution_log, external_id, error_message, dry_run_preview,
      created_at, updated_at, approved_at, executed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    action.id, action.type, action.status,
    action.sourceSoulActionId, action.sourceNoteId,
    action.title, action.description, JSON.stringify(action.payload),
    action.approvalPolicy, action.autoApproveKey,
    action.executionLog, action.externalId, action.errorMessage, action.dryRunPreview,
    action.createdAt, action.updatedAt, action.approvedAt, action.executedAt,
  );
}

function updateActionStatus(id: string, status: string, extra: Record<string, string | null> = {}): void {
  const db = getDb();
  const sets = ['status = ?', 'updated_at = ?'];
  const vals: (string | null)[] = [status, new Date().toISOString()];
  for (const [k, v] of Object.entries(extra)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  db.prepare(`UPDATE physical_actions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a new PhysicalAction. Persists to DB and optionally auto-executes.
 */
export async function submitPhysicalAction(
  type: PhysicalActionType,
  payload: PhysicalActionPayload,
  title: string,
  sourceNoteId?: string,
  sourceSoulActionId?: string,
): Promise<PhysicalAction> {
  const initialStatus = evaluateActionStatus(type);
  const now = new Date().toISOString();

  const action: PhysicalAction = {
    id: randomUUID(),
    type,
    status: initialStatus,
    sourceSoulActionId: sourceSoulActionId || null,
    sourceNoteId: sourceNoteId || null,
    title,
    description: '',
    payload,
    approvalPolicy: 'always_ask',
    autoApproveKey: null,
    executionLog: null,
    externalId: null,
    errorMessage: null,
    dryRunPreview: null,
    createdAt: now,
    updatedAt: now,
    approvedAt: initialStatus === 'approved' ? now : null,
    executedAt: null,
  };

  insertAction(action);
  logger.info(`PhysicalAction submitted: ${action.id} (${type}) → ${initialStatus}`);

  if (action.status === 'approved') {
    const task = createWorkerTask({
      taskType: 'execute_physical_action',
      input: { actionId: action.id }
    });
    startWorkerTaskExecution(task.id);
  }

  return action;
}

/**
 * Approve a pending action.
 */
export function approveAction(id: string): PhysicalAction | null {
  const action = getPhysicalAction(id);
  if (!action || action.status !== 'pending') return null;

  // Circuit breaker check — if breaker is open, log warning but still allow manual approval
  if (isBreakerOpen(action.type)) {
    logger.warn(`Circuit breaker is OPEN for "${action.type}" — proceeding with manual approval for ${id}`);
  }

  const now = new Date().toISOString();
  updateActionStatus(id, 'approved', { approved_at: now });

  // Trigger execution asynchronously
  const task = createWorkerTask({
    taskType: 'execute_physical_action',
    input: { actionId: id }
  });
  startWorkerTaskExecution(task.id);

  return { ...action, status: 'approved', approvedAt: now, updatedAt: now };
}

/**
 * Reject a pending action.
 */
export function rejectAction(id: string): PhysicalAction | null {
  const action = getPhysicalAction(id);
  if (!action || action.status !== 'pending') return null;

  updateActionStatus(id, 'rejected');
  return { ...action, status: 'rejected', updatedAt: new Date().toISOString() };
}

/**
 * Execute an approved action by routing to the appropriate protocol.
 */
export async function executeAction(id: string): Promise<PhysicalAction> {
  const action = getPhysicalAction(id);
  if (!action) throw new Error(`PhysicalAction not found: ${id}`);
  if (action.status !== 'approved' && action.status !== 'failed') {
    throw new Error(`Action ${id} is not executable (status: ${action.status})`);
  }

  updateActionStatus(id, 'executing');

  let success = false;
  let externalId: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (action.type === 'calendar_event') {
      success = await executeCalendarEvent(action.payload as CalendarEventPayload);
    } else {
      logger.warn(`Protocol for ${action.type} not yet implemented.`);
    }
  } catch (err: any) {
    errorMessage = err.message || 'Unknown protocol error';
    logger.error(`Execution failed for ${id}:`, err);
  }

  const finalStatus = success ? 'completed' : 'failed';
  updateActionStatus(id, finalStatus, {
    executed_at: new Date().toISOString(),
    external_id: externalId,
    error_message: success ? null : (errorMessage || 'Protocol returned false'),
  });

  logger.info(`PhysicalAction ${id} → ${finalStatus}`);
  return getPhysicalAction(id)!;
}

/**
 * List physical actions, optionally filtered by status.
 */
export function listPhysicalActions(status?: string, limit = 50): PhysicalAction[] {
  const db = getDb();
  let sql = 'SELECT * FROM physical_actions';
  const params: any[] = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToAction);
}

/**
 * Get a single physical action by ID.
 */
export function getPhysicalAction(id: string): PhysicalAction | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM physical_actions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToAction(row) : null;
}
