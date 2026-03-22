import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';

// WorkerTasks 是当前任务执行内核的集中实现：
// - 统一持久化 worker task 记录与状态流转
// - 按 taskType 路由到本地 LifeOS 或外部 OpenClaw 执行
// - 将最终业务结果尽量写回 Vault，再通过索引同步到 SQLite
// 这里是刻意集中而非通用插件框架；后续 taskType 明显增多时再拆分 repository / executor / persistence。
import {
  SUPPORTED_WORKER_TASK_TYPES,
  type CreateWorkerTaskRequest,
  type WorkerTask,
  type WorkerTaskInputMap,
  type WorkerTaskListFilters,
  type WorkerTaskOutputNote,
  type WorkerTaskResultMap,
  type WorkerTaskStatus,
  type WorkerTaskType,
  type WorkerName,
} from '@lifeos/shared';
import { getDb } from '../db/client.js';
import { loadConfig } from '../config/configManager.js';
import { createFile, sanitizeNoteFileStem } from '../vault/fileManager.js';
import { buildWorkerResultFrontmatter, buildClassifiedFrontmatter, buildTaskFrontmatter } from '../vault/frontmatterBuilder.js';
import { getIndexQueue, broadcastUpdate } from '../index.js';
import { runOpenClawTask } from '../integrations/openclawClient.js';
import { classifyNote } from '../ai/classifier.js';
import { extractTasks } from '../ai/taskExtractor.js';
import { callClaude } from '../ai/aiClient.js';
import { getEffectivePrompt } from '../ai/promptService.js';
import { moveFile, readFileContent, buildTargetPath, buildTaskFilePath } from '../vault/fileManager.js';
import { formatLocalDate, getTodayDateString, getWeekEndDateString, getWeekStartDateString } from '../utils/date.js';
import { getDimensionDirectoryName, getDimensionDisplayLabel, REPORT_DIMENSION_KEYS } from '../utils/dimensions.js';
import { createReintegrationRecordInput } from './feedbackReintegration.js';
import {
  attachWorkerTaskToSoulAction,
  createOrReuseSoulAction,
  deriveSoulActionKindFromWorkerTask,
  getSoulActionBySourceNoteIdAndKind,
  getSoulActionByWorkerTaskId,
  syncSoulActionFromWorkerTask,
} from '../soul/soulActions.js';
import { upsertReintegrationRecord } from '../soul/reintegrationRecords.js';
import { getPersonaSnapshotBySourceNoteId, upsertPersonaSnapshot } from '../soul/personaSnapshots.js';

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
  output_note_paths: string | null;
  schedule_id: string | null;
}

const runningTaskControllers = new Map<string, AbortController>();

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

function buildNoteId(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

function buildOutputNote(filePath: string): WorkerTaskOutputNote {
  return {
    id: buildNoteId(filePath),
    title: path.basename(filePath, path.extname(filePath)),
    filePath,
    fileName: path.basename(filePath),
  };
}

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
    scheduleId: row.schedule_id,
    outputNotePaths,
    outputNotes: outputNotePaths.map(buildOutputNote),
  } as WorkerTask;
}

function buildWorkerTaskId(): string {
  return crypto.randomUUID();
}

function sanitizeFileName(title: string): string {
  return sanitizeNoteFileStem(title);
}

function buildOpenClawMarkdown(result: WorkerTaskResultMap['openclaw_task']): string {
  const lines = [`# ${result.title}`, '', result.summary, ''];
  if (result.content) {
    lines.push(result.content, '');
  }
  return `${lines.join('\n').trim()}\n`;
}

async function persistGeneratedNote(filePath: string, markdown: string): Promise<string[]> {
  await createFile(filePath, markdown);
  getIndexQueue()?.enqueue(filePath, 'upsert');
  return [filePath];
}

async function persistWorkerGeneratedMarkdownNote(
  filePath: string,
  markdownContent: string,
  frontmatterInput: Parameters<typeof buildWorkerResultFrontmatter>[0],
): Promise<string[]> {
  const markdown = matter.stringify(markdownContent, buildWorkerResultFrontmatter(frontmatterInput));
  return persistGeneratedNote(filePath, markdown);
}

function getRequiredWorkerNote(noteId: string): any {
  const db = getDb();
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as any;
  if (!note) throw new Error(`笔记不存在: ${noteId}`);
  return note;
}

function getWorkerNoteTitle(note: any): string {
  return note.title || note.file_name || '未命名笔记';
}

function ensureTaskCanFinalize(taskId: string): WorkerTask | null {
  const latest = getWorkerTask(taskId);
  if (!latest) throw new Error('Worker task disappeared');
  if (latest.status === 'cancelled') return null;
  return latest;
}

function tryBestEffortReintegrateTerminalTask(task: WorkerTask): void {
  try {
    const reintegrationInput = createReintegrationRecordInput(task, {
      soulActionId: getSoulActionByWorkerTaskId(task.id)?.id ?? null,
      personaSnapshot: task.sourceNoteId ? getPersonaSnapshotBySourceNoteId(task.sourceNoteId) : null,
    });

    upsertReintegrationRecord(reintegrationInput);
  } catch {
    // Reintegration remains best-effort; PR5 may persist lightweight records but must never break terminal task completion.
  }
}

function bindSoulActionToWorkerTask(task: WorkerTask): void {
  const actionKind = deriveSoulActionKindFromWorkerTask(task);
  if (!actionKind || !task.sourceNoteId) {
    return;
  }

  const soulAction = getSoulActionBySourceNoteIdAndKind(task.sourceNoteId, actionKind)
    ?? createOrReuseSoulAction({
      sourceNoteId: task.sourceNoteId,
      actionKind,
      now: task.createdAt,
      governanceStatus: 'approved',
      executionStatus: 'pending',
    });
  attachWorkerTaskToSoulAction(soulAction.id, task.id, task.updatedAt);
}

async function persistOpenClawResult(
  task: WorkerTask<'openclaw_task'>,
  result: WorkerTaskResultMap['openclaw_task']
): Promise<string[]> {
  const config = await loadConfig();
  const input = task.input as WorkerTaskInputMap['openclaw_task'];
  const dimensionKey = input.outputDimension || 'learning';
  const dirName = getDimensionDirectoryName(dimensionKey) || '学习';
  const date = getTodayDateString();
  const dir = path.join(config.vaultPath, dirName);
  const fileName = `${date}-${sanitizeFileName(result.title)}.md`;
  const filePath = path.join(dir, fileName);
  const frontmatterInput = {
    title: result.title,
    dimension: (dimensionKey as any) || 'learning',
    type: 'note',
    date,
    tags: ['openclaw'],
    taskId: task.id,
    sourceNoteId: task.sourceNoteId,
  };

  return persistWorkerGeneratedMarkdownNote(filePath, buildOpenClawMarkdown(result), frontmatterInput);
}

function buildSummarizeNoteMarkdown(result: WorkerTaskResultMap['summarize_note']): string {
  const lines = [`# ${result.title}`, '', `> 原笔记：${result.sourceNoteTitle}`, '', result.summary, ''];

  if (result.keyPoints.length) {
    lines.push('## 要点', '');
    result.keyPoints.forEach((point) => {
      lines.push(`- ${point}`);
    });
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

async function persistSummarizeNoteResult(
  task: WorkerTask<'summarize_note'>,
  result: WorkerTaskResultMap['summarize_note']
): Promise<string[]> {
  const config = await loadConfig();
  const date = getTodayDateString();
  const dir = path.join(config.vaultPath, '学习');
  const fileName = `${date}-${sanitizeFileName(result.title)}.md`;
  const filePath = path.join(dir, fileName);
  return persistWorkerGeneratedMarkdownNote(filePath, buildSummarizeNoteMarkdown(result), {
    title: result.title,
    dimension: 'learning',
    type: 'note',
    date,
    tags: ['lifeos', 'summary'],
    taskId: task.id,
    sourceNoteId: task.sourceNoteId,
    source: 'auto',
    worker: 'lifeos',
    workerTaskType: 'summarize_note',
  });
}

function summarizeOpenClawResult(result: WorkerTaskResultMap['openclaw_task']): string {
  return `OpenClaw 任务完成：${result.title}`;
}

function summarizeSummarizeNoteResult(result: WorkerTaskResultMap['summarize_note']): string {
  return `已生成摘要：${result.title}`;
}

// ── summarize_note (direct Claude) ──

async function runSummarizeNoteDirect(
  task: WorkerTask<'summarize_note'>
): Promise<WorkerTaskResultMap['summarize_note']> {
  const input = task.input as WorkerTaskInputMap['summarize_note'];
  const note = getRequiredWorkerNote(input.noteId);

  const content = note.content || '';
  const noteTitle = getWorkerNoteTitle(note);

  const prompt = getEffectivePrompt('summarize_note')
    .replace('{title}', noteTitle)
    .replace('{content}', content.slice(0, 4000))
    .replace('{language}', input.language || 'zh')
    .replace(/\{maxLength\}/g, String(input.maxLength || 500));

  const response = await callClaude(prompt, 1024);

  // Parse JSON response
  const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If JSON parse fails, use the raw response as summary
    return {
      title: `${noteTitle} 摘要`,
      summary: response.trim(),
      keyPoints: [],
      sourceNoteTitle: noteTitle,
    };
  }

  return {
    title: parsed.title || `${noteTitle} 摘要`,
    summary: parsed.summary || response.trim(),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    sourceNoteTitle: noteTitle,
  };
}

// ── classify_inbox ──

async function runClassifyInbox(
  task: WorkerTask<'classify_inbox'>
): Promise<WorkerTaskResultMap['classify_inbox']> {
  const config = await loadConfig();
  const inboxPath = path.join(config.vaultPath, '_Inbox');
  const queue = getIndexQueue();

  let entries: string[];
  try {
    const dirEntries = await fs.readdir(inboxPath);
    entries = dirEntries.filter(f => f.endsWith('.md'));
  } catch {
    return { title: 'Inbox 分类报告', summary: '_Inbox 目录为空或不存在', classified: 0, failed: 0, items: [] };
  }

  if (!entries.length) {
    return { title: 'Inbox 分类报告', summary: '_Inbox 中没有待分类文件', classified: 0, failed: 0, items: [] };
  }

  const items: WorkerTaskResultMap['classify_inbox']['items'] = [];
  let classified = 0;
  let failed = 0;
  const date = getTodayDateString();
  const db = getDb();

  for (const fileName of entries) {
    const filePath = path.join(inboxPath, fileName);
    try {
      const raw = await readFileContent(filePath);
      const parsed = matter(raw);
      const content = parsed.content || raw;

      // Check if this file was previously classified (re-synced from mobile after edit)
      const existing = db.prepare(
        "SELECT file_path FROM notes WHERE inbox_origin = ? AND dimension != '_inbox'"
      ).get(fileName) as { file_path: string } | undefined;

      if (!existing) {
        // Fresh file — classify normally
        const classification = await classifyNote(content);
        const newData = buildClassifiedFrontmatter(parsed.data, classification, 'auto');
        newData.inbox_origin = fileName;
        const newFileContent = matter.stringify(parsed.content, newData);

        const targetPath = buildTargetPath(config.vaultPath, classification.dimension, classification.title || fileName.replace('.md', ''), date);
        await fs.writeFile(filePath, newFileContent, 'utf-8');
        if (targetPath !== filePath) {
          await moveFile(filePath, targetPath);
        }
        queue?.enqueue(targetPath, 'upsert');

        // Extract tasks from the note
        try {
          const tasks = await extractTasks(content);
          for (const t of tasks) {
            const taskPath = buildTaskFilePath(config.vaultPath, t.dimension, t.title, date);
            const taskContent = buildTaskFrontmatter(t, date);
            await createFile(taskPath, taskContent);
            queue?.enqueue(taskPath, 'upsert');
          }
        } catch { /* task extraction is best-effort */ }

        items.push({ file: fileName, dimension: classification.dimension, type: classification.type, success: true });
        classified++;
      } else {
        // File was previously classified — update the classified version with new content, then remove from _Inbox
        const classifiedPath = existing.file_path;
        try {
          const classifiedRaw = await readFileContent(classifiedPath);
          const classifiedParsed = matter(classifiedRaw);
          // Keep the classified frontmatter, update content and timestamp
          const mergedData = { ...classifiedParsed.data, updated: new Date().toISOString() };
          const mergedContent = matter.stringify(parsed.content, mergedData);
          await fs.writeFile(classifiedPath, mergedContent, 'utf-8');
          queue?.enqueue(classifiedPath, 'upsert');
        } catch {
          // Classified file gone — re-classify as fresh
          const classification = await classifyNote(content);
          const newData = buildClassifiedFrontmatter(parsed.data, classification, 'auto');
          newData.inbox_origin = fileName;
          const newFileContent = matter.stringify(parsed.content, newData);
          const targetPath = buildTargetPath(config.vaultPath, classification.dimension, classification.title || fileName.replace('.md', ''), date);
          await fs.writeFile(filePath, newFileContent, 'utf-8');
          if (targetPath !== filePath) {
            await moveFile(filePath, targetPath);
          }
          queue?.enqueue(targetPath, 'upsert');
          items.push({ file: fileName, dimension: classification.dimension, type: classification.type, success: true });
          classified++;
          continue;
        }

        // Delete the _Inbox copy
        await fs.unlink(filePath);
        queue?.enqueue(filePath, 'delete');
        items.push({ file: fileName, dimension: 'merged', type: 'update', success: true });
        classified++;
      }
    } catch (err: any) {
      items.push({ file: fileName, dimension: '', type: '', success: false, error: err?.message || String(err) });
      failed++;
    }
  }

  const summary = `已分类 ${classified} 个文件${failed > 0 ? `，${failed} 个失败` : ''}`;
  return { title: `Inbox 分类报告 ${date}`, summary, classified, failed, items };
}

async function persistClassifyInboxResult(
  task: WorkerTask<'classify_inbox'>,
  result: WorkerTaskResultMap['classify_inbox']
): Promise<string[]> {
  const config = await loadConfig();
  const date = getTodayDateString();
  const dir = path.join(config.vaultPath, '_Daily');
  const fileName = `${date}-inbox-分类报告.md`;
  const filePath = path.join(dir, fileName);

  const lines = [`# ${result.title}`, '', result.summary, ''];
  if (result.items.length) {
    lines.push('## 分类详情', '');
    for (const item of result.items) {
      if (item.success) {
        lines.push(`- ✅ ${item.file} → ${item.dimension}/${item.type}`);
      } else {
        lines.push(`- ❌ ${item.file}: ${item.error}`);
      }
    }
    lines.push('');
  }

  return persistWorkerGeneratedMarkdownNote(filePath, `${lines.join('\n').trim()}\n`, {
    title: result.title,
    dimension: 'growth',
    type: 'review',
    date,
    tags: ['lifeos', 'classify_inbox'],
    taskId: task.id,
    source: 'auto',
    worker: 'lifeos',
    workerTaskType: 'classify_inbox',
  });
}

function summarizeClassifyInboxResult(result: WorkerTaskResultMap['classify_inbox']): string {
  return result.summary;
}

// ── extract_tasks ──

async function runExtractTasks(
  task: WorkerTask<'extract_tasks'>
): Promise<WorkerTaskResultMap['extract_tasks']> {
  const input = task.input as WorkerTaskInputMap['extract_tasks'];
  const note = getRequiredWorkerNote(input.noteId);

  const tasks = await extractTasks(note.content || '');
  const sourceNoteTitle = getWorkerNoteTitle(note);
  if (!tasks.length) {
    return {
      title: `${sourceNoteTitle} 行动项提取`,
      summary: '未发现可创建的行动项',
      created: 0,
      sourceNoteTitle,
      items: [],
    };
  }

  const config = await loadConfig();
  const queue = getIndexQueue();
  const date = getTodayDateString();
  const items: WorkerTaskResultMap['extract_tasks']['items'] = [];

  for (const extractedTask of tasks) {
    const filePath = buildTaskFilePath(config.vaultPath, extractedTask.dimension, extractedTask.title, date);
    const fileContent = buildTaskFrontmatter(extractedTask, date);
    await createFile(filePath, fileContent);
    queue?.enqueue(filePath, 'upsert');
    items.push({
      title: extractedTask.title,
      dimension: extractedTask.dimension,
      priority: extractedTask.priority,
      due: extractedTask.due,
      filePath,
    });
  }

  return {
    title: `${sourceNoteTitle} 行动项提取`,
    summary: `已创建 ${items.length} 个行动项`,
    created: items.length,
    sourceNoteTitle,
    items,
  };
}

function summarizeExtractTasksResult(result: WorkerTaskResultMap['extract_tasks']): string {
  return result.summary;
}

function buildPersonaContentPreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 280);
}

async function runUpdatePersonaSnapshot(
  task: WorkerTask<'update_persona_snapshot'>
): Promise<WorkerTaskResultMap['update_persona_snapshot']> {
  const input = task.input as WorkerTaskInputMap['update_persona_snapshot'];
  const note = getRequiredWorkerNote(input.noteId);
  const sourceNoteTitle = getWorkerNoteTitle(note);
  const contentPreview = buildPersonaContentPreview(note.content || '');
  const summary = contentPreview
    ? `已更新人格快照：${sourceNoteTitle}`
    : `已更新人格快照：${sourceNoteTitle}（原笔记内容为空）`;
  const action = task.sourceNoteId
    ? getSoulActionBySourceNoteIdAndKind(task.sourceNoteId, 'update_persona_snapshot')
    : null;

  const snapshot = upsertPersonaSnapshot({
    sourceNoteId: task.sourceNoteId ?? input.noteId,
    soulActionId: action?.id ?? null,
    workerTaskId: task.id,
    summary,
    snapshot: {
      sourceNoteTitle,
      summary,
      contentPreview,
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    title: `${sourceNoteTitle} 人格快照更新`,
    summary,
    sourceNoteTitle,
    snapshotId: snapshot.id,
    snapshot: snapshot.snapshot,
  };
}

function summarizeUpdatePersonaSnapshotResult(result: WorkerTaskResultMap['update_persona_snapshot']): string {
  return result.summary;
}

// ── daily_report ──

function getDimensionStats(db: ReturnType<typeof getDb>, dateFilter: string, dateEnd?: string): string {
  const lines: string[] = [];
  for (const dim of REPORT_DIMENSION_KEYS) {
    const where = dateEnd ? `dimension = ? AND date BETWEEN ? AND ?` : `dimension = ? AND date = ?`;
    const params = dateEnd ? [dim, dateFilter, dateEnd] : [dim, dateFilter];
    const row = db.prepare(`SELECT COUNT(*) as total FROM notes WHERE ${where}`).get(...params) as any;
    if (row?.total > 0) {
      lines.push(`- ${getDimensionDisplayLabel(dim)}: ${row.total} 条`);
    }
  }
  return lines.length ? lines.join('\n') : '- 今日暂无记录';
}

async function runDailyReport(
  task: WorkerTask<'daily_report'>
): Promise<WorkerTaskResultMap['daily_report']> {
  const input = task.input as WorkerTaskInputMap['daily_report'];
  const date = input.date || getTodayDateString();
  const db = getDb();

  const totalRow = db.prepare('SELECT COUNT(*) as total FROM notes WHERE date = ?').get(date) as any;
  const doneRow = db.prepare("SELECT COUNT(*) as total FROM notes WHERE date = ? AND type = 'task' AND status = 'done'").get(date) as any;
  const milestoneRow = db.prepare("SELECT COUNT(*) as total FROM notes WHERE date = ? AND type = 'milestone'").get(date) as any;

  const totalNotes = totalRow?.total || 0;
  const doneTasks = doneRow?.total || 0;
  const milestones = milestoneRow?.total || 0;
  const dimensionStats = getDimensionStats(db, date);

  const prompt = getEffectivePrompt('daily_report')
    .replace('{date}', date)
    .replace('{dimensionStats}', dimensionStats)
    .replace('{doneTasks}', String(doneTasks))
    .replace('{totalNotes}', String(totalNotes))
    .replace('{milestones}', String(milestones));

  const summary = await callClaude(prompt, 512);
  const title = `每日回顾 ${date}`;

  return { title, summary: summary.trim(), date, stats: { totalNotes, doneTasks, milestones } };
}

async function persistDailyReportResult(
  task: WorkerTask<'daily_report'>,
  result: WorkerTaskResultMap['daily_report']
): Promise<string[]> {
  const config = await loadConfig();
  const dir = path.join(config.vaultPath, '_Daily');
  const fileName = `${result.date}-每日回顾.md`;
  const filePath = path.join(dir, fileName);

  const lines = [
    `# ${result.title}`,
    '',
    result.summary,
    '',
    '## 统计',
    '',
    `- 新增笔记: ${result.stats.totalNotes}`,
    `- 完成任务: ${result.stats.doneTasks}`,
    `- 里程碑: ${result.stats.milestones}`,
    '',
  ];

  return persistWorkerGeneratedMarkdownNote(filePath, `${lines.join('\n').trim()}\n`, {
    title: result.title,
    dimension: 'growth',
    type: 'review',
    date: result.date,
    tags: ['lifeos', 'daily_report'],
    taskId: task.id,
    source: 'auto',
    worker: 'lifeos',
    workerTaskType: 'daily_report',
  });
}

function summarizeDailyReportResult(result: WorkerTaskResultMap['daily_report']): string {
  return `${result.date} 日报已生成（${result.stats.totalNotes} 条笔记，${result.stats.doneTasks} 个任务完成）`;
}

// ── weekly_report ──

async function runWeeklyReport(
  task: WorkerTask<'weekly_report'>
): Promise<WorkerTaskResultMap['weekly_report']> {
  const input = task.input as WorkerTaskInputMap['weekly_report'];
  const weekStart = input.weekStart || getWeekStartDateString();
  const weekEnd = getWeekEndDateString(weekStart);

  const db = getDb();
  const totalRow = db.prepare('SELECT COUNT(*) as total FROM notes WHERE date BETWEEN ? AND ?').get(weekStart, weekEnd) as any;
  const doneRow = db.prepare("SELECT COUNT(*) as total FROM notes WHERE date BETWEEN ? AND ? AND type = 'task' AND status = 'done'").get(weekStart, weekEnd) as any;
  const milestoneRow = db.prepare("SELECT COUNT(*) as total FROM notes WHERE date BETWEEN ? AND ? AND type = 'milestone'").get(weekStart, weekEnd) as any;

  const totalNotes = totalRow?.total || 0;
  const doneTasks = doneRow?.total || 0;
  const milestones = milestoneRow?.total || 0;
  const dimensionStats = getDimensionStats(db, weekStart, weekEnd);

  const prompt = getEffectivePrompt('weekly_report')
    .replace('{weekStart}', weekStart)
    .replace('{weekEnd}', weekEnd)
    .replace('{dimensionStats}', dimensionStats)
    .replace('{doneTasks}', String(doneTasks))
    .replace('{totalNotes}', String(totalNotes))
    .replace('{milestones}', String(milestones));

  const summary = await callClaude(prompt, 512);
  const title = `每周回顾 ${weekStart} ~ ${weekEnd}`;

  return { title, summary: summary.trim(), weekStart, weekEnd, stats: { totalNotes, doneTasks, milestones } };
}

async function persistWeeklyReportResult(
  task: WorkerTask<'weekly_report'>,
  result: WorkerTaskResultMap['weekly_report']
): Promise<string[]> {
  const config = await loadConfig();
  const dir = path.join(config.vaultPath, '_Weekly');
  const fileName = `${result.weekStart}-每周回顾.md`;
  const filePath = path.join(dir, fileName);

  const lines = [
    `# ${result.title}`,
    '',
    result.summary,
    '',
    '## 统计',
    '',
    `- 新增笔记: ${result.stats.totalNotes}`,
    `- 完成任务: ${result.stats.doneTasks}`,
    `- 里程碑: ${result.stats.milestones}`,
    '',
  ];

  return persistWorkerGeneratedMarkdownNote(filePath, `${lines.join('\n').trim()}\n`, {
    title: result.title,
    dimension: 'growth',
    type: 'review',
    date: result.weekStart,
    tags: ['lifeos', 'weekly_report'],
    taskId: task.id,
    source: 'auto',
    worker: 'lifeos',
    workerTaskType: 'weekly_report',
  });
}

function summarizeWeeklyReportResult(result: WorkerTaskResultMap['weekly_report']): string {
  return `${result.weekStart}~${result.weekEnd} 周报已生成（${result.stats.totalNotes} 条笔记，${result.stats.doneTasks} 个任务完成）`;
}

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
    scheduleId: scheduleId || null,
    outputNotePaths: [],
  };

  db.prepare(`
    INSERT INTO worker_tasks (
      id, task_type, input_json, status, worker, created_at, updated_at,
      started_at, finished_at, error, result_json, result_summary, source_note_id, output_note_paths, schedule_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    syncSoulActionFromWorkerTask(updated);
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

export function startWorkerTaskExecution(taskId: string): void {
  queueMicrotask(() => {
    executeWorkerTask(taskId).catch((error) => {
      console.error(`Worker task execution failed: ${taskId}`, error);
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
    run: (task, signal) => runOpenClawTask(task.input, { signal }),
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
