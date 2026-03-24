/**
 * Insight Handlers — expose InsightEngine analytics via HTTP.
 */
import type { Request, Response } from 'express';
import { getFailedPhysicalActions, getTopFailingActionTypes } from '../../integrations/insightEngine.js';
import { listPhysicalActions } from '../../integrations/executionEngine.js';
import { getAllBreakerStates } from '../../integrations/circuitBreaker.js';

export function getFailedActionsHandler(_req: Request, res: Response) {
  const limit = parseInt(_req.query.limit as string) || 20;
  const actions = getFailedPhysicalActions(limit);
  res.json({ actions, total: actions.length });
}

export function getTopFailingTypesHandler(_req: Request, res: Response) {
  const types = getTopFailingActionTypes();
  res.json({ types });
}

export function getInsightStatsHandler(_req: Request, res: Response) {
  const all = listPhysicalActions(undefined, 1000);
  const total = all.length;
  const completed = all.filter(a => a.status === 'completed').length;
  const failed = all.filter(a => a.status === 'failed').length;
  const rejected = all.filter(a => a.status === 'rejected').length;
  const pending = all.filter(a => a.status === 'pending').length;

  res.json({
    stats: {
      total,
      completed,
      failed,
      rejected,
      pending,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      failRate: total > 0 ? Math.round((failed / total) * 100) : 0,
    }
  });
}

export function getBreakerStatesHandler(_req: Request, res: Response) {
  const breakers = getAllBreakerStates();
  res.json({ breakers });
}
