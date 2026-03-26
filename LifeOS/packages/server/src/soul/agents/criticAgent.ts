import { callClaudeWithUsage, parseJSON } from '../../ai/aiClient.js';
import { Logger } from '../../utils/logger.js';
import type { ExtractionResult } from './extractorAgent.js';

const logger = new Logger('criticAgent');

import type { SuggestedAction, PersonaAnalysisContext } from './agentOrchestrator.js';

export interface CriticResult {
  emotionalTone: string;
  actionability: number;
  ambiguityPoints: string[];
  cognitiveConflicts: string[];
  confidenceScore: number;
  tokens: number;
}

const CRITIC_PROMPT = `你是一个批判家 (Critic Agent)，负责对用户的笔记以及已经提取出来的事实进行深度批判性评估。
请分析以下笔记原文和已提取的事实内容，并返回严格 JSON 格式（不要包含 markdown 代码块标记）：

{
  "confidenceScore": 0.0到1.0之间的数字,
  "emotionalTone": "用一个短语描述目前展现出的深层情绪基调",
  "actionability": 0.0到1.0之间的数字,
  "ambiguityPoints": ["逻辑破绽或自相矛盾点1", "未说清楚的含糊点2"],
  "cognitiveConflicts": ["与过去自我认知的冲突点1", "认知的转变点2"]
}

规则：
1. confidenceScore: 你对本次批判深度和准确度的置信度（0.0-1.0）。如果你觉得内容没提供足够细节让你做批判，给出低分。
2. emotionalTone: 简短描述（如"焦虑但有方向感"、"平静反思"、"兴奋期待"），指出深层状态。
3. actionability: 笔记内容加上现有事实的可行动程度（0=纯感想，1=有明确待办事项）。【关键：如果原文中包含“原始文字”或“语音”记录的小片段且隐含行动意图（如买东西、安排事务），请强行破除外部 AI 总结废话的干扰，打出 >0.6 的高分！】
4. ambiguityPoints: 寻找用户逻辑上的破绽、自相矛盾，或者没说明白的含糊点。提取 0-3 个。
5. cognitiveConflicts: 如果输入了 [历史认知上下文]，请严格比对当前的笔记内容与过去的长效画像/历史回忆。检测是否出现立场的惊天反转、原则的违背、或是目标的遗忘。如果有，以“过去认为...但今天却...”的形式返回。如果没有明显冲突，返回空数组 []。

`;

export async function runCriticAgent(
  noteId: string,
  content: string,
  extractorContext: ExtractionResult | null,
  context?: PersonaAnalysisContext,
  retryPrompt?: string,
): Promise<CriticResult | null> {
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

    let combinedInput = `[笔记原文]\n${trimmed}\n\n`;
    if (extractorContext && extractorContext.facts.length > 0) {
      combinedInput += `[Extractor已提取的事实]\n${extractorContext.facts.map(f => `- ${f}`).join('\n')}\n\n`;
    }
    if (extractorContext && extractorContext.themes.length > 0) {
      combinedInput += `[Extractor已提取的主题]\n${extractorContext.themes.join(', ')}\n\n`;
    }

    const penaltyPrefix = retryPrompt ? `[重试指示]\n${retryPrompt}\n\n` : '';

    const { text, usage } = await callClaudeWithUsage(penaltyPrefix + historyPrefix + CRITIC_PROMPT + combinedInput, 512);
    
    interface RawCritic {
      confidenceScore?: number;
      emotionalTone?: string;
      actionability?: number;
      ambiguityPoints?: string[];
      cognitiveConflicts?: string[];
    }
    
    const parsed = parseJSON<RawCritic>(text);
    
    return {
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
      emotionalTone: typeof parsed.emotionalTone === 'string' ? parsed.emotionalTone : '中性',
      actionability: typeof parsed.actionability === 'number' ? parsed.actionability : 0,
      ambiguityPoints: Array.isArray(parsed.ambiguityPoints) ? parsed.ambiguityPoints.filter(s => typeof s === 'string') : [],
      cognitiveConflicts: Array.isArray(parsed.cognitiveConflicts) ? parsed.cognitiveConflicts.filter(s => typeof s === 'string') : [],
      tokens: usage.input_tokens + usage.output_tokens
    };
  } catch (error) {
    logger.error(`Critic Agent failed for note ${noteId}:`, error);
    return null;
  }
}
