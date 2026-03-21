import type { AISuggestion, Dimension } from '@lifeos/shared';
import { getDb } from '../db/client.js';
import { callClaude, parseJSON } from './aiClient.js';
import { getEffectivePrompt } from './promptService.js';

interface NoteRow {
  id: string;
  file_name: string;
  content: string;
  dimension: string;
  status: string;
  type: string;
  date: string;
  created: string;
}

interface DimensionStatsRow {
  dimension: string;
  total: number;
  pending: number;
  in_progress: number;
  done: number;
}

interface AiSuggestionPayload {
  suggestions?: Array<{
    dimension?: string;
    title?: string;
    content?: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
}

const DIMENSIONS = ['health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth'] as const;

type SupportedDimension = typeof DIMENSIONS[number];

function isSupportedDimension(value: unknown): value is SupportedDimension {
  return typeof value === 'string' && DIMENSIONS.includes(value as SupportedDimension);
}

function buildHeuristicSuggestions(now: string, rows: DimensionStatsRow[], recentNotes: NoteRow[]): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const overloaded = [...rows].sort((a, b) => {
    const overloadGapA = a.pending + a.in_progress - a.done;
    const overloadGapB = b.pending + b.in_progress - b.done;
    return overloadGapB - overloadGapA;
  })[0];

  if (overloaded && overloaded.pending + overloaded.in_progress >= 2 && isSupportedDimension(overloaded.dimension)) {
    suggestions.push({
      id: `overload-${overloaded.dimension}`,
      type: 'overload',
      dimension: overloaded.dimension,
      title: `${overloaded.dimension} 负载偏高`,
      content: `当前有 ${overloaded.pending} 条待办、${overloaded.in_progress} 条进行中，建议先收敛到 1 个最重要推进项。`,
      createdAt: now,
    });
  }

  const bestProgress = [...rows]
    .filter((row) => row.done > 0)
    .sort((a, b) => b.done - a.done)[0];

  if (bestProgress && isSupportedDimension(bestProgress.dimension)) {
    suggestions.push({
      id: `goal-${bestProgress.dimension}`,
      type: 'goal',
      dimension: bestProgress.dimension,
      title: `${bestProgress.dimension} 已形成推进势能`,
      content: `最近已完成 ${bestProgress.done} 项，适合补一条下一步明确动作，延续已有节奏。`,
      createdAt: now,
    });
  }

  const neglected = rows
    .filter((row) => row.total === 0 || row.pending + row.in_progress + row.done <= 1)
    .sort((a, b) => a.total - b.total)[0];

  if (neglected && isSupportedDimension(neglected.dimension)) {
    suggestions.push({
      id: `balance-${neglected.dimension}`,
      type: 'balance',
      dimension: neglected.dimension,
      title: `${neglected.dimension} 关注度偏低`,
      content: '这一维最近记录较少，可以补一次小检查或小行动，避免长期失衡。',
      createdAt: now,
    });
  }

  const reminderSource = recentNotes.find((note) => note.status !== 'done' && note.content.trim().length > 0) ?? recentNotes[0];
  if (reminderSource) {
    suggestions.push({
      id: `reminder-${reminderSource.id}`,
      type: 'reminder',
      dimension: isSupportedDimension(reminderSource.dimension) ? reminderSource.dimension : undefined,
      title: '从最近记录中补一次收口',
      content: `优先回看《${reminderSource.file_name}》并提炼一个可执行下一步，避免信息只停留在记录层。`,
      createdAt: now,
    });
  }

  return suggestions.slice(0, 3);
}

function mapPriorityToSuggestionType(priority: 'high' | 'medium' | 'low' | undefined): AISuggestion['type'] {
  if (priority === 'high') return 'overload';
  if (priority === 'low') return 'balance';
  return 'goal';
}

function normalizeAiSuggestions(now: string, payload: AiSuggestionPayload): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  for (const [index, item] of (payload.suggestions || []).entries()) {
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    const dimension = isSupportedDimension(item.dimension) ? item.dimension : undefined;
    if (!title || !content) {
      continue;
    }
    suggestions.push({
      id: `ai-suggestion-${index + 1}`,
      type: mapPriorityToSuggestionType(item.priority),
      title,
      content,
      dimension,
      createdAt: now,
    });
    if (suggestions.length >= 3) {
      break;
    }
  }

  return suggestions;
}

export async function listAiSuggestions(): Promise<AISuggestion[]> {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db.prepare(`
    SELECT
      dimension,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
    FROM notes
    WHERE dimension IN (${DIMENSIONS.map(() => '?').join(', ')})
    GROUP BY dimension
  `).all(...DIMENSIONS) as DimensionStatsRow[];

  const rowMap = new Map(rows.map((row) => [row.dimension, row]));
  const dimensionStats = DIMENSIONS.map((dimension) => rowMap.get(dimension) ?? {
    dimension,
    total: 0,
    pending: 0,
    in_progress: 0,
    done: 0,
  });

  const recentNotes = db.prepare(`
    SELECT id, file_name, content, dimension, status, type, date, created
    FROM notes
    ORDER BY date DESC, created DESC
    LIMIT 8
  `).all() as NoteRow[];

  const fallback = buildHeuristicSuggestions(now, dimensionStats, recentNotes);

  try {
    const prompt = getEffectivePrompt('suggest')
      .replace('{dashboardData}', JSON.stringify({ dimensionStats }, null, 2))
      .replace('{recentNotes}', JSON.stringify(
        recentNotes.map((note) => ({
          title: note.file_name,
          dimension: note.dimension,
          status: note.status,
          type: note.type,
          excerpt: note.content.slice(0, 180),
        })),
        null,
        2,
      ));

    const response = await callClaude(prompt, 512);
    const aiSuggestions = normalizeAiSuggestions(now, parseJSON<AiSuggestionPayload>(response));
    return aiSuggestions.length > 0 ? aiSuggestions : fallback;
  } catch {
    return fallback;
  }
}
