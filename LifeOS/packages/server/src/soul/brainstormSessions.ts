/**
 * BrainstormSession CRUD — structured cognitive analysis persistence
 */
import { getDb } from '../db/client.js';
import type { BrainstormSession } from '@lifeos/shared';
import type { NoteAnalysis } from './cognitiveAnalyzer.js';

// ── Row Parsing ────────────────────────────────────────

interface BrainstormSessionRow {
  id: string;
  source_note_id: string;
  raw_input_preview: string;
  themes_json: string;
  emotional_tone: string;
  extracted_questions_json: string;
  ambiguity_points_json: string;
  distilled_insights_json: string;
  suggested_action_kinds_json: string;
  actionability: number;
  continuity_signals_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function parseRow(row: BrainstormSessionRow): BrainstormSession {
  return {
    id: row.id,
    sourceNoteId: row.source_note_id,
    rawInputPreview: row.raw_input_preview,
    themes: JSON.parse(row.themes_json),
    emotionalTone: row.emotional_tone,
    extractedQuestions: JSON.parse(row.extracted_questions_json),
    ambiguityPoints: JSON.parse(row.ambiguity_points_json),
    distilledInsights: JSON.parse(row.distilled_insights_json),
    suggestedActionKinds: JSON.parse(row.suggested_action_kinds_json),
    actionability: row.actionability,
    continuitySignals: JSON.parse(row.continuity_signals_json),
    status: row.status as BrainstormSession['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── CRUD ───────────────────────────────────────────────

export function createOrUpdateBrainstormSession(input: {
  sourceNoteId: string;
  rawContent: string;
  analysis: NoteAnalysis;
}): BrainstormSession {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `brainstorm:${input.sourceNoteId}`;
  const preview = input.rawContent.slice(0, 500);

  // Extract questions from analysis (continuitySignals patterns that are questions)
  const extractedQuestions = input.analysis.continuitySignals
    .filter(s => s.pattern.includes('?') || s.pattern.includes('？'))
    .map(s => s.pattern);

  // Derive ambiguity from low actionability + themes
  const ambiguityPoints: string[] = [];
  if (input.analysis.actionability < 0.3 && input.rawContent.length > 50) {
    ambiguityPoints.push('笔记可行动程度低，可能需要进一步澄清方向');
  }

  const existing = db.prepare('SELECT id FROM brainstorm_sessions WHERE id = ?').get(id);

  if (existing) {
    db.prepare(`
      UPDATE brainstorm_sessions SET
        raw_input_preview = ?, themes_json = ?, emotional_tone = ?,
        extracted_questions_json = ?, ambiguity_points_json = ?,
        distilled_insights_json = ?, suggested_action_kinds_json = ?,
        actionability = ?, continuity_signals_json = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      preview,
      JSON.stringify(input.analysis.themes),
      input.analysis.emotionalTone,
      JSON.stringify(extractedQuestions),
      JSON.stringify(ambiguityPoints),
      JSON.stringify([]),  // distilledInsights — future deep analysis
      JSON.stringify(input.analysis.suggestedActions.map(a => a.kind)),
      input.analysis.actionability,
      JSON.stringify(input.analysis.continuitySignals.map(s => `${s.pattern} (${s.strength})`)),
      'parsed',
      now,
      id,
    );
  } else {
    db.prepare(`
      INSERT INTO brainstorm_sessions (
        id, source_note_id, raw_input_preview, themes_json, emotional_tone,
        extracted_questions_json, ambiguity_points_json, distilled_insights_json,
        suggested_action_kinds_json, actionability, continuity_signals_json,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.sourceNoteId,
      preview,
      JSON.stringify(input.analysis.themes),
      input.analysis.emotionalTone,
      JSON.stringify(extractedQuestions),
      JSON.stringify(ambiguityPoints),
      JSON.stringify([]),
      JSON.stringify(input.analysis.suggestedActions.map(a => a.kind)),
      input.analysis.actionability,
      JSON.stringify(input.analysis.continuitySignals.map(s => `${s.pattern} (${s.strength})`)),
      'parsed',
      now,
      now,
    );
  }

  return getBrainstormSession(id)!;
}

export function getBrainstormSession(id: string): BrainstormSession | null {
  const row = getDb()
    .prepare('SELECT * FROM brainstorm_sessions WHERE id = ?')
    .get(id) as BrainstormSessionRow | undefined;
  return row ? parseRow(row) : null;
}

export function getBrainstormSessionByNoteId(noteId: string): BrainstormSession | null {
  const row = getDb()
    .prepare('SELECT * FROM brainstorm_sessions WHERE source_note_id = ?')
    .get(noteId) as BrainstormSessionRow | undefined;
  return row ? parseRow(row) : null;
}

export function listBrainstormSessions(limit = 50, offset = 0): { sessions: BrainstormSession[]; total: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM brainstorm_sessions').get() as { count: number }).count;
  const rows = db.prepare('SELECT * FROM brainstorm_sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as BrainstormSessionRow[];
  return { sessions: rows.map(parseRow), total };
}

/**
 * Get theme frequency across recent brainstorm sessions.
 * Returns a map of theme → occurrence count within the given number of days.
 */
export function getRecentThemeFrequency(days = 7): Map<string, number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(
    'SELECT themes_json FROM brainstorm_sessions WHERE updated_at >= ? ORDER BY updated_at DESC'
  ).all(cutoff) as Array<{ themes_json: string }>;

  const freq = new Map<string, number>();
  for (const row of rows) {
    try {
      const themes: string[] = JSON.parse(row.themes_json);
      for (const theme of themes) {
        if (theme && theme !== 'general') {
          freq.set(theme, (freq.get(theme) ?? 0) + 1);
        }
      }
    } catch { /* skip malformed */ }
  }
  return freq;
}
