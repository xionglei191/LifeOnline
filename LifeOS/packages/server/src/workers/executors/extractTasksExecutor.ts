/**
 * Extract-tasks executor — uses AI to extract actionable tasks from a note and creates task files in Vault.
 */
import type { WorkerTask, WorkerTaskInputMap, WorkerTaskResultMap } from '@lifeos/shared';
import { loadConfig } from '../../config/configManager.js';
import { extractTasks } from '../../ai/taskExtractor.js';
import { createFile, buildTaskFilePath } from '../../vault/fileManager.js';
import { buildTaskFrontmatter } from '../../vault/frontmatterBuilder.js';
import { getIndexQueue } from '../../index.js';
import { getTodayDateString } from '../../utils/date.js';
import { getRequiredWorkerNote, getWorkerNoteTitle } from './shared.js';

export async function runExtractTasks(
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

export function summarizeExtractTasksResult(result: WorkerTaskResultMap['extract_tasks']): string {
  return result.summary;
}
