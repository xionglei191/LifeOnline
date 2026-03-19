import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import type { Frontmatter } from '@lifeos/shared';
import crypto from 'crypto';

export interface ParseResult {
  success: boolean;
  data?: {
    id: string;
    frontmatter: Frontmatter & Record<string, any>;
    content: string;
  };
  error?: string;
}

const VALID_VALUES = {
  type: ['schedule', 'task', 'note', 'record', 'milestone', 'review'],
  dimension: ['health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth', '_inbox'],
  status: ['pending', 'in_progress', 'done', 'cancelled'],
  priority: ['high', 'medium', 'low'],
  privacy: ['public', 'private', 'sensitive'],
  source: ['lingguang', 'desktop', 'webclipper', 'openclaw', 'web', 'auto']
};

// Reverse map: directory name → dimension
const DIR_TO_DIMENSION: Record<string, string> = {
  '健康': 'health', '事业': 'career', '财务': 'finance', '学习': 'learning',
  '关系': 'relationship', '生活': 'life', '兴趣': 'hobby', '成长': 'growth',
  '_Inbox': '_inbox', '_Daily': 'growth', '_Weekly': 'growth',
};

function inferDimension(filePath: string): string {
  const parentDir = path.basename(path.dirname(filePath));
  return DIR_TO_DIMENSION[parentDir] || '_inbox';
}

function inferSource(filePath: string): string {
  const fileName = path.basename(filePath);
  if (fileName.startsWith('lingguang_')) return 'lingguang';
  if (fileName.startsWith('openclaw_')) return 'openclaw';
  return 'desktop';
}

export async function parseMarkdownFile(filePath: string): Promise<ParseResult> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const stat = await fs.stat(filePath);
    const now = new Date().toISOString();
    const fileDate = stat.mtime.toISOString().split('T')[0];

    // Auto-fill missing fields with sensible defaults
    if (!data.type || !VALID_VALUES.type.includes(data.type)) data.type = 'note';
    if (!data.dimension || !VALID_VALUES.dimension.includes(data.dimension)) data.dimension = inferDimension(filePath);
    if (!data.status || !VALID_VALUES.status.includes(data.status)) data.status = 'pending';
    if (!data.priority || !VALID_VALUES.priority.includes(data.priority)) data.priority = 'medium';
    if (!data.privacy || !VALID_VALUES.privacy.includes(data.privacy)) data.privacy = 'private';
    if (!data.source || !VALID_VALUES.source.includes(data.source)) data.source = inferSource(filePath);
    if (!data.date) data.date = fileDate;
    if (!data.created) data.created = now;

    const id = crypto.createHash('md5').update(filePath).digest('hex');

    return {
      success: true,
      data: {
        id,
        frontmatter: data as Frontmatter,
        content: content.trim()
      }
    };
  } catch (error) {
    return { success: false, error: `Parse error: ${error}` };
  }
}
