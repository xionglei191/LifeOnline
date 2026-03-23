/**
 * Summarize-note executor — uses Claude to generate note summaries and persists to Vault.
 */
import path from 'path';
import type { WorkerTask, WorkerTaskInputMap, WorkerTaskResultMap } from '@lifeos/shared';
import { loadConfig } from '../../config/configManager.js';
import { callClaude } from '../../ai/aiClient.js';
import { getEffectivePrompt } from '../../ai/promptService.js';
import { getTodayDateString } from '../../utils/date.js';
import { sanitizeFileName, persistWorkerGeneratedMarkdownNote, getRequiredWorkerNote, getWorkerNoteTitle } from './shared.js';

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

export async function persistSummarizeNoteResult(
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

export function summarizeSummarizeNoteResult(result: WorkerTaskResultMap['summarize_note']): string {
  return `已生成摘要：${result.title}`;
}

export async function runSummarizeNoteDirect(
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
