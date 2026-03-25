/**
 * Note Handlers — CRUD operations for notes
 */
import { Request, Response } from 'express';
import matter from 'gray-matter';
import { getDb } from '../../db/client.js';
import { broadcastUpdate, getIndexQueue } from '../../index.js';
import { loadConfig } from '../../config/configManager.js';
import { getEffectiveAiProviderConfig } from '../../ai/providerConfigService.js';
import { buildNoteFilePath, createFile, deleteFile, rewriteMarkdownContent, updateFrontmatter } from '../../vault/fileManager.js';
import { getTodayDateString } from '../../utils/date.js';
import { Logger } from '../../utils/logger.js';
import { sendSuccess, sendError } from '../responseHelper.js';
import type { ApiResponse, Note, CreateNoteRequest, CreateNoteResponse, UpdateNoteRequest, UpdateNoteResponse, SearchResult } from '@lifeos/shared';

const logger = new Logger('noteHandlers');

export function parseNote(row: Record<string, unknown>): Note {
  const note: Record<string, unknown> = {
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined
  };
  if (row.privacy === 'sensitive' && row.content && (row.content as string).includes(':')) {
    note.encrypted = true;
  }
  return note as unknown as Note;
}

export async function getNotes(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const { dimension, status, type } = req.query;
    let query = 'SELECT * FROM notes WHERE 1=1';
    const params: string[] = [];
    if (dimension) { query += ' AND dimension = ?'; params.push(dimension as string); }
    if (status) { query += ' AND status = ?'; params.push(status as string); }
    if (type) { query += ' AND type = ?'; params.push(type as string); }
    query += ' ORDER BY date DESC, created DESC';
    const notes = db.prepare(query).all(...params);
    sendSuccess(res as Response<ApiResponse<Note[]>>, notes.map(n => parseNote(n as Record<string, unknown>)));
  } catch (error) {
    logger.error('Get notes error:', error);
    sendError(res as Response<ApiResponse<Note[]>>, 'Failed to fetch notes');
  }
}

export async function getNoteById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) { sendError(res as Response<ApiResponse<Note>>, 'Note not found', 404); return; }
    sendSuccess(res as Response<ApiResponse<Note>>, parseNote(note as Record<string, unknown>));
  } catch (error) {
    logger.error('Get note by id error:', error);
    sendError(res as Response<ApiResponse<Note>>, 'Failed to fetch note');
  }
}

export async function searchNotes(req: Request<Record<string, never>, ApiResponse<SearchResult>, Record<string, never>, { q?: string }>, res: Response<ApiResponse<SearchResult>>): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) { sendError(res, 'query parameter required', 400); return; }
    const db = getDb();
    const keyword = `%${query}%`;
    const notes = db.prepare(`
      SELECT * FROM notes
      WHERE file_name LIKE ? OR title LIKE ? OR content LIKE ? OR dimension LIKE ? OR tags LIKE ?
      ORDER BY date DESC LIMIT 50
    `).all(keyword, keyword, keyword, keyword, keyword).map(n => parseNote(n as Record<string, unknown>));
    const result: SearchResult = { notes, total: notes.length, query, filters: { q: query } };
    sendSuccess(res, result);
  } catch (error) {
    logger.error('Search error:', error);
    sendError(res, 'Search failed');
  }
}

export async function createNote(req: Request<Record<string, never>, ApiResponse<CreateNoteResponse>, CreateNoteRequest>, res: Response<ApiResponse<CreateNoteResponse>>): Promise<void> {
  try {
    const { title, dimension, type, content, priority, tags } = req.body;
    if (!title || !dimension) { sendError(res, 'title and dimension are required', 400); return; }
    const config = await loadConfig();
    const date = getTodayDateString();
    const filePath = buildNoteFilePath(config.vaultPath, dimension, title, date);
    const now = new Date().toISOString();
    const frontmatter: Record<string, unknown> = {
      type: type || 'note', dimension, status: 'pending', priority: priority || 'medium',
      privacy: 'private', date, source: 'web', created: now, updated: now,
    };
    if (tags?.length) frontmatter.tags = tags;
    const fileContent = matter.stringify(`\n# ${title}\n\n${content || ''}`, frontmatter);
    await createFile(filePath, fileContent);
    broadcastUpdate({ type: 'note-created', data: { filePath } });
    getIndexQueue()?.enqueue(filePath, 'upsert');
    sendSuccess(res, { success: true, filePath } as CreateNoteResponse);
  } catch (error) {
    logger.error('Create note error:', error);
    sendError(res, String(error));
  }
}

export async function updateNote(req: Request<{ id: string }, ApiResponse<UpdateNoteResponse>, UpdateNoteRequest>, res: Response<ApiResponse<UpdateNoteResponse>>): Promise<void> {
  try {
    const { id } = req.params;
    const { status, priority, tags, approval_status } = req.body;
    const db = getDb();
    const note = db.prepare('SELECT file_path FROM notes WHERE id = ?').get(id) as { file_path: string } | undefined;
    if (!note) { sendError(res, 'Note not found', 404); return; }
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags;
    if (approval_status !== undefined) updates.approval_status = approval_status;
    await updateFrontmatter(note.file_path, updates);
    broadcastUpdate({ type: 'note-updated', data: { noteId: id } });
    getIndexQueue()?.enqueue(note.file_path, 'upsert');
    sendSuccess(res, { success: true } as UpdateNoteResponse);
  } catch (error) {
    logger.error('Update note error:', error);
    sendError(res, String(error));
  }
}

export async function appendNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) { sendError(res as Response<ApiResponse<{ success: boolean }>>, 'text is required', 400); return; }
    const db = getDb();
    const note = db.prepare('SELECT file_path FROM notes WHERE id = ?').get(id) as { file_path: string } | undefined;
    if (!note) { sendError(res as Response<ApiResponse<{ success: boolean }>>, 'Note not found', 404); return; }
    const timestamp = new Date().toLocaleString('zh-CN');
    await rewriteMarkdownContent(note.file_path, (content) => (
      `${content.trimEnd()}\n\n---\n\n**备注** (${timestamp})\n\n${text}\n`
    ));
    broadcastUpdate({ type: 'note-updated', data: { noteId: id } });
    getIndexQueue()?.enqueue(note.file_path, 'upsert');
    sendSuccess(res as Response<ApiResponse<{ success: boolean }>>, { success: true });
  } catch (error) {
    logger.error('Append note error:', error);
    sendError(res as Response<ApiResponse<{ success: boolean }>>, String(error));
  }
}

export async function deleteNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = getDb();
    const note = db.prepare('SELECT file_path FROM notes WHERE id = ?').get(id) as { file_path: string } | undefined;
    if (!note) { sendError(res as Response<ApiResponse<{ success: boolean }>>, 'Note not found', 404); return; }
    await deleteFile(note.file_path);
    broadcastUpdate({ type: 'note-deleted', data: { noteId: id, filePath: note.file_path } });
    sendSuccess(res as Response<ApiResponse<{ success: boolean }>>, { success: true });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      sendError(res as Response<ApiResponse<{ success: boolean }>>, 'Note file not found', 404); return;
    }
    logger.error('Delete note error:', error);
    sendError(res as Response<ApiResponse<{ success: boolean }>>, String(error));
  }
}
