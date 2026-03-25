import type { Request, Response } from 'express';
import { getAiUsageReport } from '../../ai/usageTracker.js';
import { sendSuccess, sendError } from '../responseHelper.js';

/**
 * GET /api/ai-usage?days=7
 * Returns daily aggregated AI token usage cost reports.
 */
export function getAiUsageHandler(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const report = getAiUsageReport(days);
    sendSuccess(res, { report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch AI usage report';
    sendError(res, message);
  }
}
