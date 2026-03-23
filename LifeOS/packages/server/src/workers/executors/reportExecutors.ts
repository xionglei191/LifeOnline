/**
 * Report executors — daily and weekly report generation via Claude, persisted to Vault.
 */
import path from 'path';
import type { WorkerTask, WorkerTaskInputMap, WorkerTaskResultMap } from '@lifeos/shared';
import { loadConfig } from '../../config/configManager.js';
import { callClaude } from '../../ai/aiClient.js';
import { getEffectivePrompt } from '../../ai/promptService.js';
import { getDb } from '../../db/client.js';
import { getTodayDateString, getWeekStartDateString, getWeekEndDateString } from '../../utils/date.js';
import { getDimensionDisplayLabel, REPORT_DIMENSION_KEYS } from '../../utils/dimensions.js';
import { persistWorkerGeneratedMarkdownNote } from './shared.js';

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

// ── Daily Report ──

export async function runDailyReport(
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

export async function persistDailyReportResult(
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

export function summarizeDailyReportResult(result: WorkerTaskResultMap['daily_report']): string {
  return `${result.date} 日报已生成（${result.stats.totalNotes} 条笔记，${result.stats.doneTasks} 个任务完成）`;
}

// ── Weekly Report ──

export async function runWeeklyReport(
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

export async function persistWeeklyReportResult(
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

export function summarizeWeeklyReportResult(result: WorkerTaskResultMap['weekly_report']): string {
  return `${result.weekStart}~${result.weekEnd} 周报已生成（${result.stats.totalNotes} 条笔记，${result.stats.doneTasks} 个任务完成）`;
}
