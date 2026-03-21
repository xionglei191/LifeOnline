import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getDimensionDirectoryName } from '../utils/dimensions.js';

export async function moveFile(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}

export async function createFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

export async function updateFrontmatter(
  filePath: string,
  updates: Record<string, unknown>
): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(raw);
  const newData = { ...parsed.data, ...updates, updated: new Date().toISOString() };
  const newContent = matter.stringify(parsed.content, newData);
  await fs.writeFile(filePath, newContent, 'utf-8');
}

export async function rewriteMarkdownContent(
  filePath: string,
  transform: (content: string) => string,
): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(raw);
  const nextContent = transform(parsed.content);
  const nextData = { ...parsed.data, updated: new Date().toISOString() };
  const nextRaw = matter.stringify(nextContent, nextData);
  await fs.writeFile(filePath, nextRaw, 'utf-8');
}

export const MAX_NOTE_FILE_STEM_LENGTH = 60;

export function sanitizeNoteFileStem(title: string): string {
  return title.replace(/[\/\\:*?"<>|]/g, '-').slice(0, MAX_NOTE_FILE_STEM_LENGTH);
}

export function buildNoteFilePath(vaultPath: string, dimension: string, title: string, date: string): string {
  const dir = getDimensionDirectoryName(dimension) || '成长';
  const safeName = sanitizeNoteFileStem(title);
  return path.join(vaultPath, dir, `${date}-${safeName}.md`);
}

export function buildTaskFilePath(vaultPath: string, dimension: string, title: string, date: string): string {
  return buildNoteFilePath(vaultPath, dimension, title, date);
}

export function buildTargetPath(vaultPath: string, dimension: string, title: string, date: string): string {
  return buildNoteFilePath(vaultPath, dimension, title, date);
}
