/**
 * Shared helpers used by multiple worker task executors.
 * Extracted from workerTasks.ts to avoid circular dependencies.
 */
import path from 'path';
import matter from 'gray-matter';
import type { WorkerTaskOutputNote } from '@lifeos/shared';
import { buildNoteId } from '../../indexer/parser.js';
import { createFile, sanitizeNoteFileStem } from '../../vault/fileManager.js';
import { buildWorkerResultFrontmatter } from '../../vault/frontmatterBuilder.js';
import { getIndexQueue } from '../../index.js';
import { getDb } from '../../db/client.js';

export function buildOutputNote(filePath: string): WorkerTaskOutputNote {
  return {
    id: buildNoteId(filePath),
    title: path.basename(filePath, path.extname(filePath)),
    filePath,
    fileName: path.basename(filePath),
  };
}

export function sanitizeFileName(title: string): string {
  return sanitizeNoteFileStem(title);
}

export async function persistGeneratedNote(filePath: string, markdown: string): Promise<string[]> {
  await createFile(filePath, markdown);
  getIndexQueue()?.enqueue(filePath, 'upsert');
  return [filePath];
}

export async function persistWorkerGeneratedMarkdownNote(
  filePath: string,
  markdownContent: string,
  frontmatterInput: Parameters<typeof buildWorkerResultFrontmatter>[0],
): Promise<string[]> {
  const markdown = matter.stringify(markdownContent, buildWorkerResultFrontmatter(frontmatterInput));
  return persistGeneratedNote(filePath, markdown);
}

export function getRequiredWorkerNote(noteId: string): any {
  const db = getDb();
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as any;
  if (!note) throw new Error(`笔记不存在: ${noteId}`);
  return note;
}

export function getWorkerNoteTitle(note: any): string {
  return note.title || note.file_name || '未命名笔记';
}
