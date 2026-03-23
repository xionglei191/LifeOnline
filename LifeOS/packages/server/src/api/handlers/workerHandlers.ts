/**
 * Worker Task & Schedule Handlers + Stats
 */
import { Request, Response } from 'express';
import { validate as cronValidate } from 'node-cron';
import { getDb } from '../../db/client.js';
import { broadcastUpdate } from '../../index.js';
import { createWorkerTask, getWorkerTask, listWorkerTasks, startWorkerTaskExecution, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks, isSupportedWorkerTaskType, WorkerTaskValidationError } from '../../workers/workerTasks.js';
import { createSchedule, listSchedules, getSchedule, updateSchedule, deleteSchedule, runScheduleNow, getScheduleHealth } from '../../workers/taskScheduler.js';
import { isSupportedWorkerName } from '@lifeos/shared';
import type { ApiResponse, CreateWorkerTaskRequest, CreateWorkerTaskResponse, WorkerTaskListFilters, WorkerTaskListResponse, WorkerTaskResponse, ClearFinishedWorkerTasksResponse, WorkerName, WorkerTaskStatus, WorkerTaskType, CreateTaskScheduleRequest, UpdateTaskScheduleRequest, ScheduleHealth, StatsTrendPoint, StatsRadarPoint, StatsMonthlyPoint, StatsTagPoint, TaskScheduleResponse, TaskScheduleListResponse, DeleteTaskScheduleResponse } from '@lifeos/shared';

function parseWorkerTaskStatus(value: unknown): WorkerTaskStatus | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return ['pending', 'running', 'succeeded', 'failed', 'cancelled'].includes(normalized)
    ? (normalized as WorkerTaskStatus) : undefined;
}

function parseWorkerTaskType(value: unknown): WorkerTaskType | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return isSupportedWorkerTaskType(normalized) ? normalized : undefined;
}

function parseWorkerName(value: unknown): WorkerName | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return isSupportedWorkerName(normalized) ? normalized : undefined;
}

function isTaskInputValidationError(error: unknown): boolean {
  return error instanceof WorkerTaskValidationError;
}

// ── Worker Task Handlers ───────────────────────────────

export async function createWorkerTaskHandler(
  req: Request<Record<string, never>, ApiResponse<CreateWorkerTaskResponse>, CreateWorkerTaskRequest>,
  res: Response<ApiResponse<CreateWorkerTaskResponse>>,
): Promise<void> {
  try {
    const body = req.body;
    if (!body?.taskType) { res.status(400).json({ error: 'taskType is required' }); return; }
    if (!isSupportedWorkerTaskType(body.taskType)) { res.status(400).json({ error: 'Unsupported taskType' }); return; }
    const task = createWorkerTask({ ...body, taskType: body.taskType });
    broadcastUpdate({ type: 'worker-task-updated', data: task });
    if (task.sourceNoteId) {
      broadcastUpdate({ type: 'note-worker-tasks-updated', data: { sourceNoteId: task.sourceNoteId, task } });
    }
    startWorkerTaskExecution(task.id);
    const response: CreateWorkerTaskResponse = { task };
    res.status(202).json(response);
  } catch (error) {
    if (isTaskInputValidationError(error)) { res.status(400).json({ error: error instanceof Error ? error.message : String(error) }); return; }
    console.error('Create worker task error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function listWorkerTasksHandler(
  req: Request<Record<string, never>, ApiResponse<WorkerTaskListResponse>, Record<string, never>, WorkerTaskListFilters & { limit?: string }>,
  res: Response<ApiResponse<WorkerTaskListResponse>>,
): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const sourceNoteId = typeof req.query.sourceNoteId === 'string' && req.query.sourceNoteId.trim()
      ? req.query.sourceNoteId.trim() : undefined;
    const filters: WorkerTaskListFilters = {
      sourceNoteId,
      status: parseWorkerTaskStatus(req.query.status),
      taskType: parseWorkerTaskType(req.query.taskType),
      worker: parseWorkerName(req.query.worker),
    };
    const response: WorkerTaskListResponse = { tasks: listWorkerTasks(limit, filters), filters };
    res.json(response);
  } catch (error) {
    console.error('List worker tasks error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function getWorkerTaskHandler(req: Request<{ id: string }, ApiResponse<WorkerTaskResponse>>, res: Response<ApiResponse<WorkerTaskResponse>>): Promise<void> {
  try {
    const task = getWorkerTask(req.params.id);
    if (!task) { res.status(404).json({ error: 'Worker task not found' }); return; }
    const response: WorkerTaskResponse = { task };
    res.json(response);
  } catch (error) {
    console.error('Get worker task error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function retryWorkerTaskHandler(req: Request<{ id: string }, ApiResponse<WorkerTaskResponse>>, res: Response<ApiResponse<WorkerTaskResponse>>): Promise<void> {
  try {
    const task = retryWorkerTask(req.params.id);
    const response: WorkerTaskResponse = { task };
    res.status(202).json(response);
  } catch (error: any) {
    const message = error?.message || String(error);
    if (message === 'Worker task not found') { res.status(404).json({ error: message }); return; }
    res.status(400).json({ error: message });
  }
}

export async function cancelWorkerTaskHandler(req: Request<{ id: string }, ApiResponse<WorkerTaskResponse>>, res: Response<ApiResponse<WorkerTaskResponse>>): Promise<void> {
  try {
    const task = cancelWorkerTask(req.params.id);
    const response: WorkerTaskResponse = { task };
    res.json(response);
  } catch (error: any) {
    const message = error?.message || String(error);
    if (message === 'Worker task not found') { res.status(404).json({ error: message }); return; }
    res.status(400).json({ error: message });
  }
}

export async function clearFinishedWorkerTasksHandler(
  _req: Request<Record<string, never>, ApiResponse<ClearFinishedWorkerTasksResponse>>,
  res: Response<ApiResponse<ClearFinishedWorkerTasksResponse>>,
): Promise<void> {
  try {
    const deleted = clearFinishedWorkerTasks();
    const response: ClearFinishedWorkerTasksResponse = { success: true, deleted };
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// ── Schedule Handlers ──────────────────────────────────

export async function createScheduleHandler(req: Request<Record<string, never>, ApiResponse<TaskScheduleResponse>, CreateTaskScheduleRequest>, res: Response<ApiResponse<TaskScheduleResponse>>): Promise<void> {
  try {
    const body = req.body;
    if (!body?.taskType || !isSupportedWorkerTaskType(body.taskType)) { res.status(400).json({ error: 'Invalid or missing taskType' }); return; }
    if (!body.cronExpression || !cronValidate(body.cronExpression)) { res.status(400).json({ error: 'Invalid cron expression' }); return; }
    if (!body.label?.trim()) { res.status(400).json({ error: 'label is required' }); return; }
    const schedule = createSchedule({ ...body, taskType: body.taskType });
    const response: TaskScheduleResponse = { schedule };
    res.status(201).json(response);
  } catch (error) {
    if (isTaskInputValidationError(error)) { res.status(400).json({ error: error instanceof Error ? error.message : String(error) }); return; }
    console.error('Create schedule error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function listSchedulesHandler(_req: Request<Record<string, never>, ApiResponse<TaskScheduleListResponse>>, res: Response<ApiResponse<TaskScheduleListResponse>>): Promise<void> {
  try {
    const response: TaskScheduleListResponse = { schedules: listSchedules() };
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export async function getScheduleHandler(req: Request<{ id: string }, ApiResponse<TaskScheduleResponse>>, res: Response<ApiResponse<TaskScheduleResponse>>): Promise<void> {
  try {
    const schedule = getSchedule(req.params.id);
    if (!schedule) { res.status(404).json({ error: 'Schedule not found' }); return; }
    const response: TaskScheduleResponse = { schedule };
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export async function updateScheduleHandler(req: Request<{ id: string }, ApiResponse<TaskScheduleResponse>, UpdateTaskScheduleRequest>, res: Response<ApiResponse<TaskScheduleResponse>>): Promise<void> {
  try {
    const body = req.body;
    if (body.cronExpression !== undefined && !cronValidate(body.cronExpression)) { res.status(400).json({ error: 'Invalid cron expression' }); return; }
    if (body.label !== undefined && !body.label.trim()) { res.status(400).json({ error: 'label cannot be empty' }); return; }
    const schedule = updateSchedule(req.params.id, body);
    const response: TaskScheduleResponse = { schedule };
    res.json(response);
  } catch (error: any) {
    if (error?.message === 'Schedule not found') { res.status(404).json({ error: error.message }); return; }
    if (isTaskInputValidationError(error)) { res.status(400).json({ error: error instanceof Error ? error.message : String(error) }); return; }
    res.status(500).json({ error: String(error) });
  }
}

export async function deleteScheduleHandler(req: Request<{ id: string }, ApiResponse<DeleteTaskScheduleResponse>>, res: Response<ApiResponse<DeleteTaskScheduleResponse>>): Promise<void> {
  try {
    deleteSchedule(req.params.id);
    const response: DeleteTaskScheduleResponse = { success: true };
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export async function runScheduleNowHandler(req: Request<{ id: string }, ApiResponse<TaskScheduleResponse>>, res: Response<ApiResponse<TaskScheduleResponse>>): Promise<void> {
  try {
    const schedule = runScheduleNow(req.params.id);
    const response: TaskScheduleResponse = { schedule };
    res.json(response);
  } catch (error: any) {
    if (error?.message === 'Schedule not found') { res.status(404).json({ error: error.message }); return; }
    res.status(500).json({ error: String(error) });
  }
}

export async function scheduleHealthHandler(_req: Request<Record<string, never>, ApiResponse<ScheduleHealth>>, res: Response<ApiResponse<ScheduleHealth>>): Promise<void> {
  try {
    const health = getScheduleHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// ── Stats Handlers ─────────────────────────────────────

export async function getStatsTrend(req: Request<Record<string, never>, ApiResponse<StatsTrendPoint[]>, Record<string, never>, { days?: string }>, res: Response<ApiResponse<StatsTrendPoint[]>>): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const db = getDb();
    const rows = db.prepare(`
      SELECT date(date) as day, COUNT(*) as total,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
      FROM notes WHERE date >= date('now', '-' || ? || ' days')
      GROUP BY day ORDER BY day ASC
    `).all(days) as StatsTrendPoint[];
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export async function getStatsRadar(_req: Request<Record<string, never>, ApiResponse<StatsRadarPoint[]>>, res: Response<ApiResponse<StatsRadarPoint[]>>): Promise<void> {
  try {
    const db = getDb();
    const dimensions = ['health','career','finance','learning','relationship','life','hobby','growth'];
    const stmt = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM notes WHERE dimension = ?`);
    const data: StatsRadarPoint[] = dimensions.map(dim => {
      const row = stmt.get(dim) as { total: number; done: number };
      const rate = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
      return { dimension: dim, rate, total: row.total, done: row.done };
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export async function getStatsMonthly(_req: Request<Record<string, never>, ApiResponse<StatsMonthlyPoint[]>>, res: Response<ApiResponse<StatsMonthlyPoint[]>>): Promise<void> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT strftime('%Y-%m', date) as month, COUNT(*) as total,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
      FROM notes WHERE date >= date('now', '-6 months')
      GROUP BY month ORDER BY month ASC
    `).all() as StatsMonthlyPoint[];
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

export async function getStatsTags(_req: Request<Record<string, never>, ApiResponse<StatsTagPoint[]>>, res: Response<ApiResponse<StatsTagPoint[]>>): Promise<void> {
  try {
    const db = getDb();
    const notes = db.prepare('SELECT tags FROM notes WHERE tags IS NOT NULL').all() as any[];
    const tagCount: Record<string, number> = {};
    notes.forEach(n => {
      try { const tags = JSON.parse(n.tags) as string[]; tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }); } catch {}
    });
    const sorted: StatsTagPoint[] = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}
