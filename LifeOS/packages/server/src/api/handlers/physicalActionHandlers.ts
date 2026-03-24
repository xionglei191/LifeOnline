/**
 * PhysicalAction API Handlers — CRUD for physical actions.
 */
import type { Request, Response } from 'express';
import { listPhysicalActions, getPhysicalAction, approveAction, rejectAction } from '../../integrations/executionEngine.js';

export function listPhysicalActionsHandler(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const actions = listPhysicalActions(status);
  res.json({ actions, total: actions.length });
}

export function getPhysicalActionHandler(req: Request, res: Response) {
  const action = getPhysicalAction(req.params.id);
  if (!action) return res.status(404).json({ error: 'PhysicalAction not found' });
  res.json({ action });
}

export function approvePhysicalActionHandler(req: Request, res: Response) {
  const result = approveAction(req.params.id);
  if (!result) return res.status(400).json({ error: 'Action not found or not in pending status' });
  res.json({ action: result });
}

export function rejectPhysicalActionHandler(req: Request, res: Response) {
  const result = rejectAction(req.params.id);
  if (!result) return res.status(400).json({ error: 'Action not found or not in pending status' });
  res.json({ action: result });
}
