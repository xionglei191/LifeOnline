import type { WorkerTask } from '@lifeos/shared';
import { executeAction, getPhysicalAction } from '../../integrations/executionEngine.js';
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

  if (resultAction.status === 'failed') {
    // We throw here so the worker framework knows it failed and marks the WorkerTask as 'failed'.
    // The execution log/error message is already in physical_actions table.
    throw new Error(`Execution failed: ${resultAction.errorMessage || 'Unknown error'}`);
  }

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
