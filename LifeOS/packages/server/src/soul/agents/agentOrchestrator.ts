import { performance } from 'perf_hooks';
import { callClaude, parseJSON } from '../../ai/aiClient.js';
import type { SoulActionKind } from '../types.js';
import { getEffectiveAiProviderConfig } from '../../ai/providerConfigService.js';
import { getTodayTotalTokens } from '../../ai/usageTracker.js';
import { Logger } from '../../utils/logger.js';
import { runExtractorAgent } from './extractorAgent.js';
import { runCriticAgent } from './criticAgent.js';
import { runPlannerAgent } from './plannerAgent.js';

const logger = new Logger('agentOrchestrator');

// ── Types ──────────────────────────────────────────────

export interface SuggestedAction {
  kind: SoulActionKind;
  confidence: number; // 0-1
  reason: string;
}

export type ContinuitySignalType = 'goal_trend' | 'habit_pattern' | 'risk_signal' | 'recurring_theme' | 'emotional_cycle';

export interface ContinuitySignal {
  type: ContinuitySignalType;
  pattern: string;
  strength: 'weak' | 'medium' | 'strong';
  evidence?: string;
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
      "type": "信号类型",
      "pattern": "观察到的连续性模式",
      "strength": "weak/medium/strong",
      "evidence": "从笔记中摘出的证据片段"
    }
  ]
}

规则：
1. themes: 提取2-5个核心主题标签。必须是具体反映核心事务或心理子领域的主题（如：职业规划、人际关系、技术瓶颈），绝不能使用“日常”、“思考”、“总结”、“待办”等毫无信息量的泛词。
2. emotionalTone: 简短描述（如"焦虑但有方向感"、"平静反思"、"兴奋期待"）
3. actionability: 笔记内容的可行动程度（0=纯感想，1=有明确待办事项）
4. suggestedActions 的 kind 只能从以下选择：
   - "extract_tasks": 笔记中有待办事项、任务、计划需要提取
   - "update_persona_snapshot": 笔记反映了新的个人认知、方向转变、重要决策
   - "ask_followup_question": 笔记内容模糊、缺少关键信息、有未展开的重要方向，需要向用户追问澄清。reason 字段填写你想问用户的具体问题
   - "persist_continuity_markdown": 笔记中包含值得长期保留的洞察、原则、方向性认知或持续观察到的模式。reason 字段填写要持久化的核心洞察内容
   - "dispatch_physical_action": 如果用户表达了非常明确的物理世界规划（如预约日历、发送通知），产生这个建议。reason需要包含你想让系统替用户做的自然语言描述。
5. confidence: 你对这个建议的置信度（0.3以下不要建议）
6. continuitySignals: 识别笔记中隐含的长期连续性模式，每个信号必须归类（如果没有明显的连续性信号，返回空数组 []）。只有当内容明确指向某个跨越单篇笔记的趋势或历史规律时才提取：
   - type 只能从以下选择：
     - "goal_trend": 目标趋势——笔记中体现了某个方向性目标的推进、调整或偏离（例如：坚持做了三周的健身计划）
     - "habit_pattern": 习惯模式——笔记内容反映了某种日常习惯、行为规律或节奏（例如：最近总是报复性熬夜）
     - "risk_signal": 风险信号——笔记暗示了潜在的隐患、瓶颈、失败风险或健康风险（例如：连续两天提到心力交瘁）
     - "recurring_theme": 反复主题——该话题在用户内容中反复出现，暗示持续关注（例如：一直在纠结转行问题）
     - "emotional_cycle": 情绪周期——情绪波动、状态变化、心态转折的信号（例如：从开篇的焦虑转变到结尾的释然）
   - pattern: 用一句话描述观察到的模式本质（不要简单重复笔记，要指出背后的模式）
   - strength: 谨慎评估！"weak"(微弱暗示) / "medium"(明确信号) / "strong"(强烈证据且有重复提及的迹象)
   - evidence: 从笔记中原样摘出能够支撑该信号的一整句原文片段（10-50字），绝对不能自己编造

笔记内容：
`;

// ── Core Analysis Function ─────────────────────────────

export interface PersonaAnalysisContext {
  dimension?: string;
  personaSummary?: string | null;
  recentReintegrationSummaries?: string[];
}

export async function analyzeNoteContent(
  noteId: string,
  content: string,
  context?: PersonaAnalysisContext,
): Promise<NoteAnalysis> {
  const trimmed = content.trim();
  if (!trimmed) {
    return createEmptyAnalysis();
  }

  const MAX_TOKENS_PER_RUN = 8000;
  const MAX_TOKENS_PER_DAY = 100000;

  try {
    const todayTokens = getTodayTotalTokens();
    if (todayTokens >= MAX_TOKENS_PER_DAY) {
      logger.warn(`Daily token budget exceeded (${todayTokens}/${MAX_TOKENS_PER_DAY}). Falling back to observer mode.`);
      throw new Error('Daily token budget exceeded');
    }

    let totalTokens = 0;

    // --- Extractor Phase ---
    const eStart = performance.now();
    let extraction = await runExtractorAgent(noteId, trimmed, context);
    if (!extraction) {
      throw new Error(`Extractor Agent failed to return data for note ${noteId}`);
    }
    totalTokens += extraction.tokens;

    if (extraction.confidenceScore < 0.6) {
      logger.warn(`Extractor Agent confidence low (${extraction.confidenceScore}) for note ${noteId}, retrying...`);
      const retryResult = await runExtractorAgent(noteId, trimmed, context, "你上一次的提取置信度过低，请重新仔细阅读全文，注意不要遗漏深层的客观事实与长线连贯信号！");
      if (retryResult) {
        extraction = retryResult;
        totalTokens += retryResult.tokens;
      }
    }
    const extractorMs = Math.round(performance.now() - eStart);

    if (totalTokens >= MAX_TOKENS_PER_RUN) {
      logger.warn(`Run token budget exceeded (${totalTokens}/${MAX_TOKENS_PER_RUN}) after Extractor phase. Aborting DAG.`);
      throw new Error('Run token budget exceeded');
    }

    // --- Critic Phase ---
    const cStart = performance.now();
    let critic = await runCriticAgent(noteId, trimmed, extraction, context);
    if (!critic) {
      throw new Error(`Critic Agent failed to return data for note ${noteId}`);
    }
    totalTokens += critic.tokens;

    if (critic.confidenceScore < 0.6) {
      logger.warn(`Critic Agent confidence low (${critic.confidenceScore}) for note ${noteId}, retrying...`);
      const retryResult = await runCriticAgent(noteId, trimmed, extraction, context, "你上一次的批判置信度过低，请尝试从字里行间重新挖掘被隐藏的情绪、自相矛盾之处，或是与历史认知的冲突。");
      if (retryResult) {
        critic = retryResult;
        totalTokens += retryResult.tokens;
      }
    }
    const criticMs = Math.round(performance.now() - cStart);

    if (totalTokens >= MAX_TOKENS_PER_RUN) {
      logger.warn(`Run token budget exceeded (${totalTokens}/${MAX_TOKENS_PER_RUN}) after Critic phase. Aborting DAG.`);
      throw new Error('Run token budget exceeded');
    }

    // --- Planner Phase ---
    const pStart = performance.now();
    let planner = await runPlannerAgent(noteId, trimmed, extraction, critic);
    if (!planner) {
      throw new Error(`Planner Agent failed to return data for note ${noteId}`);
    }
    totalTokens += planner.tokens;

    if (planner.confidenceScore < 0.6) {
      logger.warn(`Planner Agent confidence low (${planner.confidenceScore}) for note ${noteId}, retrying...`);
      const retryResult = await runPlannerAgent(noteId, trimmed, extraction, critic, "你上一次的建议置信度过低，请重新审视上下文和历史灵感，提供更具穿透性的长远战略建议！");
      if (retryResult) {
        planner = retryResult;
        totalTokens += retryResult.tokens;
      }
    }
    const plannerMs = Math.round(performance.now() - pStart);

    // Record performance stats
    logger.info(`Agent DAG Execution Stats for note ${noteId}`, {
      extractorMs,
      criticMs,
      plannerMs,
      totalMs: extractorMs + criticMs + plannerMs,
      totalTokens
    });

    // Merge outputs to form NoteAnalysis
    return {
      themes: extraction.themes,
      emotionalTone: critic.emotionalTone,
      actionability: critic.actionability,
      suggestedActions: planner.suggestedActions,
      continuitySignals: extraction.continuitySignals,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.warn(`AI analysis failed for note ${noteId}, falling back to rules:`, error);
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

  // Build continuity signals from ruled-based keyword detection
  const continuitySignals = detectContinuitySignalsByRules(content);

  return {
    themes: extractSimpleThemes(content),
    emotionalTone,
    actionability: suggestedActions.some(a => a.kind === 'extract_tasks')
      ? Math.min(taskScore * 0.2, 1)
      : 0.2,
    suggestedActions,
    continuitySignals,
    analyzedAt: new Date().toISOString(),
  };
}

// ── Rule-based Continuity Signal Detection ─────────────

const CONTINUITY_SIGNAL_RULES: Array<{
  type: ContinuitySignalType;
  keywords: string[];
  strengthBase: ContinuitySignal['strength'];
}> = [
  {
    type: 'goal_trend',
    keywords: ['目标', '方向', '规划', '想做', '打算', '计划', '追求', '愿景'],
    strengthBase: 'medium',
  },
  {
    type: 'habit_pattern',
    keywords: ['每天', '每周', '习惯', '坚持', '日常', '例行', '固定', '保持'],
    strengthBase: 'medium',
  },
  {
    type: 'risk_signal',
    keywords: ['风险', '担心', '问题', '隐患', '瓶颈', '可能失败', '警觉', '注意'],
    strengthBase: 'medium',
  },
  {
    type: 'recurring_theme',
    keywords: ['又', '再次', '一直', '持续', '依然', '总是', '还是', '反复'],
    strengthBase: 'weak',
  },
  {
    type: 'emotional_cycle',
    keywords: ['最近', '这段时间', '感觉变了', '状态波动', '情绪', '心态', '低谷', '高涨'],
    strengthBase: 'weak',
  },
];

function detectContinuitySignalsByRules(content: string): ContinuitySignal[] {
  const signals: ContinuitySignal[] = [];

  for (const rule of CONTINUITY_SIGNAL_RULES) {
    const matchedKeywords = rule.keywords.filter(kw => content.includes(kw));
    if (matchedKeywords.length === 0) continue;

    // Determine strength: base + boost if multiple keywords hit
    const strength: ContinuitySignal['strength'] =
      matchedKeywords.length >= 3 ? 'strong'
      : matchedKeywords.length >= 2 ? 'medium'
      : rule.strengthBase;

    // Extract a short evidence snippet around the first matched keyword
    const firstKw = matchedKeywords[0];
    const kwIndex = content.indexOf(firstKw);
    const snippetStart = Math.max(0, kwIndex - 15);
    const snippetEnd = Math.min(content.length, kwIndex + firstKw.length + 35);
    const evidence = (snippetStart > 0 ? '…' : '') + content.slice(snippetStart, snippetEnd).trim() + (snippetEnd < content.length ? '…' : '');

    signals.push({
      type: rule.type,
      pattern: `检测到${matchedKeywords.length}个${rule.type}相关关键词：${matchedKeywords.join('、')}`,
      strength,
      evidence,
    });
  }

  return signals;
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
    type?: string;
    pattern?: string;
    strength?: string;
    evidence?: string;
  }>;
}

// AI-suggestable action kinds: only actions that the cognitive analyzer can directly propose.
// Promotion actions (create_event_node, promote_event_node, promote_continuity_record) are
// triggered via reintegration review, not via direct AI note analysis.
const AI_SUGGESTABLE_ACTION_KINDS: SoulActionKind[] = ['extract_tasks', 'update_persona_snapshot', 'ask_followup_question', 'persist_continuity_markdown', 'dispatch_physical_action'];

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

const VALID_CONTINUITY_SIGNAL_TYPES: ContinuitySignalType[] = ['goal_trend', 'habit_pattern', 'risk_signal', 'recurring_theme', 'emotional_cycle'];

function normalizeContinuitySignals(raw?: RawAnalysisResponse['continuitySignals']): ContinuitySignal[] {
  if (!Array.isArray(raw)) return [];
  const validStrengths = ['weak', 'medium', 'strong'] as const;
  return raw
    .filter(s => s && typeof s.pattern === 'string')
    .map(s => ({
      type: VALID_CONTINUITY_SIGNAL_TYPES.includes(s.type as ContinuitySignalType)
        ? s.type as ContinuitySignalType
        : 'recurring_theme',
      pattern: s.pattern!,
      strength: validStrengths.includes(s.strength as any) ? s.strength as ContinuitySignal['strength'] : 'weak',
      ...(typeof s.evidence === 'string' && s.evidence.trim() ? { evidence: s.evidence.trim() } : {}),
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
