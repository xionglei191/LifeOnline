import { getDb } from '../db/client.js';
import { callClaude } from '../ai/aiClient.js';
import { Logger } from '../utils/logger.js';
import { upsertReintegrationRecord } from './reintegrationRecords.js';
import { isVectorStoreReady } from '../db/vectorStore.js';

const logger = new Logger('idleProcessor');

const IDLE_DAYS = 7;
const MAX_SESSIONS = 3;

const IDLE_PROMPT = `你是一个跨领域关联引擎 (Idle-State Processor)，负责在用户没有主动输入时，对过去长久沉积的潜意识想法（BrainstormSession）进行重温和发散。
下面是几条用户在过去记录的想法，这些碎片之间可能存在语义相似或潜在排斥的关系，且最近没有被回顾过。

请阅读这些信息，尝试找到它们之间的潜在联系、深层矛盾或者共同的主旨，并生成一段全新的、有建设性的洞察（Insight）。
洞察必须以第一人称（代表用户的内省声音）来写，语气深刻且具有反思性。
不要写成机器人的总结，直接输出洞察的纯文本，不要有多余的格式或开场白。

【重要强制规则】：
在他最后的洞察中，你必须明确点出你是如何将这几条不同时间的“碎片”产生联想的（例如：“从碎片1关于...的焦虑，再看到碎片2中提到的...我忽然意识到...”）。必须在洞察中体现跨笔记 (Cross-Session) 的关联价值。
`;

function buildReintegrationIdDumb(sourceNoteId: string, now: string) {
  return `reintegration:${sourceNoteId}:${now}`;
}

export async function runIdleProcessing(): Promise<void> {
  logger.info('Starting Idle-State Processing cycle...');
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - IDLE_DAYS);
  const cutoffIso = cutoffDate.toISOString();

  // Find one random dormant session as a seed
  const seedSession = db.prepare(`
    SELECT * FROM brainstorm_sessions 
    WHERE status = 'distilled' AND updated_at < ? 
    ORDER BY RANDOM() LIMIT 1
  `).get(cutoffIso) as any;

  if (!seedSession) {
    logger.info('No dormant BrainstormSessions found for processing.');
    return;
  }

  const dormantSessions = [seedSession];

  // Try to find similar sessions using Vector Search (RAG)
  if (isVectorStoreReady()) {
    try {
      // Find similar sessions in vector store using the seed's embedding
      const similarRows = db.prepare(`
        SELECT id, distance FROM vec_embeddings 
        WHERE embedding MATCH (SELECT embedding FROM vec_embeddings WHERE id = ?)
        AND k = 5
      `).all(`bs:${seedSession.id}`) as { id: string, distance: number }[];
      
      for (const row of similarRows) {
        if (dormantSessions.length >= MAX_SESSIONS) break;
        const sessionId = row.id.startsWith('bs:') ? row.id.slice(3) : row.id;
        if (sessionId === seedSession.id) continue;
        
        const session = db.prepare('SELECT * FROM brainstorm_sessions WHERE id = ?').get(sessionId) as any;
        if (session) dormantSessions.push(session);
      }
    } catch (err) {
      logger.warn('Failed to perform vector search for idle processor:', err);
    }
  }

  // If not enough similar found, fill with random
  if (dormantSessions.length < MAX_SESSIONS) {
    const fillers = db.prepare(`
      SELECT * FROM brainstorm_sessions 
      WHERE status = 'distilled' AND id != ? AND updated_at < ?
      ORDER BY RANDOM() LIMIT ?
    `).all(seedSession.id, cutoffIso, MAX_SESSIONS - dormantSessions.length) as any[];
    dormantSessions.push(...fillers);
  }

  try {
    const inputParts = dormantSessions.map((session, index) => {
      const themes = JSON.parse(session.themes_json || '[]');
      const themesStr = Array.isArray(themes) ? themes.join(', ') : '';
      return `[灵感碎片 ${index + 1}]
核心内容预览: ${session.raw_input_preview}
相关主题: ${themesStr}
情绪基调: ${session.emotional_tone}`;
    });

    const combinedInput = inputParts.join('\n\n');
    const response = await callClaude(IDLE_PROMPT + "\n" + combinedInput, 512);
    
    const insight = response.trim();
    if (!insight) {
      logger.warn('AI returned empty insight for idle processing.');
      return;
    }

    const now = new Date().toISOString();
    // Use the first session's source note ID simply as an anchor
    const primarySession = dormantSessions[0];
    const sourceNoteId = primarySession.source_note_id;

    // A simpler reintegration ID format
    const reintegrationId = buildReintegrationIdDumb(sourceNoteId, Date.now().toString());

    upsertReintegrationRecord({
      workerTaskId: reintegrationId,
      sourceNoteId,
      soulActionId: null,
      taskType: 'openclaw_task',
      terminalStatus: 'succeeded',
      signalKind: 'openclaw_reintegration',
      target: 'derived_outputs',
      strength: 'medium',
      summary: '闲时思考跨维洞察',
      evidence: { insight: `【闲时思考跨维洞察】\n${insight}` },
      reviewStatus: 'pending_review'
    });

    // Update the sessions so they aren't repeatedly processed immediately
    for (const session of dormantSessions) {
      db.prepare(`UPDATE brainstorm_sessions SET updated_at = ? WHERE id = ?`).run(now, session.id);
    }
    
    logger.info(`Idle processing completed. Generated insight anchored at ${sourceNoteId} with ${dormantSessions.length} sessions.`);

  } catch (error) {
    logger.error('Failed to run idle processing:', error);
  }
}
