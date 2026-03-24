/**
 * WorkerTasks — core framework for task creation, CRUD, execution, and lifecycle management.
 *
 * Task-type-specific execution logic lives in ./executors/*.ts.
 * This file handles:
 * - Task type definitions & input validation
 * - Task CRUD (create, get, list, update, cancel, retry, clear)
 * - Execution framework (start, execute, finalize)
 * - Soul action binding & reintegration
 */
import {
  SUPPORTED_WORKER_TASK_TYPES,
  type CreateWorkerTaskRequest,
  type WorkerTask,
  type WorkerTaskInputMap,
  type WorkerTaskListFilters,
  type WorkerTaskResultMap,
  type WorkerTaskStatus,
  type WorkerTaskType,
  type WorkerName,
} from '@lifeos/shared';
import { getDb } from '../db/client.js';
import { broadcastUpdate } from '../index.js';
import { getTodayDateString, getWeekStartDateString } from '../utils/date.js';
import { createReintegrationRecordInput } from './feedbackReintegration.js';
import {
  attachWorkerTaskToSoulAction,
  createOrReuseSoulAction,
  deriveSoulActionKindFromWorkerTask,
  getSoulActionByIdentityAndKind,
  getSoulActionByWorkerTaskId,
  syncSoulActionFromWorkerTask,
} from '../soul/soulActions.js';
import { upsertReintegrationRecord } from '../soul/reintegrationRecords.js';
import { getPersonaSnapshotBySourceNoteId } from '../soul/personaSnapshots.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('workerTasks');
import { buildOutputNote } from './executors/shared.js';

// ── Executor imports ──
import { runOpenClawTaskExecutor, persistOpenClawResult, summarizeOpenClawResult } from './executors/openclawExecutor.js';
import { runSummarizeNoteDirect, persistSummarizeNoteResult, summarizeSummarizeNoteResult } from './executors/summarizeNoteExecutor.js';
import { runClassifyInbox, persistClassifyInboxResult, summarizeClassifyInboxResult } from './executors/classifyInboxExecutor.js';
import { runExtractTasks, summarizeExtractTasksResult } from './executors/extractTasksExecutor.js';
import { runUpdatePersonaSnapshot, summarizeUpdatePersonaSnapshotResult } from './executors/personaSnapshotExecutor.js';
import { runDailyReport, persistDailyReportResult, summarizeDailyReportResult, runWeeklyReport, persistWeeklyReportResult, summarizeWeeklyReportResult } from './executors/reportExecutors.js';

// ── Types ──

interface WorkerTaskRow {
  id: string;
  task_type: WorkerTask['taskType'];
  input_json: string;
  status: WorkerTaskStatus;
  worker: WorkerTask['worker'];
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  result_json: string | null;
  result_summary: string | null;
  source_note_id: string | null;
  source_reintegration_id: string | null;
  output_note_paths: string | null;
  schedule_id: string | null;
}

const runningTaskControllers = new Map<string, AbortController>();

// ── Validation ──

export class WorkerTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerTaskValidationError';
  }
}

export function isSupportedWorkerTaskType(value: unknown): value is WorkerTaskType {
  return typeof value === 'string' && SUPPORTED_WORKER_TASK_TYPES.includes(value as WorkerTaskType);
}

function throwWorkerTaskValidationError(message: string): never {
  throw new WorkerTaskValidationError(message);
}

// ── Task Type Definitions (input normalization + worker assignment) ──

type WorkerTaskDefinition<T extends WorkerTaskType> = {
  worker: WorkerName;
  normalizeInput: (input: Partial<WorkerTaskInputMap[T]> | undefined) => WorkerTaskInputMap[T];
};

type WorkerTaskDefinitionMap = {
  [T in WorkerTaskType]: WorkerTaskDefinition<T>;
};

const workerTaskDefinitions: WorkerTaskDefinitionMap = {
  openclaw_task: {
    worker: 'openclaw',
    normalizeInput: (input) => {
      if (!input?.instruction?.trim()) throwWorkerTaskValidationError('openclaw_task requires instruction');
      return {
        instruction: input.instruction.trim(),
        outputDimension: input.outputDimension?.trim() || 'learning',
      };
    },
  },
  summarize_note: {
    worker: 'lifeos',
    normalizeInput: (input) => {
      if (!input?.noteId) throwWorkerTaskValidationError('summarize_note requires noteId');
      return {
        noteId: input.noteId,
        language: input.language?.trim() || 'zh',
        maxLength: Math.max(50, Math.min(input.maxLength || 500, 2000)),
      };
    },
  },
  classify_inbox: {
    worker: 'lifeos',
    normalizeInput: (input) => ({ dryRun: input?.dryRun ?? false }),
  },
  extract_tasks: {
    worker: 'lifeos',
    normalizeInput: (input) => {
      if (!input?.noteId) throwWorkerTaskValidationError('extract_tasks requires noteId');
      return { noteId: input.noteId };
    },
  },
  update_persona_snapshot: {
    worker: 'lifeos',
    normalizeInput: (input) => {
      if (!input?.noteId) throwWorkerTaskValidationError('update_persona_snapshot requires noteId');
      return { noteId: input.noteId };
    },
  },
  daily_report: {
    worker: 'lifeos',
    normalizeInput: (input) => ({ date: input?.date || getTodayDateString() }),
  },
  weekly_report: {
    worker: 'lifeos',
    normalizeInput: (input) => ({ weekStart: input?.weekStart || getWeekStartDateString() }),
  },
};

function getWorkerTaskDefinition<T extends WorkerTaskType>(taskType: T): WorkerTaskDefinition<T> {
  const definition = workerTaskDefinitions[taskType];
  if (!definition) {
    throwWorkerTaskValidationError(`Unsupported task type: ${taskType}`);
  }
  return definition;
}

// ── Row / ID helpers ──

function rowToWorkerTask(row: WorkerTaskRow): WorkerTask {
  const outputNotePaths = row.output_note_paths ? JSON.parse(row.output_note_paths) : [];
  return {
    id: row.id,
    taskType: row.task_type,
    input: JSON.parse(row.input_json),
    status: row.status,
    worker: row.worker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    resultSummary: row.result_summary,
    sourceNoteId: row.source_note_id,
    sourceReintegrationId: row.source_reintegration_id,
    scheduleId: row.schedule_id,
    outputNotePaths,
    outputNotes: outputNotePaths.map(buildOutputNote),
  } as WorkerTask;
}

function buildWorkerTaskId(): string {
  return crypto.randomUUID();
}

// ── Soul Action / Reintegration helpers ──

function ensureTaskCanFinalize(taskId: string): WorkerTask | null {
  const latest = getWorkerTask(taskId);
  if (!latest) throw new Error('Worker task disappeared');
  if (latest.status === 'cancelled') return null;
  return latest;
}

function tryBestEffortReintegrateTerminalTask(task: WorkerTask): void {
  try {
    const personaSnapshot = task.sourceNoteId
      ? getPersonaSnapshotBySourceNoteId(task.sourceNoteId)
      : null;
    const personaSnapshotForTask = personaSnapshot?.workerTaskId === task.id
      ? personaSnapshot
      : null;

    const linkedSoulAction = getSoulActionByWorkerTaskId(task.id);
    const reintegrationInput = createReintegrationRecordInput(task, {
      soulActionId: linkedSoulAction?.id ?? null,
      sourceReintegrationId: linkedSoulAction?.sourceReintegrationId ?? null,
      personaSnapshot: personaSnapshotForTask,
    });

    upsertReintegrationRecord(reintegrationInput);
  } catch {
    // Reintegration remains best-effort
  }
}

function bindSoulActionToWorkerTask(task: WorkerTask): void {
  const actionKind = deriveSoulActionKindFromWorkerTask(task);
  if (!actionKind || !task.sourceNoteId) {
    return;
  }

  const soulAction = getSoulActionByIdentityAndKind({
    sourceNoteId: task.sourceNoteId,
    sourceReintegrationId: task.sourceReintegrationId ?? null,
    actionKind,
  })
    ?? createOrReuseSoulAction({
      sourceNoteId: task.sourceNoteId,
      sourceReintegrationId: task.sourceReintegrationId ?? null,
      actionKind,
      now: task.createdAt,
      governanceStatus: 'approved',
      executionStatus: 'pending',
    });
  attachWorkerTaskToSoulAction(soulAction.id, task.id, task.updatedAt);
}

// ── CRUD ──

export function normalizeTaskInput(request: CreateWorkerTaskRequest): WorkerTaskInputMap[WorkerTaskType] {
  return getWorkerTaskDefinition(request.taskType).normalizeInput(request.input);
}

function resolveWorker(taskType: WorkerTaskType): WorkerName {
  return getWorkerTaskDefinition(taskType).worker;
}

export function createWorkerTask(request: CreateWorkerTaskRequest, scheduleId?: string): WorkerTask {
  const db = getDb();
  const now = new Date().toISOString();
  const normalizedInput = normalizeTaskInput(request);
  const task: WorkerTask = {
    id: buildWorkerTaskId(),
    taskType: request.taskType,
    input: normalizedInput,
    status: 'pending',
    worker: resolveWorker(request.taskType),
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    error: null,
    result: null,
    resultSummary: null,
    sourceNoteId: request.sourceNoteId || null,
    sourceReintegrationId: request.sourceReintegrationId || null,
    scheduleId: scheduleId || null,
    outputNotePaths: [],
    outputNotes: [],
  };

  db.prepare(`
    INSERT INTO worker_tasks (
      id, task_type, input_json, status, worker, created_at, updated_at,
      started_at, finished_at, error, result_json, result_summary, source_note_id, source_reintegration_id, output_note_paths, schedule_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    task.taskType,
    JSON.stringify(task.input),
    task.status,
    task.worker,
    task.createdAt,
    task.updatedAt,
    task.startedAt,
    task.finishedAt,
    task.error,
    task.result ? JSON.stringify(task.result) : null,
    task.resultSummary,
    task.sourceNoteId,
    task.sourceReintegrationId,
    JSON.stringify(task.outputNotePaths),
    task.scheduleId
  );

  bindSoulActionToWorkerTask(task);

  return task;
}

export function getWorkerTask(taskId: string): WorkerTask | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM worker_tasks WHERE id = ?').get(taskId) as WorkerTaskRow | undefined;
  return row ? rowToWorkerTask(row) : null;
}

export function listWorkerTasks(limit = 20, filters?: WorkerTaskListFilters): WorkerTask[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters?.sourceNoteId) {
    clauses.push('source_note_id = ?');
    params.push(filters.sourceNoteId);
  }
  if (filters?.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.taskType) {
    clauses.push('task_type = ?');
    params.push(filters.taskType);
  }
  if (filters?.worker) {
    clauses.push('worker = ?');
    params.push(filters.worker);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM worker_tasks ${whereClause} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as WorkerTaskRow[];

  return rows.map(rowToWorkerTask);
}

function updateTaskStatus(taskId: string, updates: Partial<WorkerTask>) {
  const db = getDb();
  const current = getWorkerTask(taskId);
  if (!current) return null;

  const next: WorkerTask = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  } as WorkerTask;

  db.prepare(`
    UPDATE worker_tasks
    SET status = ?, updated_at = ?, started_at = ?, finished_at = ?, error = ?, result_json = ?, result_summary = ?, output_note_paths = ?
    WHERE id = ?
  `).run(
    next.status,
    next.updatedAt,
    next.startedAt || null,
    next.finishedAt || null,
    next.error || null,
    next.result ? JSON.stringify(next.result) : null,
    next.resultSummary || null,
    JSON.stringify(next.outputNotePaths || []),
    taskId
  );

  const updated = getWorkerTask(taskId);
  if (updated) {
    const syncedSoulAction = syncSoulActionFromWorkerTask(updated);
    if (syncedSoulAction) {
      broadcastUpdate({ type: 'soul-action-updated', data: syncedSoulAction });
    }
    broadcastUpdate({ type: 'worker-task-updated', data: updated });
    if (updated.sourceNoteId) {
      broadcastUpdate({
        type: 'note-worker-tasks-updated',
        data: {
          sourceNoteId: updated.sourceNoteId,
          task: updated,
        },
      });
    }
  }
  return updated;
}

export function cancelWorkerTask(taskId: string): WorkerTask {
  const task = getWorkerTask(taskId);
  if (!task) throw new Error('Worker task not found');
  if (task.status === 'succeeded') throw new Error('Succeeded task cannot be cancelled');
  if (task.status === 'failed') throw new Error('Failed task cannot be cancelled');
  if (task.status === 'cancelled') return task;

  const finishedAt = new Date().toISOString();
  if (task.status === 'pending') {
    const updated = updateTaskStatus(taskId, {
      status: 'cancelled',
      finishedAt,
      error: '任务已取消',
      outputNotePaths: [],
    });
    if (!updated) throw new Error('Worker task disappeared');
    return updated;
  }

  const controller = runningTaskControllers.get(taskId);
  if (!controller) {
    throw new Error('Worker task is not cancellable');
  }
  controller.abort();

  const updated = updateTaskStatus(taskId, {
    status: 'cancelled',
    finishedAt,
    error: '任务已取消',
    outputNotePaths: [],
  });
  if (!updated) throw new Error('Worker task disappeared');
  return updated;
}

export function retryWorkerTask(taskId: string): WorkerTask {
  const task = getWorkerTask(taskId);
  if (!task) throw new Error('Worker task not found');
  if (!['failed', 'cancelled'].includes(task.status)) {
    throw new Error('Only failed or cancelled tasks can be retried');
  }

  const updated = updateTaskStatus(taskId, {
    status: 'pending',
    startedAt: null,
    finishedAt: null,
    error: null,
    result: null,
    resultSummary: null,
    outputNotePaths: [],
  });
  if (!updated) throw new Error('Worker task disappeared');
  startWorkerTaskExecution(taskId);
  return updated;
}

export function clearFinishedWorkerTasks(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM worker_tasks WHERE status IN ('failed', 'cancelled', 'succeeded')").run();
  return result.changes;
}

// ── Execution Framework ──

export function startWorkerTaskExecution(taskId: string): void {
  queueMicrotask(() => {
    executeWorkerTask(taskId).catch((error) => { // Record terminal failure
      logger.error(`Worker task execution failed: ${taskId}`, error);
    });
  });
}

type WorkerTaskExecutionRegistryEntry<T extends WorkerTaskType> = {
  run: (task: WorkerTask<T>, signal: AbortSignal) => Promise<WorkerTaskResultMap[T]>;
  summarize: (result: WorkerTaskResultMap[T]) => string;
  getOutputNotePaths: (task: WorkerTask<T>, result: WorkerTaskResultMap[T]) => Promise<string[]>;
};

type WorkerTaskExecutionRegistry = {
  [T in WorkerTaskType]: WorkerTaskExecutionRegistryEntry<T>;
};

const workerTaskExecutionRegistry: WorkerTaskExecutionRegistry = {
  openclaw_task: {
    run: (task, signal) => runOpenClawTaskExecutor(task, signal),
    summarize: summarizeOpenClawResult,
    getOutputNotePaths: (task, result) => persistOpenClawResult(task, result),
  },
  summarize_note: {
    run: (task) => runSummarizeNoteDirect(task),
    summarize: summarizeSummarizeNoteResult,
    getOutputNotePaths: (task, result) => persistSummarizeNoteResult(task, result),
  },
  classify_inbox: {
    run: (task) => runClassifyInbox(task),
    summarize: summarizeClassifyInboxResult,
    getOutputNotePaths: (task, result) => persistClassifyInboxResult(task, result),
  },
  extract_tasks: {
    run: (task) => runExtractTasks(task),
    summarize: summarizeExtractTasksResult,
    getOutputNotePaths: async (_task, result) => result.items.map((item) => item.filePath),
  },
  update_persona_snapshot: {
    run: (task) => runUpdatePersonaSnapshot(task),
    summarize: summarizeUpdatePersonaSnapshotResult,
    getOutputNotePaths: async () => [],
  },
  daily_report: {
    run: (task) => runDailyReport(task),
    summarize: summarizeDailyReportResult,
    getOutputNotePaths: (task, result) => persistDailyReportResult(task, result),
  },
  weekly_report: {
    run: (task) => runWeeklyReport(task),
    summarize: summarizeWeeklyReportResult,
    getOutputNotePaths: (task, result) => persistWeeklyReportResult(task, result),
  },
};

export async function executeWorkerTask(taskId: string): Promise<WorkerTask> {
  const task = getWorkerTask(taskId);
  if (!task) throw new Error('Worker task not found');
  if (task.status !== 'pending') return task;

  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  runningTaskControllers.set(taskId, controller);
  updateTaskStatus(taskId, { status: 'running', startedAt, finishedAt: null, error: null, result: null });

  try {
    const handler = workerTaskExecutionRegistry[task.taskType];
    if (!handler) {
      throw new Error(`Unsupported worker task type: ${task.taskType}`);
    }

    const result = await handler.run(task as never, controller.signal);

    const finalizableTask = ensureTaskCanFinalize(taskId);
    if (!finalizableTask) {
      const cancelledTask = getWorkerTask(taskId);
      if (!cancelledTask) throw new Error('Worker task disappeared');
      if (cancelledTask.status === 'cancelled') {
        tryBestEffortReintegrateTerminalTask(cancelledTask);
      }
      return cancelledTask;
    }

    const outputNotePaths = await handler.getOutputNotePaths(task as never, result as never);
    updateTaskStatus(taskId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      result: result as WorkerTaskResultMap[WorkerTaskType],
      resultSummary: handler.summarize(result as never),
      outputNotePaths,
      error: null,
    });

    const completedTask = getWorkerTask(taskId);
    if (!completedTask) throw new Error('Worker task disappeared');
    tryBestEffortReintegrateTerminalTask(completedTask);
  } catch (error: any) {
    const latest = getWorkerTask(taskId);
    if (!latest) throw new Error('Worker task disappeared');
    if (latest.status !== 'cancelled') {
      updateTaskStatus(taskId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: error?.message || String(error),
        result: null,
        outputNotePaths: [],
      });

      const failedTask = getWorkerTask(taskId);
      if (!failedTask) throw new Error('Worker task disappeared');
      tryBestEffortReintegrateTerminalTask(failedTask);
    }
  } finally {
    runningTaskControllers.delete(taskId);
  }

  const updated = getWorkerTask(taskId);
  if (!updated) throw new Error('Worker task disappeared');
  return updated;
}
