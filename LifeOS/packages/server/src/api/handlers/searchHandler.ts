import type { Request, Response } from 'express';
import { hybridSearch } from '../../db/hybridSearch.js';
import { sendSuccess, sendError } from '../responseHelper.js';

/**
 * GET /api/search?q=query&topK=10
 * Unified search endpoint combining keyword (FTS5) and semantic (vector) search.
 */
export async function searchHandler(req: Request, res: Response) {
  const query = req.query.q as string;
  const topK = Math.min(Math.max(parseInt(req.query.topK as string) || 10, 1), 50);

  if (!query?.trim()) {
    return sendError(res, 'Query parameter "q" is required', 400);
  }

  try {
    const results = await hybridSearch(query.trim(), topK);
    sendSuccess(res, {
      query: query.trim(),
      topK,
      results,
      total: results.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Search failed';
    sendError(res, message);
  }
}
