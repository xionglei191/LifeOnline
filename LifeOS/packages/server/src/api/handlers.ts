import { Request, Response } from 'express';
import matter from 'gray-matter';
import { validate as cronValidate } from 'node-cron';
import { getDb } from '../db/client.js';
import { indexVault, indexFile } from '../indexer/indexer.js';
import { loadConfig, saveConfig, validateVaultPath } from '../config/configManager.js';
import { broadcastUpdate, getIndexQueue } from '../index.js';
import { buildNoteFilePath, createFile, deleteFile, rewriteMarkdownContent, updateFrontmatter } from '../vault/fileManager.js';
import { createWorkerTask, getWorkerTask, listWorkerTasks, startWorkerTaskExecution, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks, isSupportedWorkerTaskType, WorkerTaskValidationError } from '../workers/workerTasks.js';
import { createSchedule, listSchedules, getSchedule, updateSchedule, deleteSchedule, runScheduleNow, getScheduleHealth } from '../workers/taskScheduler.js';
import { isValidPromptKey, listPromptRecords, resetPromptOverride, upsertPromptOverride } from '../ai/promptService.js';
import { getAiProviderSettings, testAiProviderConnection, upsertAiProviderSettings, validateAiProviderSettings } from '../ai/providerConfigService.js';
import type { DashboardData, Note, DimensionStat, Dimension, TimelineData, TimelineTrack, CalendarData, CalendarDay, CreateWorkerTaskRequest, WorkerName, WorkerTaskListFilters, WorkerTaskStatus, WorkerTaskType, CreateTaskScheduleRequest, UpdateTaskScheduleRequest, UpdatePromptRequest, UpdateAiProviderSettingsRequest, TestAiProviderConnectionRequest } from '@lifeos/shared';
import { isSupportedWorkerName } from '@lifeos/shared';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const todayTodos = db.prepare(`
      SELECT * FROM notes
      WHERE type IN ('task', 'schedule')
      AND date = ?
      AND status != 'done'
      ORDER BY priority DESC, created ASC
    `).all(today);

    const weeklyHighlights = db.prepare(`
      SELECT * FROM notes
      WHERE date BETWEEN ? AND ?
      AND priority = 'high'
      ORDER BY date ASC, created ASC
    `).all(startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]);

    const dimensions: Dimension[] = ['health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth'];
    const dimensionStats: DimensionStat[] = [];

    const statsStmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM notes WHERE dimension = ?
    `);

    for (const dimension of dimensions) {
      const stats = statsStmt.get(dimension) as any || { total: 0, pending: 0, in_progress: 0, done: 0 };
      const healthScore = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

      dimensionStats.push({
        dimension,
        total: stats.total,
        pending: stats.pending,
        in_progress: stats.in_progress,
        done: stats.done,
        health_score: healthScore
      });
    }

    const inboxStats = db.prepare(`
      SELECT COUNT(*) as total FROM notes WHERE dimension = '_inbox' AND status != 'done'
    `).get() as any;

    const data: DashboardData = {
      todayTodos: todayTodos.map(parseNote),
      weeklyHighlights: weeklyHighlights.map(parseNote),
      dimensionStats,
      inboxCount: inboxStats?.total ?? 0
    };

    res.json(data);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

export async function getNotes(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const { dimension, status, type } = req.query;

    let query = 'SELECT * FROM notes WHERE 1=1';
    const params: any[] = [];

    if (dimension) {
      query += ' AND dimension = ?';
      params.push(dimension);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY date DESC, created DESC';

    const notes = db.prepare(query).all(...params);
    res.json(notes.map(parseNote));
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

export async function triggerIndex(req: Request, res: Response): Promise<void> {
  try {
    const config = await loadConfig();
    const result = await indexVault(config.vaultPath);
    broadcastUpdate({ type: 'index-complete', data: result });
    res.json(result);
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({ error: 'Indexing failed' });
  }
}

// GET /api/index/status
export async function getIndexStatus(req: Request, res: Response): Promise<void> {
  const queue = getIndexQueue();
  res.json(queue ? queue.getStatus() : { queueSize: 0, processing: false, processingFile: null });
}

// GET /api/index/errors
export async function getIndexErrors(req: Request, res: Response): Promise<void> {
  const queue = getIndexQueue();
  res.json(queue ? queue.getErrors() : []);
}

function parseWorkerTaskStatus(value: unknown): WorkerTaskStatus | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return ['pending', 'running', 'succeeded', 'failed', 'cancelled'].includes(normalized)
    ? (normalized as WorkerTaskStatus)
    : undefined;
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

function parseNote(row: any): Note {
  const note: any = {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : undefined
  };

  // Mark encrypted content for frontend
  if (row.privacy === 'sensitive' && row.content && row.content.includes(':')) {
    note.encrypted = true;
  }

  return note;
}

// GET /api/timeline?start=2026-03-01&end=2026-03-31
export async function getTimeline(req: Request, res: Response): Promise<void> {
  try {
    const { start, end } = req.query;
    if (!start || !end) { res.status(400).json({ error: 'start and end date required' }); return; }

    const db = getDb();
    const notes = db.prepare(`
      SELECT * FROM notes WHERE date BETWEEN ? AND ? ORDER BY date ASC
    `).all(start, end).map(parseNote);

    const dimensions: Dimension[] = ['health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth'];
    const tracks: TimelineTrack[] = dimensions.map(dimension => ({
      dimension,
      notes: notes.filter(note => note.dimension === dimension)
    }));

    res.json({ startDate: start, endDate: end, tracks });
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
}

// GET /api/calendar?year=2026&month=3
export async function getCalendar(req: Request, res: Response): Promise<void> {
  try {
    const { year, month } = req.query;
    if (!year || !month) { res.status(400).json({ error: 'year and month required' }); return; }

    const y = parseInt(year as string);
    const m = parseInt(month as string);
    const endDate = new Date(y, m, 0);
    const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const db = getDb();
    const notes = db.prepare(`
      SELECT * FROM notes WHERE date BETWEEN ? AND ? ORDER BY date ASC
    `).all(start, end).map(parseNote);

    const dayMap = new Map<string, Note[]>();
    notes.forEach(note => {
      const noteDate = note.date.split('T')[0];
      if (!dayMap.has(noteDate)) dayMap.set(noteDate, []);
      dayMap.get(noteDate)!.push(note);
    });

    const days: CalendarDay[] = [];
    for (let d = 1; d <= endDate.getDate(); d++) {
      const date = new Date(y, m - 1, d).toISOString().split('T')[0];
      const dayNotes = dayMap.get(date) || [];
      days.push({ date, notes: dayNotes, count: dayNotes.length });
    }

    res.json({ year: y, month: m, days });
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
}

// GET /api/notes/:id
export async function getNoteById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
    res.json(parseNote(note));
  } catch (error) {
    console.error('Get note by id error:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
}

// GET /api/search?q=keyword
export async function searchNotes(req: Request, res: Response): Promise<void> {
  try {
    const { q } = req.query;
    if (!q) { res.status(400).json({ error: 'query parameter required' }); return; }

    const db = getDb();
    const keyword = `%${q}%`;
    const notes = db.prepare(`
      SELECT * FROM notes
      WHERE file_name LIKE ? OR content LIKE ?
      ORDER BY date DESC LIMIT 50
    `).all(keyword, keyword).map(parseNote);

    res.json({ notes, total: notes.length, query: q });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}

// GET /api/config
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
}

// POST /api/config
export async function updateConfig(req: Request, res: Response): Promise<void> {
  try {
    const { vaultPath } = req.body;
    if (!vaultPath) {
      res.status(400).json({ error: 'vaultPath is required' });
      return;
    }

    const isValid = await validateVaultPath(vaultPath);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid vault path: directory does not exist or contains no .md files' });
      return;
    }

    const config = await loadConfig();
    config.vaultPath = vaultPath;
    await saveConfig(config);

    // Re-index with new vault path
    const result = await indexVault(vaultPath);
    broadcastUpdate({ type: 'index-complete', data: result });

    res.json({ success: true, indexResult: result });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
}

export async function listAiPrompts(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ prompts: listPromptRecords() });
  } catch (error) {
    console.error('List AI prompts error:', error);
    res.status(500).json({ error: 'Failed to list AI prompts' });
  }
}

export async function updateAiPrompt(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    if (!isValidPromptKey(key)) {
      res.status(400).json({ error: 'Invalid prompt key' });
      return;
    }

    const body = req.body as UpdatePromptRequest;
    if (typeof body?.content !== 'string') {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const record = upsertPromptOverride(key, body.content, body.enabled ?? true, body.notes ?? null);
    res.json({ prompt: record });
  } catch (error: any) {
    const message = error?.message || 'Failed to update AI prompt';
    if (message.includes('Prompt content') || message.includes('placeholder')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('Update AI prompt error:', error);
    res.status(500).json({ error: message });
  }
}

export async function resetAiPrompt(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    if (!isValidPromptKey(key)) {
      res.status(400).json({ error: 'Invalid prompt key' });
      return;
    }

    resetPromptOverride(key);
    res.json({ success: true });
  } catch (error) {
    console.error('Reset AI prompt error:', error);
    res.status(500).json({ error: 'Failed to reset AI prompt' });
  }
}

export async function getAiProviderHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json(getAiProviderSettings());
  } catch (error) {
    console.error('Get AI provider settings error:', error);
    res.status(500).json({ error: 'Failed to fetch AI provider settings' });
  }
}

export async function updateAiProviderHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateAiProviderSettingsRequest;
    validateAiProviderSettings(body || {});
    res.json(upsertAiProviderSettings(body || {}));
  } catch (error: any) {
    const message = error?.message || 'Failed to update AI provider settings';
    if (message.includes('baseUrl') || message.includes('model') || message.includes('enabled') || message.includes('apiKey') || message.includes('clearApiKey')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('Update AI provider settings error:', error);
    res.status(500).json({ error: message });
  }
}

export async function testAiProviderHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body || {}) as TestAiProviderConnectionRequest;
    validateAiProviderSettings(body);
    res.json(await testAiProviderConnection(body));
  } catch (error: any) {
    const message = error?.message || 'Failed to test AI provider connection';
    if (message.includes('baseUrl') || message.includes('model') || message.includes('enabled') || message.includes('apiKey') || message.includes('clearApiKey')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('Test AI provider connection error:', error);
    res.status(500).json({ error: message });
  }
}

// POST /api/worker-tasks
export async function createWorkerTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateWorkerTaskRequest;
    if (!body?.taskType) {
      res.status(400).json({ error: 'taskType is required' });
      return;
    }

    if (!isSupportedWorkerTaskType(body.taskType)) {
      res.status(400).json({ error: 'Unsupported taskType' });
      return;
    }

    const task = createWorkerTask({
      ...body,
      taskType: body.taskType,
    });
    broadcastUpdate({ type: 'worker-task-updated', data: task });
    startWorkerTaskExecution(task.id);

    res.status(202).json({ task });
  } catch (error) {
    if (isTaskInputValidationError(error)) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    console.error('Create worker task error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/worker-tasks
export async function listWorkerTasksHandler(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const sourceNoteId = typeof req.query.sourceNoteId === 'string' && req.query.sourceNoteId.trim()
      ? req.query.sourceNoteId.trim()
      : undefined;

    const filters: WorkerTaskListFilters = {
      sourceNoteId,
      status: parseWorkerTaskStatus(req.query.status),
      taskType: parseWorkerTaskType(req.query.taskType),
      worker: parseWorkerName(req.query.worker),
    };

    res.json({
      tasks: listWorkerTasks(limit, filters),
      filters,
    });
  } catch (error) {
    console.error('List worker tasks error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/worker-tasks/:id
export async function getWorkerTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const task = getWorkerTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Worker task not found' });
      return;
    }
    res.json({ task });
  } catch (error) {
    console.error('Get worker task error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// POST /api/worker-tasks/:id/retry
export async function retryWorkerTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const task = retryWorkerTask(req.params.id);
    res.status(202).json({ task });
  } catch (error: any) {
    const message = error?.message || String(error);
    if (message === 'Worker task not found') {
      res.status(404).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
}

// POST /api/worker-tasks/:id/cancel
export async function cancelWorkerTaskHandler(req: Request, res: Response): Promise<void> {
  try {
    const task = cancelWorkerTask(req.params.id);
    res.json({ task });
  } catch (error: any) {
    const message = error?.message || String(error);
    if (message === 'Worker task not found') {
      res.status(404).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
}

// DELETE /api/worker-tasks/finished
export async function clearFinishedWorkerTasksHandler(_req: Request, res: Response): Promise<void> {
  try {
    const deleted = clearFinishedWorkerTasks();
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// PATCH /api/notes/:id — update status/priority/tags in frontmatter
// 规则：应用内主动写 Vault 文件后，必须显式 enqueue 索引；watcher 只负责外部改动捕获与兜底同步。
export async function updateNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, priority, tags, approval_status } = req.body;

    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags;
    if (approval_status !== undefined) updates.approval_status = approval_status;

    await updateFrontmatter(note.file_path, updates);

    getIndexQueue()?.enqueue(note.file_path, 'upsert');
    res.json({ success: true });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// POST /api/notes/:id/append — append text to note content
export async function appendNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'text is required' }); return; }

    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }

    const timestamp = new Date().toLocaleString('zh-CN');
    await rewriteMarkdownContent(note.file_path, (content) => (
      `${content.trimEnd()}\n\n---\n\n**备注** (${timestamp})\n\n${text}\n`
    ));

    getIndexQueue()?.enqueue(note.file_path, 'upsert');
    res.json({ success: true });
  } catch (error) {
    console.error('Append note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// DELETE /api/notes/:id — delete note markdown file and let watcher/indexer clean DB
export async function deleteNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }

    await deleteFile(note.file_path);
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      res.status(404).json({ error: 'Note file not found' });
      return;
    }
    console.error('Delete note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// POST /api/notes — create new note in vault
export async function createNote(req: Request, res: Response): Promise<void> {
  try {
    const { title, dimension, type, content, priority, tags } = req.body;
    if (!title || !dimension) { res.status(400).json({ error: 'title and dimension are required' }); return; }

    const config = await loadConfig();
    const date = new Date().toISOString().split('T')[0];
    const filePath = buildNoteFilePath(config.vaultPath, dimension, title, date);

    const now = new Date().toISOString();
    const frontmatter: Record<string, unknown> = {
      type: type || 'note',
      dimension,
      status: 'pending',
      priority: priority || 'medium',
      privacy: 'private',
      date,
      source: 'desktop',
      created: now,
      updated: now,
    };
    if (tags?.length) frontmatter.tags = tags;

    const fileContent = matter.stringify(`\n# ${title}\n\n${content || ''}`, frontmatter);
    await createFile(filePath, fileContent);

    getIndexQueue()?.enqueue(filePath, 'upsert');
    res.json({ success: true, filePath });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/stats/trend?days=30
export async function getStatsTrend(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const db = getDb();
    const rows = db.prepare(`
      SELECT date(date) as day, COUNT(*) as total,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
      FROM notes
      WHERE date >= date('now', '-' || ? || ' days')
      GROUP BY day ORDER BY day ASC
    `).all(days) as any[];
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/stats/radar
export async function getStatsRadar(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const dimensions = ['health','career','finance','learning','relationship','life','hobby','growth'];
    const stmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
      FROM notes WHERE dimension = ?
    `);
    const data = dimensions.map(dim => {
      const row = stmt.get(dim) as any;
      const rate = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
      return { dimension: dim, rate, total: row.total, done: row.done };
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/stats/monthly
export async function getStatsMonthly(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT strftime('%Y-%m', date) as month,
        COUNT(*) as total,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
      FROM notes
      WHERE date >= date('now', '-6 months')
      GROUP BY month ORDER BY month ASC
    `).all() as any[];
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/stats/tags
export async function getStatsTags(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const notes = db.prepare('SELECT tags FROM notes WHERE tags IS NOT NULL').all() as any[];
    const tagCount: Record<string, number> = {};
    notes.forEach(n => {
      try {
        const tags = JSON.parse(n.tags) as string[];
        tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
      } catch {}
    });
    const sorted = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// POST /api/schedules
export async function createScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateTaskScheduleRequest;
    if (!body?.taskType || !isSupportedWorkerTaskType(body.taskType)) {
      res.status(400).json({ error: 'Invalid or missing taskType' });
      return;
    }
    if (!body.cronExpression || !cronValidate(body.cronExpression)) {
      res.status(400).json({ error: 'Invalid cron expression' });
      return;
    }
    if (!body.label?.trim()) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const schedule = createSchedule({
      ...body,
      taskType: body.taskType,
    });
    res.status(201).json({ schedule });
  } catch (error) {
    if (isTaskInputValidationError(error)) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    console.error('Create schedule error:', error);
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/schedules
export async function listSchedulesHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ schedules: listSchedules() });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/schedules/:id
export async function getScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const schedule = getSchedule(req.params.id);
    if (!schedule) { res.status(404).json({ error: 'Schedule not found' }); return; }
    res.json({ schedule });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// PATCH /api/schedules/:id
export async function updateScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateTaskScheduleRequest;
    if (body.cronExpression !== undefined && !cronValidate(body.cronExpression)) {
      res.status(400).json({ error: 'Invalid cron expression' });
      return;
    }
    if (body.label !== undefined && !body.label.trim()) {
      res.status(400).json({ error: 'label cannot be empty' });
      return;
    }
    const schedule = updateSchedule(req.params.id, body);
    res.json({ schedule });
  } catch (error: any) {
    if (error?.message === 'Schedule not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    if (isTaskInputValidationError(error)) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    res.status(500).json({ error: String(error) });
  }
}

// DELETE /api/schedules/:id
export async function deleteScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    deleteSchedule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}

// POST /api/schedules/:id/run
export async function runScheduleNowHandler(req: Request, res: Response): Promise<void> {
  try {
    const schedule = runScheduleNow(req.params.id);
    res.json({ schedule });
  } catch (error: any) {
    if (error?.message === 'Schedule not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: String(error) });
  }
}

// GET /api/schedules/health
export async function scheduleHealthHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json(getScheduleHealth());
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}
