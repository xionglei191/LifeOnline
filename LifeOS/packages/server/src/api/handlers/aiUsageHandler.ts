import type { Request, Response } from 'express';
import { getAiUsageReport } from '../../ai/usageTracker.js';

/**
 * GET /api/ai-usage?days=7
 * Returns daily aggregated AI token usage cost reports.
 */
export function getAiUsageHandler(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const report = getAiUsageReport(days);
    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch AI usage report' });
  }
}
