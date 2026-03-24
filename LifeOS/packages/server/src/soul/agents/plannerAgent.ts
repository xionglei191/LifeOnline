import { callClaude, parseJSON } from '../../ai/aiClient.js';
import { Logger } from '../../utils/logger.js';
import type { SuggestedAction } from './agentOrchestrator.js';
import type { ExtractionResult } from './extractorAgent.js';
import type { CriticResult } from './criticAgent.js';
import { getEmbedding } from '../../ai/embedding.js';
import { getDb } from '../../db/client.js';
import { isVectorStoreReady, searchSimilar } from '../../db/vectorStore.js';
import { getBrainstormSession } from '../brainstormSessions.js';
import { getGateStats, detectGatePatterns } from '../gateLearning.js';

const logger = new Logger('plannerAgent');

export interface PlannerResult {
  suggestedActions: SuggestedAction[];
}

const PLANNER_PROMPT = `你是一个战略规划师 (Planner Agent)，负责根据用户当前的笔记信息，以及从过去召回的历史灵感，给出下一步的最佳行动建议。
请分析以下输入，并返回严格 JSON 格式（不要包含 markdown 代码块标记）：

{
  "suggestedActions": [
    {
      "kind": "动作类型",
      "confidence": 0.0到1.0之间的数字,
      "reason": "建议这个动作的理由（请结合历史上下文说明为什么这是一个好主意，如果是以前拒绝过的模式请避开）"
    }
  ]
}

规则：
1. suggestedActions 的 kind 只能从以下选择：
   - "extract_tasks": 笔记中有明确待办事项需要提取
   - "update_persona_snapshot": 笔记反映了新的个人认知或决策转变
   - "ask_followup_question": 需要向用户追问澄清笔记中的含糊点
   - "persist_continuity_markdown": 笔记事实中包含值得长期保留的洞察或规律
2. confidence: 对这个建议的置信度（0.3以下不要建议，最高建议不超过 3 个动作）。
3. 如果输入中包含 [召回的历史灵感]，请积极参考它们判断这是否是一个长期重复的困境，如果是，提出更深度的动作或不一样的建议。

`;

export async function runPlannerAgent(
  noteId: string,
  content: string,
  extractorContext: ExtractionResult,
  criticContext: Omit<CriticResult, 'suggestedActions'>,
): Promise<PlannerResult | null> {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  try {
    let combinedInput = `[笔记原文]\n${trimmed}\n\n`;

    if (extractorContext.facts.length > 0) {
      combinedInput += `[核心事实]\n${extractorContext.facts.map(f => `- ${f}`).join('\n')}\n\n`;
    }
    if (extractorContext.themes.length > 0) {
      combinedInput += `[核心主题]\n${extractorContext.themes.join(', ')}\n\n`;
    }

    combinedInput += `[情绪基调]\n${criticContext.emotionalTone}\n\n`;
    combinedInput += `[可行动性打分]\n${criticContext.actionability}\n\n`;
    if (criticContext.ambiguityPoints.length > 0) {
      combinedInput += `[发现的逻辑破绽与模糊点]\n${criticContext.ambiguityPoints.map(a => `- ${a}`).join('\n')}\n\n`;
    }

    // Vector RAG Logic
    if (isVectorStoreReady()) {
      try {
        const queryText = combinedInput;
        const queryEmbedding = await getEmbedding(queryText.slice(0, 1000)); // Limit size for embedding
        
        const db = getDb();
        const results = searchSimilar(db, queryEmbedding, 3);
        
        const historicalInsights: string[] = [];
        for (const res of results) {
          // res.id is format "bs:brainstorm:note-uuid" because brainstorm session IDs are "brainstorm:note-uuid"
          // Let's parse out the original session ID.
          const sessionId = res.id.startsWith('bs:') ? res.id.slice(3) : res.id;
          const session = getBrainstormSession(sessionId);
          if (session && session.sourceNoteId !== noteId) { // Skip self
            const snippet = session.distilledInsights.join(';') || session.rawInputPreview.slice(0, 100);
            historicalInsights.push(`- 之前的灵感：${snippet} (相似度分:${res.distance.toFixed(2)})`);
          }
        }

        if (historicalInsights.length > 0) {
          combinedInput += `[召回的历史灵感 (RAG)]\n${historicalInsights.join('\n')}\n\n`;
          logger.info(`RAG injected ${historicalInsights.length} historical insights for note ${noteId}`);
        }
      } catch (embErr) {
        logger.warn('Failed to fetch embeddings or RAG data, proceeding without historical context', embErr);
      }
    }

    // Gate Learning Logic
    const gateInfoLines: string[] = [];
    for (const kind of ['extract_tasks', 'update_persona_snapshot', 'ask_followup_question', 'persist_continuity_markdown']) {
      const stats = getGateStats(kind);
      if (stats.totalDecisions > 0) {
        const patterns = detectGatePatterns(kind);
        const ptStr = patterns.length > 0 ? ` (模式: ${patterns.map(p => p.description).join('; ')})` : '';
        gateInfoLines.push(`- ${kind}: 共被拦截/接受 ${stats.totalDecisions} 次，近期接受率 ${(stats.recentApproveRate * 100).toFixed(0)}%${ptStr}`);
      }
    }
    if (gateInfoLines.length > 0) {
      combinedInput += `[门控治理历史偏好 (Gate Learning)]\n（注意：如果某动作近期接受率极低，请不要为了提出而提出，应减少低质建议）\n${gateInfoLines.join('\n')}\n\n`;
    }

    const response = await callClaude(PLANNER_PROMPT + combinedInput, 512);
    
    interface RawPlanner {
      suggestedActions?: SuggestedAction[];
    }
    
    const parsed = parseJSON<RawPlanner>(response);
    
    return {
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : []
    };
  } catch (error) {
    logger.error(`Planner Agent failed for note ${noteId}:`, error);
    return null;
  }
}
