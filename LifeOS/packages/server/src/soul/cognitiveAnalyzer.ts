import { callClaude, parseJSON } from '../ai/aiClient.js';
import type { SoulActionKind } from './types.js';

// ── Types ──────────────────────────────────────────────

export interface SuggestedAction {
  kind: SoulActionKind;
  confidence: number; // 0-1
  reason: string;
}

export interface ContinuitySignal {
  pattern: string;
  strength: 'weak' | 'medium' | 'strong';
}

export interface NoteAnalysis {
  themes: string[];
  emotionalTone: string;
  actionability: number; // 0-1
  suggestedActions: SuggestedAction[];
  continuitySignals: ContinuitySignal[];
  analyzedAt: string;
}

// ── AI Prompt ──────────────────────────────────────────

const ANALYSIS_PROMPT = `你是一个认知分析引擎，负责理解用户笔记内容并提取结构化认知信号。

分析以下笔记内容，返回严格 JSON 格式（不要包含 markdown 代码块标记）：

{
  "themes": ["主题1", "主题2"],
  "emotionalTone": "用一个短语描述情绪基调",
  "actionability": 0.0到1.0之间的数字,
  "suggestedActions": [
    {
      "kind": "动作类型",
      "confidence": 0.0到1.0之间的数字,
      "reason": "建议这个动作的理由"
    }
  ],
  "continuitySignals": [
    {
      "pattern": "观察到的连续性模式",
      "strength": "weak/medium/strong"
    }
  ]
}

规则：
1. themes: 提取2-5个核心主题标签
2. emotionalTone: 简短描述（如"焦虑但有方向感"、"平静反思"、"兴奋期待"）
3. actionability: 笔记内容的可行动程度（0=纯感想，1=有明确待办事项）
4. suggestedActions 的 kind 只能从以下选择：
   - "extract_tasks": 笔记中有待办事项、任务、计划需要提取
   - "update_persona_snapshot": 笔记反映了新的个人认知、方向转变、重要决策
   - "ask_followup_question": 笔记内容模糊、缺少关键信息、有未展开的重要方向，需要向用户追问澄清。reason 字段填写你想问用户的具体问题
   - "persist_continuity_markdown": 笔记中包含值得长期保留的洞察、原则、方向性认知或持续观察到的模式。reason 字段填写要持久化的核心洞察内容
5. confidence: 你对这个建议的置信度（0.3以下不要建议）
6. continuitySignals: 如果内容暗示了某种持续性模式（如"又提到了想转行"、"连续关注某个话题"），标记为信号

笔记内容：
`;

// ── Core Analysis Function ─────────────────────────────

export async function analyzeNoteContent(
  noteId: string,
  content: string,
  context?: { dimension?: string },
): Promise<NoteAnalysis> {
  const trimmed = content.trim();
  if (!trimmed) {
    return createEmptyAnalysis();
  }

  try {
    const response = await callClaude(ANALYSIS_PROMPT + trimmed, 512);
    const parsed = parseJSON<RawAnalysisResponse>(response);
    return normalizeAnalysis(parsed);
  } catch (error) {
    console.warn(`[cognitiveAnalyzer] AI analysis failed for note ${noteId}, falling back to rules:`, error);
    return analyzeByRules(trimmed, context?.dimension);
  }
}

// ── Rule-based Fallback ────────────────────────────────

const TASK_KEYWORDS = ['TODO', 'todo', '待办', '计划', '需要', '任务', '完成', '截止', '安排', 'deadline'];
const PERSONA_KEYWORDS = ['我觉得', '我想', '我决定', '方向', '目标', '反思', '感悟', '认识到', '发现', '转变'];
const EMOTION_POSITIVE = ['开心', '满意', '期待', '有信心', '进步', '成长'];
const EMOTION_NEGATIVE = ['焦虑', '担心', '困惑', '迷茫', '压力', '失败'];

function analyzeByRules(content: string, dimension?: string): NoteAnalysis {
  const taskScore = countKeywordHits(content, TASK_KEYWORDS);
  const personaScore = countKeywordHits(content, PERSONA_KEYWORDS);

  const suggestedActions: SuggestedAction[] = [];

  if (taskScore >= 2) {
    suggestedActions.push({
      kind: 'extract_tasks',
      confidence: Math.min(0.5 + taskScore * 0.1, 0.9),
      reason: `笔记中包含 ${taskScore} 个任务相关关键词`,
    });
  }

  if (personaScore >= 2) {
    suggestedActions.push({
      kind: 'update_persona_snapshot',
      confidence: Math.min(0.4 + personaScore * 0.1, 0.8),
      reason: `笔记中包含 ${personaScore} 个自我认知相关关键词`,
    });
  }

  // Growth dimension notes always get persona snapshot suggestion (matches original hardcoded behavior)
  if (dimension === 'growth' && !suggestedActions.some(a => a.kind === 'update_persona_snapshot')) {
    suggestedActions.push({
      kind: 'update_persona_snapshot',
      confidence: Math.max(0.5, 0.3 + personaScore * 0.1),
      reason: '成长维度笔记，默认建议更新人格快照',
    });
  }

  // Short or question-bearing notes: suggest follow-up question
  const questionMarks = (content.match(/[？?]/g) || []).length;
  if (content.length < 80 || questionMarks >= 2) {
    suggestedActions.push({
      kind: 'ask_followup_question',
      confidence: Math.min(0.4 + questionMarks * 0.1, 0.7),
      reason: content.length < 80
        ? '笔记内容较短，建议追问以获取更多细节：能否展开说明具体的背景或下一步计划？'
        : `笔记中包含 ${questionMarks} 个疑问，建议追问以澄清方向`,
    });
  }

  // Continuity signals with medium+ strength: suggest persist_continuity_markdown
  // (In rule-based fallback, we detect repeated theme patterns)
  const continuityKeywords = ['又', '再次', '一直', '持续', '依然', '总是', '还是', '反复'];
  const continuityHits = countKeywordHits(content, continuityKeywords);
  if (continuityHits >= 2 || (content.length > 200 && continuityHits >= 1)) {
    suggestedActions.push({
      kind: 'persist_continuity_markdown',
      confidence: Math.min(0.4 + continuityHits * 0.15, 0.75),
      reason: `笔记中包含 ${continuityHits} 个连续性模式关键词，建议持久化为长期认知记录`,
    });
  }

  // If nothing matched, still suggest persona snapshot with low confidence
  if (suggestedActions.length === 0 && content.length > 100) {
    suggestedActions.push({
      kind: 'update_persona_snapshot',
      confidence: 0.3,
      reason: '笔记有实质内容但无明确关键词匹配，建议作为画像参考',
    });
  }

  const positiveHits = countKeywordHits(content, EMOTION_POSITIVE);
  const negativeHits = countKeywordHits(content, EMOTION_NEGATIVE);
  const emotionalTone = positiveHits > negativeHits ? '正面积极'
    : negativeHits > positiveHits ? '压力焦虑'
    : '平和中性';

  return {
    themes: extractSimpleThemes(content),
    emotionalTone,
    actionability: suggestedActions.some(a => a.kind === 'extract_tasks')
      ? Math.min(taskScore * 0.2, 1)
      : 0.2,
    suggestedActions,
    continuitySignals: [],
    analyzedAt: new Date().toISOString(),
  };
}

function countKeywordHits(content: string, keywords: string[]): number {
  return keywords.filter(kw => content.includes(kw)).length;
}

function extractSimpleThemes(content: string): string[] {
  const themes: string[] = [];
  const dimensionKeywords: Record<string, string> = {
    '健康': 'health', '运动': 'health', '睡眠': 'health',
    '工作': 'career', '项目': 'career', '职业': 'career',
    '理财': 'finance', '投资': 'finance', '收入': 'finance',
    '学习': 'learning', '读书': 'learning', '技术': 'learning',
    '家人': 'relationship', '朋友': 'relationship', '社交': 'relationship',
  };

  for (const [keyword, theme] of Object.entries(dimensionKeywords)) {
    if (content.includes(keyword) && !themes.includes(theme)) {
      themes.push(theme);
    }
  }

  return themes.length > 0 ? themes : ['general'];
}

// ── Helpers ────────────────────────────────────────────

interface RawAnalysisResponse {
  themes?: string[];
  emotionalTone?: string;
  actionability?: number;
  suggestedActions?: Array<{
    kind?: string;
    confidence?: number;
    reason?: string;
  }>;
  continuitySignals?: Array<{
    pattern?: string;
    strength?: string;
  }>;
}

// AI-suggestable action kinds: only actions that the cognitive analyzer can directly propose.
// Promotion actions (create_event_node, promote_event_node, promote_continuity_record) are
// triggered via reintegration review, not via direct AI note analysis.
const AI_SUGGESTABLE_ACTION_KINDS: SoulActionKind[] = ['extract_tasks', 'update_persona_snapshot', 'ask_followup_question', 'persist_continuity_markdown'];

function normalizeAnalysis(raw: RawAnalysisResponse): NoteAnalysis {
  return {
    themes: Array.isArray(raw.themes) ? raw.themes.filter(t => typeof t === 'string').slice(0, 5) : ['general'],
    emotionalTone: typeof raw.emotionalTone === 'string' ? raw.emotionalTone : '未知',
    actionability: typeof raw.actionability === 'number'
      ? Math.max(0, Math.min(1, raw.actionability))
      : 0.3,
    suggestedActions: normalizeSuggestedActions(raw.suggestedActions),
    continuitySignals: normalizeContinuitySignals(raw.continuitySignals),
    analyzedAt: new Date().toISOString(),
  };
}

function normalizeSuggestedActions(raw?: RawAnalysisResponse['suggestedActions']): SuggestedAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(a => a && typeof a.kind === 'string' && AI_SUGGESTABLE_ACTION_KINDS.includes(a.kind as SoulActionKind))
    .map(a => ({
      kind: a.kind as SoulActionKind,
      confidence: typeof a.confidence === 'number' ? Math.max(0, Math.min(1, a.confidence)) : 0.5,
      reason: typeof a.reason === 'string' ? a.reason : 'AI分析建议',
    }))
    .filter(a => a.confidence >= 0.3);
}

function normalizeContinuitySignals(raw?: RawAnalysisResponse['continuitySignals']): ContinuitySignal[] {
  if (!Array.isArray(raw)) return [];
  const validStrengths = ['weak', 'medium', 'strong'] as const;
  return raw
    .filter(s => s && typeof s.pattern === 'string')
    .map(s => ({
      pattern: s.pattern!,
      strength: validStrengths.includes(s.strength as any) ? s.strength as ContinuitySignal['strength'] : 'weak',
    }));
}

function createEmptyAnalysis(): NoteAnalysis {
  return {
    themes: [],
    emotionalTone: '无内容',
    actionability: 0,
    suggestedActions: [],
    continuitySignals: [],
    analyzedAt: new Date().toISOString(),
  };
}
