import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

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

export function buildTaskFilePath(vaultPath: string, dimension: string, title: string, date: string): string {
  const dimensionMap: Record<string, string> = {
    health: '健康', career: '事业', finance: '财务', learning: '学习',
    relationship: '关系', life: '生活', hobby: '兴趣', growth: '成长',
  };
  const dir = dimensionMap[dimension] || '成长';
  const safeName = title.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 30);
  return path.join(vaultPath, dir, `${date}-${safeName}.md`);
}

export function buildTargetPath(vaultPath: string, dimension: string, title: string, date: string): string {
  return buildTaskFilePath(vaultPath, dimension, title, date);
}
