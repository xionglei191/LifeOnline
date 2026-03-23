/**
 * Classify-inbox executor — scans _Inbox, classifies notes via AI, and moves them to correct dimensions.
 */
import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import type { WorkerTask, WorkerTaskResultMap } from '@lifeos/shared';
import { loadConfig } from '../../config/configManager.js';
import { classifyNote } from '../../ai/classifier.js';
import { extractTasks } from '../../ai/taskExtractor.js';
import { readFileContent, moveFile, buildTargetPath, buildTaskFilePath, createFile } from '../../vault/fileManager.js';
import { buildClassifiedFrontmatter, buildTaskFrontmatter } from '../../vault/frontmatterBuilder.js';
import { getIndexQueue } from '../../index.js';
import { getDb } from '../../db/client.js';
import { getTodayDateString } from '../../utils/date.js';
import { persistWorkerGeneratedMarkdownNote } from './shared.js';

export async function runClassifyInbox(
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

export async function persistClassifyInboxResult(
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

export function summarizeClassifyInboxResult(result: WorkerTaskResultMap['classify_inbox']): string {
  return result.summary;
}
