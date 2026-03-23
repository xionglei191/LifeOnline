/**
 * Note Handlers — CRUD operations for notes
 */
import { Request, Response } from 'express';
import matter from 'gray-matter';
import { getDb } from '../../db/client.js';
import { broadcastUpdate, getIndexQueue } from '../../index.js';
import { loadConfig } from '../../config/configManager.js';
import { buildNoteFilePath, createFile, deleteFile, rewriteMarkdownContent, updateFrontmatter } from '../../vault/fileManager.js';
import { getTodayDateString } from '../../utils/date.js';
import type { ApiResponse, Note, CreateNoteRequest, CreateNoteResponse, UpdateNoteRequest, UpdateNoteResponse, SearchResult } from '@lifeos/shared';

export function parseNote(row: any): Note {
  const note: any = {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : undefined
  };
  if (row.privacy === 'sensitive' && row.content && row.content.includes(':')) {
    note.encrypted = true;
  }
  return note;
}

export async function getNotes(req: Request, res: Response): Promise<void> {
  try {
    const db = getDb();
    const { dimension, status, type } = req.query;
    let query = 'SELECT * FROM notes WHERE 1=1';
    const params: any[] = [];
    if (dimension) { query += ' AND dimension = ?'; params.push(dimension); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY date DESC, created DESC';
    const notes = db.prepare(query).all(...params);
    res.json(notes.map(parseNote));
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

export async function getNoteById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
    res.json(parseNote(note));
  } catch (error) {
    console.error('Get note by id error:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
}

export async function searchNotes(req: Request<Record<string, never>, ApiResponse<SearchResult>, Record<string, never>, { q?: string }>, res: Response<ApiResponse<SearchResult>>): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) { res.status(400).json({ error: 'query parameter required' }); return; }
    const db = getDb();
    const keyword = `%${query}%`;
    const notes = db.prepare(`
      SELECT * FROM notes
      WHERE file_name LIKE ? OR title LIKE ? OR content LIKE ? OR dimension LIKE ? OR tags LIKE ?
      ORDER BY date DESC LIMIT 50
    `).all(keyword, keyword, keyword, keyword, keyword).map(parseNote);
    const result: SearchResult = { notes, total: notes.length, query, filters: { q: query } };
    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}

export async function createNote(req: Request<Record<string, never>, ApiResponse<CreateNoteResponse>, CreateNoteRequest>, res: Response<ApiResponse<CreateNoteResponse>>): Promise<void> {
  try {
    const { title, dimension, type, content, priority, tags } = req.body;
    if (!title || !dimension) { res.status(400).json({ error: 'title and dimension are required' }); return; }
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
    res.json({ success: true, filePath });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function updateNote(req: Request<{ id: string }, ApiResponse<UpdateNoteResponse>, UpdateNoteRequest>, res: Response<ApiResponse<UpdateNoteResponse>>): Promise<void> {
  try {
    const { id } = req.params;
    const { status, priority, tags, approval_status } = req.body;
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags;
    if (approval_status !== undefined) updates.approval_status = approval_status;
    await updateFrontmatter(note.file_path, updates);
    broadcastUpdate({ type: 'note-updated', data: { noteId: id } });
    getIndexQueue()?.enqueue(note.file_path, 'upsert');
    res.json({ success: true });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function appendNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'text is required' }); return; }
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
    const timestamp = new Date().toLocaleString('zh-CN');
    await rewriteMarkdownContent(note.file_path, (content) => (
      `${content.trimEnd()}\n\n---\n\n**备注** (${timestamp})\n\n${text}\n`
    ));
    broadcastUpdate({ type: 'note-updated', data: { noteId: id } });
    getIndexQueue()?.enqueue(note.file_path, 'upsert');
    res.json({ success: true });
  } catch (error) {
    console.error('Append note error:', error);
    res.status(500).json({ error: String(error) });
  }
}

export async function deleteNote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
    await deleteFile(note.file_path);
    broadcastUpdate({ type: 'note-deleted', data: { noteId: id, filePath: note.file_path } });
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') { res.status(404).json({ error: 'Note file not found' }); return; }
    console.error('Delete note error:', error);
    res.status(500).json({ error: String(error) });
  }
}
