/**
 * PhysicalAction API Handlers — CRUD for physical actions.
 */
import type { Request, Response } from 'express';
import { listPhysicalActions, getPhysicalAction, approveAction, rejectAction } from '../../integrations/executionEngine.js';
import { sendSuccess, sendError } from '../responseHelper.js';

export function listPhysicalActionsHandler(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const actions = listPhysicalActions(status);
  sendSuccess(res, { actions, total: actions.length });
}

export function getPhysicalActionHandler(req: Request, res: Response) {
  const action = getPhysicalAction(req.params.id);
  if (!action) return sendError(res, 'PhysicalAction not found', 404);
  sendSuccess(res, { action });
}

export function approvePhysicalActionHandler(req: Request, res: Response) {
  const result = approveAction(req.params.id);
  if (!result) return sendError(res, 'Action not found or not in pending status', 400);
  sendSuccess(res, { action: result });
}

export function rejectPhysicalActionHandler(req: Request, res: Response) {
  const result = rejectAction(req.params.id);
  if (!result) return sendError(res, 'Action not found or not in pending status', 400);
  sendSuccess(res, { action: result });
}
