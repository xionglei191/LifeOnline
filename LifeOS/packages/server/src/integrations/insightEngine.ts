/**
 * Insight Engine — Error analytics and tracking for PhysicalActions.
 *
 * This module provides APIs to query and analyze failed physical actions
 * to help users and agents understand and resolve execution issues (e.g.,
 * API changes, expired credentials, or calendar conflicts).
 */

import { getDb } from '../db/client.js';
import type { PhysicalAction } from '@lifeos/shared';

export interface FailedActionInsight {
  id: string;
  type: string;
  title: string;
  errorMessage: string | null;
  executedAt: string | null;
  sourceNoteId: string | null;
}

export function getFailedPhysicalActions(limit = 20): FailedActionInsight[] {
  const db = getDb();
  const sql = `
    SELECT id, type, title, error_message, executed_at, source_note_id
    FROM physical_actions
    WHERE status = 'failed'
    ORDER BY executed_at DESC
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(limit) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    errorMessage: row.error_message as string | null,
    executedAt: row.executed_at as string | null,
    sourceNoteId: row.source_note_id as string | null,
  }));
}

export function getTopFailingActionTypes(): { type: string, errorCount: number }[] {
  const db = getDb();
  const sql = `
    SELECT type, COUNT(*) as errorCount
    FROM physical_actions
    WHERE status = 'failed'
    GROUP BY type
    ORDER BY errorCount DESC
  `;
  
  const rows = db.prepare(sql).all() as Array<{ type: string; errorCount: number }>;
  return rows.map(row => ({
    type: row.type,
    errorCount: row.errorCount
  }));
}

export interface ExecutionInsights {
  totalActions: number;
  failedActions: number;
  successRate: number;
  recentErrors: FailedActionInsight[];
  errorsByType: Record<string, number>;
}

export function getExecutionInsights(days = 7): ExecutionInsights {
  const db = getDb();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM physical_actions WHERE created_at >= ?').get(cutoffDate) as { count: number };
  const failedRow = db.prepare('SELECT COUNT(*) as count FROM physical_actions WHERE status = "failed" AND created_at >= ?').get(cutoffDate) as { count: number };

  const total = totalRow?.count || 0;
  const failed = failedRow?.count || 0;
  const successRate = total > 0 ? ((total - failed) / total) * 100 : 100;

  const errorsByType: Record<string, number> = {};
  getTopFailingActionTypes().forEach(t => { errorsByType[t.type] = t.errorCount; });

  return {
    totalActions: total,
    failedActions: failed,
    successRate: Math.round(successRate * 10) / 10,
    recentErrors: getFailedPhysicalActions(10),
    errorsByType,
  };
}
