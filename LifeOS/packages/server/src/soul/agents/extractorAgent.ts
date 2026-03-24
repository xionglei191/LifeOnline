import { callClaudeWithUsage, parseJSON } from '../../ai/aiClient.js';
import type { ContinuitySignal, PersonaAnalysisContext } from './agentOrchestrator.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('extractorAgent');

export interface ExtractionResult {
  facts: string[];
  themes: string[];
  continuitySignals: ContinuitySignal[];
  confidenceScore: number;
  tokens: number;
}

const EXTRACTOR_PROMPT = `你是一个专注的事实提取器 (Extractor Agent)，负责从用户笔记中提取客观结构化信息。
请分析以下笔记内容，并返回严格 JSON 格式（不要包含 markdown 代码块标记）：

{
  "confidenceScore": 0.0到1.0之间的数字,
  "facts": ["核心事实1", "核心事实2"],
  "themes": ["主题1", "主题2"],
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
1. confidenceScore: 你对本次提取的信息完整度和准确度的置信度（0.0-1.0）。如果笔记内容极为空泛或你无法提取有价值的事实，请给出低分。
2. facts: 提取3-5条笔记中反映的最核心客观事实、行为或决定。保持简明扼要。
2. themes: 提取2-5个核心主题标签。必须是具体反映核心事务或心理子领域的主题（如：职业规划、人际关系、技术瓶颈），绝不能使用“日常”、“思考”、“总结”、“待办”等毫无信息量的泛词。
3. continuitySignals: 识别笔记中隐含的长期连续性模式，如果没有明显的连续性信号，返回空数组 []：
   - type 只能从以下选择：
     - "goal_trend": 目标趋势——体现了某个方向性目标的推进或偏离
     - "habit_pattern": 习惯模式——反映某种日常习惯行为
     - "risk_signal": 风险信号——暗示潜在隐患或健康风险
     - "recurring_theme": 反复主题——该话题在用户历史中反复出现
     - "emotional_cycle": 情绪周期——状态变化的客观记录
   - pattern: 一句话描述模式本质
   - strength: "weak" / "medium" / "strong"
   - evidence: 10-50字的原句摘录，绝不捏造

笔记内容：
`;

export async function runExtractorAgent(
  noteId: string,
  content: string,
  context?: PersonaAnalysisContext,
  retryPrompt?: string,
): Promise<ExtractionResult | null> {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const historyParts: string[] = [];
    if (context?.personaSummary) {
      historyParts.push(`当前人格快照: ${context.personaSummary}`);
    }
    if (context?.recentReintegrationSummaries?.length) {
      historyParts.push(
        `最近认知整合记录:\n${context.recentReintegrationSummaries.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      );
    }
    
    const historyPrefix = historyParts.length
      ? `[历史认知上下文]\n${historyParts.join('\n')}\n\n`
      : '';
    
    const penaltyPrefix = retryPrompt ? `[重试指示]\n${retryPrompt}\n\n` : '';

    const { text, usage } = await callClaudeWithUsage(penaltyPrefix + historyPrefix + EXTRACTOR_PROMPT + trimmed, 512);
    
    interface RawExtraction {
      confidenceScore?: number;
      facts?: string[];
      themes?: string[];
      continuitySignals?: any[];
    }
    
    const parsed = parseJSON<RawExtraction>(text);
    
    return {
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
      facts: Array.isArray(parsed.facts) ? parsed.facts.filter(s => typeof s === 'string') : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes.filter(s => typeof s === 'string') : [],
      continuitySignals: Array.isArray(parsed.continuitySignals) 
        ? parsed.continuitySignals.filter(sig => 
            sig && typeof sig.type === 'string' && typeof sig.pattern === 'string' && typeof sig.strength === 'string'
          ) as ContinuitySignal[]
        : [],
      tokens: usage.input_tokens + usage.output_tokens
    };
  } catch (error) {
    logger.error(`Extractor Agent failed for note ${noteId}:`, error);
    return null;
  }
}
