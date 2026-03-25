/**
 * Webhook API Handlers — handles external service callbacks (e.g. OpenClaw async results)
 */
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../responseHelper.js';
import { getWorkerTask } from '../../workers/workerTasks.js';
import { persistOpenClawResult } from '../../workers/executors/openclawExecutor.js';
import { completeAsyncWorkerTask } from '../../workers/workerTasks.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('webhookHandlers');

export async function openclawCallbackHandler(req: Request, res: Response) {
  try {
    const { taskId, status, result } = req.body;

    if (!taskId) {
      return sendError(res, 'Missing taskId in webhook payload', 400);
    }

    const task = getWorkerTask(taskId);
    if (!task) {
      return sendError(res, `Task ${taskId} not found`, 404);
    }

    if (task.status !== 'running') {
      logger.warn(`Received webhook for task ${taskId} but it is in status: ${task.status}`);
      return sendSuccess(res, { message: 'Ignored, task is not running' });
    }

    if (status === 'failed') {
      // External service explicitly failed
      throw new Error(req.body.error || 'OpenClaw execution failed externally');
    }

    if (!result || typeof result.title !== 'string') {
      return sendError(res, 'Result payload missing required fields (title)', 400);
    }

    // Persist result (including copying any attachedFiles to Vault)
    const outputNotePaths = await persistOpenClawResult(task as never, result);

    // Complete the task and allow tryBestEffortReintegrateTerminalTask to run
    await completeAsyncWorkerTask(taskId, result, outputNotePaths);

    logger.info(`Successfully processed OpenClaw webhook for task ${taskId}`);
    sendSuccess(res, { message: 'Webhook processed successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to process openclaw webhook: ${message}`);
    // Do not leak internal stack traces, just return error
    sendError(res, message, 500);
  }
}
