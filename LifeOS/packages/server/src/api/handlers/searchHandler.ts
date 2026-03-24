import type { Request, Response } from 'express';
import { hybridSearch } from '../../db/hybridSearch.js';

/**
 * GET /api/search?q=query&topK=10
 * Unified search endpoint combining keyword (FTS5) and semantic (vector) search.
 */
export async function searchHandler(req: Request, res: Response) {
  const query = req.query.q as string;
  const topK = Math.min(Math.max(parseInt(req.query.topK as string) || 10, 1), 50);

  if (!query?.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const results = await hybridSearch(query.trim(), topK);
    res.json({
      query: query.trim(),
      topK,
      results,
      total: results.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Search failed' });
  }
}
