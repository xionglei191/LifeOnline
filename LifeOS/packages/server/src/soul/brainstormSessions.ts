/**
 * BrainstormSession CRUD — structured cognitive analysis persistence
 */
import { getDb } from '../db/client.js';
import type { BrainstormSession } from '@lifeos/shared';
import type { NoteAnalysis } from './cognitiveAnalyzer.js';
import { callClaude, parseJSON } from '../ai/aiClient.js';

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
      JSON.stringify(input.analysis.continuitySignals.map(s => `[${s.type}] ${s.pattern} (${s.strength})${s.evidence ? ` — ${s.evidence}` : ''}`)),
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
      JSON.stringify(input.analysis.continuitySignals.map(s => `[${s.type}] ${s.pattern} (${s.strength})${s.evidence ? ` — ${s.evidence}` : ''}`)),
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

/**
 * Append a single insight string to an existing BrainstormSession's distilledInsights.
 * Called by soulActionDispatcher to feed execution outcomes back into the session.
 * No-ops if no session exists for the given id.
 */
export function appendInsightToSession(sessionId: string, insight: string): void {
  const db = getDb();
  const row = db.prepare('SELECT distilled_insights_json FROM brainstorm_sessions WHERE id = ?').get(sessionId) as { distilled_insights_json: string } | undefined;
  if (!row) return;

  let insights: string[] = [];
  try { insights = JSON.parse(row.distilled_insights_json); } catch { /* keep empty */ }

  insights.push(insight);
  db.prepare(`
    UPDATE brainstorm_sessions
    SET distilled_insights_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(insights), new Date().toISOString(), sessionId);
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

// ── Distill (P1) ───────────────────────────────────────

export function shouldDistill(session: BrainstormSession): boolean {
  if (session.status !== 'parsed') return false;
  if (session.rawInputPreview.length < 100) return false;
  
  return session.actionability >= 0.4 
    || session.continuitySignals.length >= 2 
    || session.themes.length >= 3;
}

export function listDistillCandidates(limit = 10): BrainstormSession[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM brainstorm_sessions 
    WHERE status = 'parsed' 
    ORDER BY updated_at ASC 
    LIMIT ?
  `).all(limit) as BrainstormSessionRow[];
  
  return rows.map(parseRow).filter(shouldDistill);
}

const DISTILL_PROMPT = `你是一个认知提炼引擎，负责对用户的初步「思维风暴」分析结果进行深度认知提炼。
你将看到用户笔记的原始内容片段，以及初步的认知分析结果。
请提取高价值的认知洞察（Insight），将其转化为明确的短句。

返回严格的 JSON 格式：
{
  "distilledInsights": [
    {
      "insight": "提炼出的认知洞察描述，一句话",
      "category": "direction|pattern|principle|risk",
      "confidence": 0.0到1.0的数字
    }
  ]
}

规则：
1. category 只能是以下四种：
   - "direction": 战略/目标方向的确认或调整
   - "pattern": 连贯的、跨越时间的模式或习惯
   - "principle": 提炼出的个人原则或做事方法
   - "risk": 潜在的长期风险或阻力
2. 洞察必须是具体、可复用的，不要复述流水账。
3. 最多提取 3 条核心洞察。如果没有强烈的洞察，返回空数组。

输入：
`;

interface DistillResponse {
  distilledInsights?: Array<{
    insight?: string;
    category?: string;
    confidence?: number;
  }>;
}

export async function distillBrainstormSession(sessionId: string): Promise<BrainstormSession> {
  const session = getBrainstormSession(sessionId);
  if (!session) throw new Error(`BrainstormSession not found: ${sessionId}`);
  if (session.status !== 'parsed') return session;

  const promptInput = JSON.stringify({
    rawPreview: session.rawInputPreview,
    themes: session.themes,
    questions: session.extractedQuestions,
    continuitySignals: session.continuitySignals,
  }, null, 2);

  try {
    const aiResponse = await callClaude(DISTILL_PROMPT + promptInput, 512);
    const parsed = parseJSON<DistillResponse>(aiResponse);
    
    const validInsights = (parsed.distilledInsights || [])
      .filter(i => 
        typeof i.insight === 'string' &&
        ['direction', 'pattern', 'principle', 'risk'].includes(i.category!) &&
        typeof i.confidence === 'number' && i.confidence >= 0.5
      )
      .map(i => `[${i.category}] ${i.insight} (${(i.confidence! * 100).toFixed(0)}%)`);

    const db = getDb();
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE brainstorm_sessions SET
        distilled_insights_json = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(validInsights),
      'distilled',
      now,
      sessionId
    );

    return getBrainstormSession(sessionId)!;
  } catch (error) {
    console.warn(`[brainstormSessions] distill failed for ${sessionId}:`, error);
    // Even on failure, return the parsed session untouched
    return session;
  }
}

// ── Related Sessions (P3) ──────────────────────────────

export function findRelatedBrainstormSessions(sessionId: string, limit = 5): BrainstormSession[] {
  const session = getBrainstormSession(sessionId);
  if (!session || session.themes.length === 0) return [];

  const db = getDb();
  
  // Create placeholders for the themes array
  const placeholders = session.themes.map(() => '?').join(', ');
  
  // Use json_each to find sessions that share at least one theme
  // We GROUP BY session ID to order by the number of shared themes (relevance)
  const rows = db.prepare(`
    SELECT bs.*, COUNT(t.value) as shared_count
    FROM brainstorm_sessions bs, json_each(bs.themes_json) t
    WHERE t.value IN (${placeholders})
      AND bs.id != ?
    GROUP BY bs.id
    ORDER BY shared_count DESC, bs.updated_at DESC
    LIMIT ?
  `).all(...session.themes, sessionId, limit) as BrainstormSessionRow[];

  return rows.map(parseRow);
}
