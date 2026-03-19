import crypto from 'crypto';
import { schedule as cronSchedule, validate as cronValidate, type ScheduledTask } from 'node-cron';
import type {
  TaskSchedule,
  CreateTaskScheduleRequest,
  UpdateTaskScheduleRequest,
  WorkerTaskType,
} from '@lifeos/shared';
import { getDb } from '../db/client.js';
import { createWorkerTask, startWorkerTaskExecution, normalizeTaskInput } from './workerTasks.js';
import { broadcastUpdate } from '../index.js';

interface ScheduleRow {
  id: string;
  task_type: WorkerTaskType;
  input_json: string;
  cron_expression: string;
  label: string;
  enabled: number;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_task_id: string | null;
  consecutive_failures: number;
  last_error: string | null;
}

const cronJobs = new Map<string, ScheduledTask>();

function rowToSchedule(row: ScheduleRow): TaskSchedule {
  return {
    id: row.id,
    taskType: row.task_type,
    input: JSON.parse(row.input_json),
    cronExpression: row.cron_expression,
    label: row.label,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at,
    lastTaskId: row.last_task_id,
    consecutiveFailures: row.consecutive_failures ?? 0,
    lastError: row.last_error,
  };
}

function broadcastScheduleUpdate() {
  broadcastUpdate({ type: 'schedule-updated', data: {} });
}

function registerCronJob(schedule: TaskSchedule): void {
  // Remove existing job if any
  const existing = cronJobs.get(schedule.id);
  if (existing) {
    existing.stop();
    cronJobs.delete(schedule.id);
  }

  if (!schedule.enabled) return;

  const job = cronSchedule(schedule.cronExpression, () => {
    executeTick(schedule.id);
  });

  cronJobs.set(schedule.id, job);
}

function executeTick(scheduleId: string): void {
  const db = getDb();
  const row = db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(scheduleId) as ScheduleRow | undefined;
  if (!row || row.enabled !== 1) return;

  // Dedup: skip if last_run_at is within 30s
  if (row.last_run_at) {
    const elapsed = Date.now() - new Date(row.last_run_at).getTime();
    if (elapsed < 30_000) return;
  }

  const schedule = rowToSchedule(row);

  try {
    const normalizedInput = normalizeTaskInput({
      taskType: schedule.taskType,
      input: schedule.input,
    });

    const task = createWorkerTask(
      { taskType: schedule.taskType, input: normalizedInput },
      schedule.id,
    );

    const now = new Date().toISOString();
    db.prepare('UPDATE task_schedules SET last_run_at = ?, last_task_id = ?, updated_at = ?, consecutive_failures = 0, last_error = NULL WHERE id = ?')
      .run(now, task.id, now, scheduleId);

    startWorkerTaskExecution(task.id);
    broadcastScheduleUpdate();

    console.log(`TaskScheduler: executed schedule "${schedule.label}" → task ${task.id}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const now = new Date().toISOString();
    const newFailures = (row.consecutive_failures ?? 0) + 1;
    db.prepare('UPDATE task_schedules SET consecutive_failures = ?, last_error = ?, updated_at = ? WHERE id = ?')
      .run(newFailures, errorMsg, now, scheduleId);
    broadcastScheduleUpdate();
    console.error(`TaskScheduler: failed to execute schedule "${schedule.label}" (failures: ${newFailures})`, err);
  }
}

export function runScheduleNow(id: string): TaskSchedule {
  const db = getDb();
  const row = db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(id) as ScheduleRow | undefined;
  if (!row) throw new Error('Schedule not found');

  const schedule = rowToSchedule(row);

  const normalizedInput = normalizeTaskInput({
    taskType: schedule.taskType,
    input: schedule.input,
  });

  const task = createWorkerTask(
    { taskType: schedule.taskType, input: normalizedInput },
    schedule.id,
  );

  const now = new Date().toISOString();
  db.prepare('UPDATE task_schedules SET last_run_at = ?, last_task_id = ?, updated_at = ? WHERE id = ?')
    .run(now, task.id, now, id);

  startWorkerTaskExecution(task.id);
  broadcastScheduleUpdate();

  console.log(`TaskScheduler: manual run schedule "${schedule.label}" → task ${task.id}`);
  return getSchedule(id)!;
}

export function createSchedule(req: CreateTaskScheduleRequest): TaskSchedule {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const normalizedInput = normalizeTaskInput({
    taskType: req.taskType,
    input: req.input,
  });

  db.prepare(`
    INSERT INTO task_schedules (id, task_type, input_json, cron_expression, label, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, req.taskType, JSON.stringify(normalizedInput), req.cronExpression, req.label, now, now);

  const schedule = getSchedule(id)!;
  registerCronJob(schedule);
  broadcastScheduleUpdate();
  console.log(`TaskScheduler: created schedule "${schedule.label}" (${schedule.cronExpression})`);
  return schedule;
}

export function listSchedules(): TaskSchedule[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM task_schedules ORDER BY created_at DESC').all() as ScheduleRow[];
  return rows.map(rowToSchedule);
}

export function getSchedule(id: string): TaskSchedule | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(id) as ScheduleRow | undefined;
  return row ? rowToSchedule(row) : null;
}

export function updateSchedule(id: string, updates: UpdateTaskScheduleRequest): TaskSchedule {
  const db = getDb();
  const existing = getSchedule(id);
  if (!existing) throw new Error('Schedule not found');

  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: Array<string | number> = [now];

  if (updates.enabled !== undefined) {
    sets.push('enabled = ?');
    params.push(updates.enabled ? 1 : 0);
  }
  if (updates.cronExpression !== undefined) {
    sets.push('cron_expression = ?');
    params.push(updates.cronExpression);
  }
  if (updates.label !== undefined) {
    sets.push('label = ?');
    params.push(updates.label);
  }
  if (updates.input !== undefined) {
    const normalizedInput = normalizeTaskInput({
      taskType: existing.taskType,
      input: updates.input,
    });
    sets.push('input_json = ?');
    params.push(JSON.stringify(normalizedInput));
  }

  params.push(id);
  db.prepare(`UPDATE task_schedules SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const updated = getSchedule(id)!;
  registerCronJob(updated);
  broadcastScheduleUpdate();
  return updated;
}

export function deleteSchedule(id: string): void {
  const existing = cronJobs.get(id);
  if (existing) {
    existing.stop();
    cronJobs.delete(id);
  }

  const db = getDb();
  db.prepare('DELETE FROM task_schedules WHERE id = ?').run(id);
  broadcastScheduleUpdate();
  console.log(`TaskScheduler: deleted schedule ${id}`);
}

export function initScheduler(): void {
  const schedules = listSchedules().filter(s => s.enabled);
  for (const schedule of schedules) {
    registerCronJob(schedule);
  }
  console.log(`TaskScheduler: loaded ${schedules.length} active schedule(s)`);
}

export interface ScheduleHealthData {
  total: number;
  active: number;
  failing: number;
  failingSchedules: Array<{ id: string; label: string; consecutiveFailures: number; lastError: string | null }>;
}

export function getScheduleHealth(): ScheduleHealthData {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM task_schedules').all() as ScheduleRow[];
  const total = rows.length;
  const active = rows.filter(r => r.enabled === 1).length;
  const failingRows = rows.filter(r => r.enabled === 1 && (r.consecutive_failures ?? 0) >= 1);
  return {
    total,
    active,
    failing: failingRows.length,
    failingSchedules: failingRows.map(r => ({
      id: r.id,
      label: r.label,
      consecutiveFailures: r.consecutive_failures ?? 0,
      lastError: r.last_error,
    })),
  };
}

export function stopScheduler(): void {
  for (const [id, job] of cronJobs) {
    job.stop();
  }
  cronJobs.clear();
  console.log('TaskScheduler: stopped all schedules');
}
