import { getDb } from '../db/client.js';
import { callClaude, parseJSON } from '../ai/aiClient.js';
import { Logger } from '../utils/logger.js';
import type { PersonaDimensionPortrait } from '@lifeos/shared';

const logger = new Logger('longTermMemory');

const MEMORY_PROMPT = `你是一个深度的个人认知分析师 (Long-Term Memory Agent)。
你将收到用户在某个具体生活维度（如工作、健康、关系等）下的一系列历史认知碎片（包含脑力激荡结果与连续性记录）。
请你根据输入，提炼出一份该维度的“长期个人画像报告”，以纯 JSON 形式返回，不要有 markdown 块。

{
  "summary": "用一段话高度凝练用户在该维度的性格底色与长期面貌",
  "coreDrivers": ["核心驱动力/追求1", "核心驱动力/追求2"],
  "recurringBottlenecks": ["反复遇到的瓶颈/心魔1", "反复遇到的困境2"]
}

规则：
1. 请保持极度的客观与犀利，不要说废话。
2. coreDrivers: 提取 2-4 个用户表面行为背后真正的深层动机和长期追求。
3. recurringBottlenecks: 提取 2-4 个阻碍其发展的反弹模式或认知盲区。
`;

export async function generateLongTermPortrait(dimension: string): Promise<PersonaDimensionPortrait | null> {
  const db = getDb();
  
  // Fetch up to 20 recent brainstorm sessions for this dimension
  // Since brainstorm_sessions doesn't have a dimension column explicitly, we join with notes?
  // Wait, brainstorm_sessions is tied to notes via source_note_id.
  const sessionsStmt = db.prepare(`
    SELECT bs.distilled_insights
    FROM brainstorm_sessions bs
    JOIN notes n ON bs.source_note_id = n.id
    WHERE n.dimension = ?
    ORDER BY bs.updated_at DESC
    LIMIT 20
  `);
  
  const sessions = sessionsStmt.all(dimension) as Array<{ distilled_insights: string }>;
  
  // Also fetch continuity records
  const continuitiesStmt = db.prepare(`
    SELECT pattern, strength
    FROM continuity_records
    WHERE dimension = ?
    ORDER BY created_at DESC
    LIMIT 20
  `);
  const continuities = continuitiesStmt.all(dimension) as Array<{ pattern: string, strength: string }>;

  if (sessions.length === 0 && continuities.length === 0) {
    logger.warn(`No history found for dimension ${dimension}, unable to generate long-term memory`);
    return null;
  }

  const inputs: string[] = [];
  if (sessions.length > 0) {
    inputs.push('[近期提取灵感与洞察]');
    for (const s of sessions) {
      if (!s.distilled_insights) continue;
      try {
        const parsed = JSON.parse(s.distilled_insights);
        if (Array.isArray(parsed)) {
          inputs.push(parsed.map(str => `- ${str}`).join('\n'));
        }
      } catch {
        inputs.push(`- ${s.distilled_insights}`);
      }
    }
  }

  if (continuities.length > 0) {
    inputs.push('\n[长期连续性规律]');
    for (const c of continuities) {
      inputs.push(`- (${c.strength}) ${c.pattern}`);
    }
  }

  const rawInput = inputs.join('\n');
  try {
    const response = await callClaude(MEMORY_PROMPT + "\n\n输入信息：\n" + rawInput, 800);
    
    interface RawPortrait {
      summary?: string;
      coreDrivers?: string[];
      recurringBottlenecks?: string[];
    }
    const parsed = parseJSON<RawPortrait>(response);
    
    return {
      dimension,
      summary: parsed.summary || '无明确画像',
      coreDrivers: Array.isArray(parsed.coreDrivers) ? parsed.coreDrivers : [],
      recurringBottlenecks: Array.isArray(parsed.recurringBottlenecks) ? parsed.recurringBottlenecks : [],
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to generate long-term memory portrait:', error);
    return null;
  }
}
