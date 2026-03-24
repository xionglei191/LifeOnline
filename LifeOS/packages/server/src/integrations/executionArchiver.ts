/**
 * Execution Archiver — persists PhysicalAction execution records to R2 cold storage.
 *
 * After each PhysicalAction reaches a terminal state (completed/failed),
 * the full action record is serialized to JSON and uploaded to R2.
 *
 * R2 Key format: execution-logs/{YYYY-MM}/{action.id}.json
 */
import { isR2Configured, uploadToR2 } from '../infra/r2Client.js';
import { Logger } from '../utils/logger.js';
import type { PhysicalAction } from '@lifeos/shared';

const logger = new Logger('executionArchiver');

export interface ArchivedExecutionRecord {
  action: PhysicalAction;
  archivedAt: string;
  archiveVersion: number;
}

/**
 * Archive a completed/failed PhysicalAction to R2 cold storage.
 * Silently skips if R2 is not configured — archival is best-effort.
 */
export async function archiveExecutionResult(action: PhysicalAction): Promise<boolean> {
  if (!isR2Configured()) {
    logger.debug('R2 not configured, skipping execution archival');
    return false;
  }

  const terminalStatuses = ['completed', 'failed', 'rejected'];
  if (!terminalStatuses.includes(action.status)) {
    logger.warn(`Skipping archival for non-terminal action ${action.id} (status: ${action.status})`);
    return false;
  }

  try {
    const record: ArchivedExecutionRecord = {
      action,
      archivedAt: new Date().toISOString(),
      archiveVersion: 1,
    };

    const datePrefix = getMonthPrefix(action.executedAt || action.updatedAt);
    const key = `execution-logs/${datePrefix}/${action.id}.json`;

    await uploadToR2(key, JSON.stringify(record, null, 2));
    logger.info(`Archived execution: ${action.id} → ${key}`);
    return true;
  } catch (err: any) {
    logger.error(`Failed to archive execution ${action.id}:`, err);
    return false;
  }
}

function getMonthPrefix(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
