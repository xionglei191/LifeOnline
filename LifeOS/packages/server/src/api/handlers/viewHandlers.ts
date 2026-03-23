/**
 * View Handlers — dashboard, timeline, calendar, persona snapshot
 */
import { Request, Response } from 'express';
import { getDb } from '../../db/client.js';
import { getMonthDateRange, getMonthDateStrings, getTodayDateString, getWeekEndDateString, getWeekStartDateString } from '../../utils/date.js';
import { getPersonaSnapshotBySourceNoteId } from '../../soul/personaSnapshots.js';
import { parseNote } from './noteHandlers.js';
import type { ApiResponse, DashboardData, Note, DimensionStat, Dimension, TimelineData, TimelineTrack, CalendarData, CalendarDay, PersonaSnapshotResponse } from '@lifeos/shared';

export async function getDashboard(_req: Request<Record<string, never>, ApiResponse<DashboardData>>, res: Response<ApiResponse<DashboardData>>): Promise<void> {
  try {
    const db = getDb();
    const today = getTodayDateString();
    const startOfWeek = getWeekStartDateString();
    const endOfWeek = getWeekEndDateString(startOfWeek);

    const todayTodos = db.prepare(`
      SELECT * FROM notes
      WHERE type IN ('task', 'schedule') AND date = ? AND status != 'done'
      ORDER BY CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC, created ASC
    `).all(today);

    const weeklyHighlights = db.prepare(`
      SELECT * FROM notes
      WHERE type IN ('task', 'schedule') AND date BETWEEN ? AND ? AND priority = 'high' AND status != 'done'
      ORDER BY date ASC, created ASC
    `).all(startOfWeek, endOfWeek);

    const dimensions: Dimension[] = ['_inbox', 'health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth'];
    const dimensionStats: DimensionStat[] = [];
    const statsStmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM notes WHERE dimension = ?
    `);
    for (const dimension of dimensions) {
      const stats = statsStmt.get(dimension) as any || { total: 0, pending: 0, in_progress: 0, done: 0 };
      const healthScore = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      dimensionStats.push({ dimension, total: stats.total, pending: stats.pending, in_progress: stats.in_progress, done: stats.done, health_score: healthScore });
    }

    const inboxStats = db.prepare(`SELECT COUNT(*) as total FROM notes WHERE dimension = '_inbox' AND status != 'done'`).get() as any;
    const response: DashboardData = {
      todayTodos: todayTodos.map(parseNote),
      weeklyHighlights: weeklyHighlights.map(parseNote),
      dimensionStats,
      inboxCount: inboxStats?.total ?? 0
    };
    res.json(response);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

export async function getTimeline(
  req: Request<Record<string, never>, ApiResponse<TimelineData>, Record<string, never>, { start?: string; end?: string }>,
  res: Response<ApiResponse<TimelineData>>,
): Promise<void> {
  try {
    const { start, end } = req.query;
    if (!start || !end) { res.status(400).json({ error: 'start and end date required' }); return; }
    const db = getDb();
    const notes = db.prepare(`SELECT * FROM notes WHERE date BETWEEN ? AND ? ORDER BY date ASC`).all(start, end).map(parseNote);
    const dimensions: Dimension[] = ['health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth'];
    const tracks: TimelineTrack[] = dimensions.map(dimension => ({ dimension, notes: notes.filter(note => note.dimension === dimension) }));
    const response: TimelineData = { startDate: start, endDate: end, tracks };
    res.json(response);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
}

export async function getCalendar(
  req: Request<Record<string, never>, ApiResponse<CalendarData>, Record<string, never>, { year?: string; month?: string }>,
  res: Response<ApiResponse<CalendarData>>,
): Promise<void> {
  try {
    const { year, month } = req.query;
    if (!year || !month) { res.status(400).json({ error: 'year and month required' }); return; }
    const y = parseInt(year as string);
    const m = parseInt(month as string);
    const { start, end } = getMonthDateRange(y, m);
    const db = getDb();
    const notes = db.prepare(`SELECT * FROM notes WHERE date BETWEEN ? AND ? ORDER BY date ASC`).all(start, end).map(parseNote);
    const dayMap = new Map<string, Note[]>();
    notes.forEach(note => {
      const noteDate = note.date.split('T')[0];
      if (!dayMap.has(noteDate)) dayMap.set(noteDate, []);
      dayMap.get(noteDate)!.push(note);
    });
    const days: CalendarDay[] = getMonthDateStrings(y, m).map((date) => {
      const dayNotes = dayMap.get(date) || [];
      return { date, notes: dayNotes, count: dayNotes.length };
    });
    const response: CalendarData = { year: y, month: m, days };
    res.json(response);
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
}

export async function getPersonaSnapshotHandler(
  req: Request<{ sourceNoteId: string }, ApiResponse<PersonaSnapshotResponse>>,
  res: Response<ApiResponse<PersonaSnapshotResponse>>,
): Promise<void> {
  try {
    const { sourceNoteId } = req.params;
    const snapshot = getPersonaSnapshotBySourceNoteId(sourceNoteId);
    res.json({ snapshot });
  } catch (error) {
    console.error('Get persona snapshot error:', error);
    res.status(500).json({ error: 'Failed to fetch persona snapshot' });
  }
}
