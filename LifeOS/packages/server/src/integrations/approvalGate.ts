import type { PhysicalActionType, PhysicalActionStatus } from '@lifeos/shared';
import { getDb } from '../db/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('approvalGate');

// We simulate a config table for user preferences. 
// In a real Phase 3 setup, this would be backed by `user_preferences` or similar table.
export type ApprovalPolicy = 'always_ask' | 'auto_after_first' | 'auto_approve';

export function getApprovalPolicy(actionType: PhysicalActionType): ApprovalPolicy {
  try {
    const db = getDb();
    // Assuming a config key like `approval_policy_${actionType}`
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(`approval_policy_${actionType}`) as { value: string } | undefined;
    if (row && (row.value === 'always_ask' || row.value === 'auto_after_first' || row.value === 'auto_approve')) {
      return row.value as ApprovalPolicy;
    }
  } catch (error) {
    logger.warn(`Failed to get approval policy for ${actionType}, defaulting to 'always_ask'`, error);
  }
  return 'always_ask';
}

export function setApprovalPolicy(actionType: PhysicalActionType, policy: ApprovalPolicy): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO config (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(`approval_policy_${actionType}`, policy);
    logger.info(`Set approval policy for ${actionType} to ${policy}`);
  } catch (error) {
    logger.error(`Failed to set approval policy for ${actionType}:`, error);
  }
}

/**
 * Checks the policy and historical executions to decide the initial status of a new PhysicalAction.
 * If 'always_ask', it returns 'pending'.
 * If 'auto_approve', it returns 'approved'.
 * If 'auto_after_first', we check if there are any previously approved actions of this type.
 */
export function evaluateActionStatus(actionType: PhysicalActionType): PhysicalActionStatus {
  const policy = getApprovalPolicy(actionType);
  if (policy === 'auto_approve') {
    return 'approved';
  }
  
  if (policy === 'auto_after_first') {
    try {
      const db = getDb();
      // Look for any past approved/completed physical actions of this type
      const count = db.prepare(`
        SELECT COUNT(*) as count 
        FROM physical_actions 
        WHERE type = ? AND status IN ('approved', 'executing', 'completed')
      `).get(actionType) as { count: number };
      
      if (count && count.count > 0) {
        return 'approved';
      }
    } catch (error) {
       // Table might not exist yet if C-Group hasn't migrated DB
       logger.warn(`Could not check historical actions for ${actionType}, surfacing as pending.`, String(error));
    }
  }

  // Fallback to pending
  return 'pending';
}
