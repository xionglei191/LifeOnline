/**
 * OpenClaw task executor — runs external OpenClaw tasks and persists results to Vault.
 */
import path from 'path';
import fs from 'fs/promises';
import type { WorkerTask, WorkerTaskInputMap, WorkerTaskResultMap } from '@lifeos/shared';
import { loadConfig } from '../../config/configManager.js';
import { runOpenClawTask } from '../../integrations/openclawClient.js';
import { getTodayDateString } from '../../utils/date.js';
import { getDimensionDirectoryName } from '../../utils/dimensions.js';
import { sanitizeFileName, persistWorkerGeneratedMarkdownNote } from './shared.js';

function buildOpenClawMarkdown(result: WorkerTaskResultMap['openclaw_task']): string {
  const lines = [`# ${result.title}`, '', result.summary, ''];
  if (result.content) {
    lines.push(result.content, '');
  }
  return `${lines.join('\n').trim()}\n`;
}

export async function persistOpenClawResult(
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

  let contentAdditions = '';
  if (result.attachedFiles && Array.isArray(result.attachedFiles)) {
    const assetsDir = path.join(config.vaultPath, 'assets');
    await fs.mkdir(assetsDir, { recursive: true });
    
    for (const absolutePath of result.attachedFiles) {
      try {
        const baseName = path.basename(absolutePath);
        const targetPath = path.join(assetsDir, baseName);
        await fs.copyFile(absolutePath, targetPath);
        contentAdditions += `\n![[${baseName}]]\n`;
      } catch (err) {
        contentAdditions += `\n(附件文件提取失败: ${absolutePath})\n`;
      }
    }
  }

  if (contentAdditions) {
    result = { ...result, content: (result.content || '') + contentAdditions };
  }

  const frontmatterInput = {
    title: result.title,
    dimension: dimensionKey || 'learning',
    type: 'note',
    date,
    tags: ['openclaw'],
    taskId: task.id,
    sourceNoteId: task.sourceNoteId,
  };

  return persistWorkerGeneratedMarkdownNote(filePath, buildOpenClawMarkdown(result), frontmatterInput);
}

export function summarizeOpenClawResult(result: WorkerTaskResultMap['openclaw_task']): string {
  return `OpenClaw 任务完成：${result.title}`;
}

export async function runOpenClawTaskExecutor(
  task: WorkerTask<'openclaw_task'>,
  signal: AbortSignal
): Promise<WorkerTaskResultMap['openclaw_task'] | 'ASYNC_YIELD'> {
  return runOpenClawTask(task.id, task.input, { signal });
}
