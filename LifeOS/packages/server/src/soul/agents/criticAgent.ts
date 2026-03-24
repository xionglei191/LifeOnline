import { callClaude, parseJSON } from '../../ai/aiClient.js';
import { Logger } from '../../utils/logger.js';
import type { ExtractionResult } from './extractorAgent.js';

const logger = new Logger('criticAgent');

import type { SuggestedAction } from '../cognitiveAnalyzer.js';

export interface CriticResult {
  emotionalTone: string;
  actionability: number;
  ambiguityPoints: string[];
  suggestedActions: SuggestedAction[];
}

const CRITIC_PROMPT = `你是一个批判家 (Critic Agent)，负责对用户的笔记以及已经提取出来的事实进行深度批判性评估，并给出后续行动建议。
请分析以下笔记原文和已提取的事实内容，并返回严格 JSON 格式（不要包含 markdown 代码块标记）：

{
  "emotionalTone": "用一个短语描述目前展现出的深层情绪基调",
  "actionability": 0.0到1.0之间的数字,
  "ambiguityPoints": ["逻辑破绽或自相矛盾点1", "未说清楚的含糊点2"],
  "suggestedActions": [
    {
      "kind": "动作类型",
      "confidence": 0.0到1.0之间的数字,
      "reason": "建议这个动作的理由"
    }
  ]
}

规则：
1. emotionalTone: 简短描述（如"焦虑但有方向感"、"平静反思"、"兴奋期待"），指出深层状态。
2. actionability: 笔记内容加上现有事实的可行动程度（0=纯感想，1=有明确待办事项）。
3. ambiguityPoints: 寻找用户逻辑上的破绽、自相矛盾，或者没说明白的含糊点。提取 0-3 个。
4. suggestedActions 的 kind 只能从以下选择：
   - "extract_tasks": 笔记中有待办事项需要提取
   - "update_persona_snapshot": 笔记反映了新的个人认知或决策
   - "ask_followup_question": ambiguityPoints 中提到的模糊点，需要向用户追问澄清
   - "persist_continuity_markdown": 笔记事实中包含值得长期保留的洞察或规律
5. confidence: 对这个建议的置信度（0.3以下不要建议）

`;

export async function runCriticAgent(
  noteId: string,
  content: string,
  extractorContext: ExtractionResult | null,
): Promise<CriticResult | null> {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  try {
    let combinedInput = `[笔记原文]\n${trimmed}\n\n`;
    if (extractorContext && extractorContext.facts.length > 0) {
      combinedInput += `[Extractor已提取的事实]\n${extractorContext.facts.map(f => `- ${f}`).join('\n')}\n\n`;
    }
    if (extractorContext && extractorContext.themes.length > 0) {
      combinedInput += `[Extractor已提取的主题]\n${extractorContext.themes.join(', ')}\n\n`;
    }

    const response = await callClaude(CRITIC_PROMPT + combinedInput, 512);
    
    interface RawCritic {
      emotionalTone?: string;
      actionability?: number;
      ambiguityPoints?: string[];
      suggestedActions?: SuggestedAction[];
    }
    
    const parsed = parseJSON<RawCritic>(response);
    
    return {
      emotionalTone: typeof parsed.emotionalTone === 'string' ? parsed.emotionalTone : '中性',
      actionability: typeof parsed.actionability === 'number' ? parsed.actionability : 0,
      ambiguityPoints: Array.isArray(parsed.ambiguityPoints) ? parsed.ambiguityPoints.filter(s => typeof s === 'string') : [],
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : []
    };
  } catch (error) {
    logger.error(`Critic Agent failed for note ${noteId}:`, error);
    return null;
  }
}
