import { getDb } from '../db/client.js';
import { callClaude } from '../ai/aiClient.js';
import { Logger } from '../utils/logger.js';
import { upsertReintegrationRecord } from './reintegrationRecords.js';

const logger = new Logger('idleProcessor');

const IDLE_DAYS = 7;
const MAX_SESSIONS = 3;

const IDLE_PROMPT = `你是一个跨领域关联引擎 (Idle-State Processor)，负责在用户没有主动输入时，对过去长久沉积的潜意识想法（BrainstormSession）进行重温和发散。
下面是几条用户在过去记录的想法，且最近没有被回顾过。

请阅读这些信息，尝试找到它们之间的潜在联系、深层矛盾或者共同的主旨，并生成一段全新的、有建设性的洞察（Insight）。
洞察必须以第一人称（代表用户的内省声音）来写，语气深刻且具有反思性。
不要写成机器人的总结，直接输出洞察的纯文本，不要有多余的格式或开场白。

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

  // Find dormant sessions
  const dormantSessions = db.prepare(`
    SELECT * FROM brainstorm_sessions 
    WHERE status = 'distilled' AND updated_at < ? 
    ORDER BY RANDOM() LIMIT ?
  `).all(cutoffIso, MAX_SESSIONS) as any[];

  if (dormantSessions.length === 0) {
    logger.info('No dormant BrainstormSessions found for processing.');
    return;
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
