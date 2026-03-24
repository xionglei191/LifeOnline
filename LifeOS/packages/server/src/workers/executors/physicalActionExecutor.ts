import type { WorkerTask } from '@lifeos/shared';
import { executeAction, getPhysicalAction } from '../../integrations/executionEngine.js';
import { archiveExecutionResult } from '../../integrations/executionArchiver.js';
import { recordFailure, recordSuccess } from '../../integrations/circuitBreaker.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('physicalActionExecutor');

export async function runPhysicalActionExecutor(
  task: WorkerTask<'execute_physical_action'>,
  _signal?: AbortSignal
): Promise<{ actionId: string; title: string; success: boolean }> {
  const { actionId } = task.input;
  logger.info(`Starting async physical action execution for action: ${actionId}`);

  const physicalAction = getPhysicalAction(actionId);
  if (!physicalAction) {
    throw new Error(`PhysicalAction not found: ${actionId}`);
  }

  // Double check status. If it's already completed or failed, we might skip or retry.
  if (physicalAction.status !== 'approved' && physicalAction.status !== 'pending' && physicalAction.status !== 'executing') {
    throw new Error(`Cannot execute action ${actionId} in status: ${physicalAction.status}`);
  }

  // Execute the underlying protocol (this updates the action state internally)
  const resultAction = await executeAction(actionId);

  // Archive the execution result to R2 cold storage (best-effort)
  archiveExecutionResult(resultAction).catch(err =>
    logger.warn(`Non-critical: archival failed for ${actionId}:`, err)
  );

  if (resultAction.status === 'failed') {
    recordFailure(resultAction.type);
    // We throw here so the worker framework knows it failed and marks the WorkerTask as 'failed'.
    throw new Error(`Execution failed: ${resultAction.errorMessage || 'Unknown error'}`);
  }

  recordSuccess(resultAction.type);

  return {
    actionId: resultAction.id,
    title: resultAction.title,
    success: resultAction.status === 'completed'
  };
}

export function summarizePhysicalActionResult(result: { actionId: string; title: string; success: boolean }): string {
  if (result.success) {
    return `成功执行物理动作: ${result.title}`;
  }
  return `未能执行物理动作: ${result.title}`;
}

export async function persistPhysicalActionResult(
  _task: WorkerTask<'execute_physical_action'>,
  _result: { actionId: string; title: string; success: boolean }
): Promise<string[]> {
  // We don't output new notes to the vault from a physical action execution.
  // The state is kept in the physical_actions table.
  return [];
}
