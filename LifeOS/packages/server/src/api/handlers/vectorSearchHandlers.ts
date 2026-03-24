/**
 * Semantic Search API Handlers
 *
 * Provides semantic search over vectorized cognitive objects
 * (BrainstormSessions, ContinuityRecords, etc.)
 */
import type { Request, Response } from 'express';
import { getDb } from '../../db/client.js';
import { getEmbedding } from '../../ai/embedding.js';
import { searchSimilar, isVectorStoreReady } from '../../db/vectorStore.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('semanticSearch');

/**
 * GET /api/semantic-search?q=text&topK=5
 *
 * Generates an embedding for the query text and searches the vector store
 * for the most similar items. Returns enriched results sorted by semantic distance.
 */
export async function semanticSearchHandler(req: Request, res: Response) {
  const query = req.query.q as string;
  const topK = Math.min(Math.max(parseInt(req.query.topK as string) || 5, 1), 50);

  if (!query?.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  if (!isVectorStoreReady()) {
    return res.status(503).json({ error: 'Vector store is not initialized' });
  }

  try {
    // 1. Generate embedding for the search query
    const queryEmbedding = await getEmbedding(query.trim());

    // 2. Perform kNN search in the vector store
    const db = getDb();
    const results = searchSimilar(db, queryEmbedding, topK);

    // 3. Resolve IDs to actual objects
    // IDs are prefixed: 'bs:{id}' for BrainstormSession, 'cr:{id}' for ContinuityRecord
    const enrichedResults = results.map(r => {
      const [prefix, ...idParts] = r.id.split(':');
      const objectId = idParts.join(':');
      let objectType = 'unknown';
      let data: Record<string, unknown> | null = null;

      if (prefix === 'bs') {
        objectType = 'brainstorm_session';
        const row = db.prepare(`
          SELECT id, source_note_id, raw_input_preview, themes_json,
                 emotional_tone, distilled_insights_json, actionability,
                 status, created_at, updated_at
          FROM brainstorm_sessions WHERE id = ?
        `).get(objectId) as any;
        if (row) {
          data = {
            id: row.id,
            sourceNoteId: row.source_note_id,
            rawInputPreview: row.raw_input_preview,
            themes: JSON.parse(row.themes_json || '[]'),
            emotionalTone: row.emotional_tone,
            distilledInsights: JSON.parse(row.distilled_insights_json || '[]'),
            actionability: row.actionability,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }
      } else if (prefix === 'cr') {
        objectType = 'continuity_record';
        data = db.prepare('SELECT * FROM continuity_records WHERE id = ?').get(objectId) as any;
      }

      return {
        id: r.id,
        objectType,
        objectId,
        distance: r.distance,
        similarity: Math.max(0, 1 - r.distance / 2), // Normalized 0-1 score (heuristic)
        data,
      };
    }).filter(r => r.data !== null);

    res.json({
      query: query.trim(),
      topK,
      results: enrichedResults,
      total: enrichedResults.length,
    });
  } catch (error: any) {
    logger.error('Semantic search failed:', error);
    res.status(500).json({ error: error?.message || 'Semantic search failed' });
  }
}

// Backwards-compatible alias
export { semanticSearchHandler as vectorSearchHandler };
