import { getDb } from '../db/client.js';
import { callClaude } from '../ai/aiClient.js';
import { generateLongTermPortrait } from './longTermMemory.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('insightsReport');

const REPORT_PROMPT = `你是一位犀利且极具洞察力的“个人认知复盘导师” (Cognitive Insights Analyst)。
你将收到用户在过去一段时间内积累的：
1. [短期思考碎片]：来自多次闲置大脑运转（Brainstorming）提取出的纯思想火花。
2. [长效画像与连续性]：从用户过去几个月总结出的深层模式。

请你结合这些信息，为用户撰写一份《LifeOS 阶段性认知洞察报告》。
必须以极其干净、现代风的纯 Markdown 格式输出。

你的报告结构要求：
### 🔥 核心发现 (2-3个最引人注目的认知反转或固化模式)
(用尖锐、有冲击力的句子总结)
    
### 💡 深层驱动与瓶颈解码
(基于输入的长效画像与最近碎片，指出用户"真正想要什么"以及"又被什么老毛病困住了"。)
    
### 🎯 破局建议 (行动指南)
(提供 2-3 个具体且反直觉的高价值行动点，不要给陈词滥调，给出符合该用户历史特征的专属方案。)

规则：
1. 不要输出除 Markdown 正文以外的任何包裹字符或说明语。
2. 语气请保持客观、冷峻，甚至是略带“刺痛感”的清醒，不要阿谀奉承。
3. 如果输入资料非常少，请不要强行编造，直接温柔地指出“近期沉淀过少，建议多写一些真实的思考”。
`;

export async function generateInsightsReport(timeframeDays: number = 14): Promise<string> {
  const db = getDb();
  
  // 1. Fetch recent storm sessions
  const sessionsStmt = db.prepare(`
    SELECT bs.distilled_insights, n.dimension
    FROM brainstorm_sessions bs
    JOIN notes n ON bs.source_note_id = n.id
    WHERE bs.updated_at >= datetime('now', '-${timeframeDays} days')
      AND bs.status = 'distilled'
    ORDER BY bs.updated_at DESC
    LIMIT 30
  `);
  
  const sessions = sessionsStmt.all() as Array<{ distilled_insights: string, dimension: string }>;
  if (sessions.length === 0) {
    return "### 阶段性反馈不足\n最近没有足够的沉淀与跨界思考被捕获，无法生成有效的洞察报告。建议您多在 LifeOS 中记录真实的感受与困境。";
  }

  // Group dimension to find the top 2 active dimensions
  const dimensionCounts: Record<string, number> = {};
  for (const s of sessions) {
    dimensionCounts[s.dimension] = (dimensionCounts[s.dimension] || 0) + 1;
  }
  const topDimensions = Object.entries(dimensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(e => e[0]);

  // 2. Fetch long-term portraits for the active dimensions
  const portraits = [];
  for (const dim of topDimensions) {
     const portrait = await generateLongTermPortrait(dim);
     if (portrait) {
       portraits.push(portrait);
     }
  }

  const inputs: string[] = [];
  
  if (portraits.length > 0) {
    inputs.push('[系统级长效画像归纳]');
    for (const p of portraits) {
      inputs.push(`- **维度: ${p.dimension}**`);
      inputs.push(`  基调: ${p.summary}`);
      if (p.coreDrivers.length) inputs.push(`  深层驱动: ${p.coreDrivers.join(', ')}`);
      if (p.recurringBottlenecks.length) inputs.push(`  反复出现的瓶颈: ${p.recurringBottlenecks.join(', ')}`);
    }
    inputs.push('\n');
  }

  inputs.push(`[过去 ${timeframeDays} 天内的短期思想火花]`);
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

  const rawInput = inputs.join('\n');
  try {
    const response = await callClaude(REPORT_PROMPT + "\n\n输入信息：\n" + rawInput, 1500);
    return response.trim();
  } catch (error) {
    logger.error('Failed to generate insights report:', error);
    return "### 报告生成失败\n系统分析模块（AI 服务）当前不可用，无法完成底层数据的语义提炼。";
  }
}
