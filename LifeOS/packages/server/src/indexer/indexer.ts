import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { scanVault } from './scanner.js';
import { parseMarkdownFile } from './parser.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('indexer');
import { getDb } from '../db/client.js';
import type { IndexResult } from '@lifeos/shared';

// Encryption key for sensitive content (32 bytes for AES-256)
// In production, set LIFEOS_ENCRYPTION_KEY environment variable
const ENCRYPTION_KEY = process.env.LIFEOS_ENCRYPTION_KEY || '0'.repeat(64);
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

// Encrypt content using AES-256-GCM
function encryptContent(content: string): string {
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);

  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Convert any Date objects or non-primitive values to strings safe for SQLite
function toSqlValue(val: any): string | number | null {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return val.toISOString();
  // Handle cross-realm Date objects (e.g. from gray-matter)
  if (typeof val === 'object' && typeof val.toISOString === 'function') return val.toISOString();
  if (typeof val === 'object') return String(val);
  return val;
}

// Extract title from Markdown content
function extractTitle(content: string): string {
  // Try to find first ## heading
  const match = content.match(/^##\s+(.+)$/m);
  if (match) return match[1].trim();

  // Fallback: use first 50 characters
  const text = content.replace(/^#.*$/gm, '').trim();
  return text.slice(0, 50) + (text.length > 50 ? '...' : '');
}

function upsertNote(db: any, id: string, filePath: string, fileName: string, frontmatter: any, content: string, mtime: string) {
  // Extract title BEFORE encryption
  const title = extractTitle(content);

  // Encrypt content if privacy is sensitive
  const finalContent = frontmatter.privacy === 'sensitive' ? encryptContent(content) : content;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO notes (
      id, file_path, file_name, title,
      type, dimension, status, priority, privacy,
      date, due, tags, source, created, updated,
      content, indexed_at, file_modified_at,
      approval_status, approval_operation, approval_action, approval_risk, approval_scope,
      inbox_origin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const params = [
    id, filePath, fileName, title,
    String(frontmatter.type), String(frontmatter.dimension), String(frontmatter.status),
    String(frontmatter.priority || 'medium'), String(frontmatter.privacy),
    toSqlValue(frontmatter.date), toSqlValue(frontmatter.due),
    frontmatter.tags ? JSON.stringify(frontmatter.tags) : null,
    String(frontmatter.source), toSqlValue(frontmatter.created), toSqlValue(frontmatter.updated),
    finalContent, new Date().toISOString(), mtime,
    frontmatter.approval_status || null,
    frontmatter.approval_operation || null,
    frontmatter.approval_action || null,
    frontmatter.approval_risk || null,
    frontmatter.approval_scope || null,
    frontmatter.inbox_origin || null
  ];

  stmt.run(...params);
}

// Single file index (for file watcher add/change events)
export async function indexFile(filePath: string): Promise<void> {
  const db = getDb();
  const parseResult = await parseMarkdownFile(filePath);

  if (!parseResult.success) {
    logger.error(`Index file error: ${filePath}: ${parseResult.error}`);
    return;
  }

  const { id, frontmatter, content } = parseResult.data!;
  const stat = await fs.stat(filePath);
  const fileName = path.basename(filePath, '.md');

  upsertNote(db, id, filePath, fileName, frontmatter, content, stat.mtime.toISOString());
  logger.info(`Indexed file: ${filePath}`);
}

// Delete file record (for file watcher unlink events)
export async function deleteFileRecord(filePath: string): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM notes WHERE file_path = ?').run(filePath);
  logger.info(`Deleted record: ${filePath}`);
}

// Full vault index (existing functionality)
export async function indexVault(vaultPath: string): Promise<IndexResult> {
  const result: IndexResult = { total: 0, indexed: 0, skipped: 0, deleted: 0, errors: [] };

  const db = getDb();
  const files = await scanVault(vaultPath);
  result.total = files.length;

  const existingFiles = new Set<string>();

  for (const file of files) {
    existingFiles.add(file.filePath);

    const row = db.prepare('SELECT file_modified_at FROM notes WHERE file_path = ?').get(file.filePath) as any;
    if (row && new Date(row.file_modified_at).getTime() === file.mtime.getTime()) {
      result.skipped++;
      continue;
    }

    const parseResult = await parseMarkdownFile(file.filePath);
    if (!parseResult.success) {
      result.errors.push(`${file.filePath}: ${parseResult.error}`);
      continue;
    }

    const { id, frontmatter, content } = parseResult.data!;
    upsertNote(db, id, file.filePath, file.fileName, frontmatter, content, file.mtime.toISOString());
    result.indexed++;
  }

  // Remove stale records
  const allNotes = db.prepare('SELECT file_path FROM notes').all() as any[];
  const deleteStmt = db.prepare('DELETE FROM notes WHERE file_path = ?');
  for (const row of allNotes) {
    if (!existingFiles.has(row.file_path)) {
      deleteStmt.run(row.file_path);
      result.deleted++;
    }
  }

  logger.info(`Indexing complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.deleted} deleted, ${result.errors.length} errors`);
  return result;
}
