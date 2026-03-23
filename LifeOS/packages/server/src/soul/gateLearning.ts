import { getDb } from '../db/client.js';

// ── Types ──────────────────────────────────────────────

export type GateDecisionOutcome = 'approved' | 'deferred' | 'discarded';

export interface GateStats {
  totalDecisions: number;
  approveCount: number;
  deferCount: number;
  discardCount: number;
  approveRate: number;   // 0-1
  recentApproveRate: number; // 0-1, based on last 10 decisions
}

interface GateDecisionRow {
  id: number;
  action_kind: string;
  decision: string;
  created_at: string;
}

// ── Table Management ───────────────────────────────────

export function ensureGateDecisionsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS gate_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_kind TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('approved', 'deferred', 'discarded')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gate_decisions_action_kind ON gate_decisions(action_kind);
    CREATE INDEX IF NOT EXISTS idx_gate_decisions_created_at ON gate_decisions(created_at);
  `);
}

// ── Record a Decision ──────────────────────────────────

export function recordGateOutcome(actionKind: string, decision: GateDecisionOutcome): void {
  try {
    ensureGateDecisionsTable();
    const db = getDb();
    db.prepare(`
      INSERT INTO gate_decisions (action_kind, decision, created_at)
      VALUES (?, ?, ?)
    `).run(actionKind, decision, new Date().toISOString());
  } catch (error) {
    console.warn('[gateLearning] Failed to record gate outcome:', error);
  }
}

// ── Query Stats ────────────────────────────────────────

const DEFAULT_STATS: GateStats = {
  totalDecisions: 0,
  approveCount: 0,
  deferCount: 0,
  discardCount: 0,
  approveRate: 0,
  recentApproveRate: 0,
};

export function getGateStats(actionKind: string): GateStats {
  try {
    ensureGateDecisionsTable();
    const db = getDb();

    // Total counts by decision type
    const allRows = db.prepare(`
      SELECT decision, COUNT(*) as count
      FROM gate_decisions
      WHERE action_kind = ?
      GROUP BY decision
    `).all(actionKind) as Array<{ decision: string; count: number }>;

    if (allRows.length === 0) {
      return { ...DEFAULT_STATS };
    }

    const counts: Record<string, number> = {};
    for (const row of allRows) {
      counts[row.decision] = row.count;
    }

    const approveCount = counts['approved'] ?? 0;
    const deferCount = counts['deferred'] ?? 0;
    const discardCount = counts['discarded'] ?? 0;
    const totalDecisions = approveCount + deferCount + discardCount;

    // Recent trend (last 10 decisions)
    const recentRows = db.prepare(`
      SELECT decision
      FROM gate_decisions
      WHERE action_kind = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(actionKind) as Array<{ decision: string }>;

    const recentApproveCount = recentRows.filter(r => r.decision === 'approved').length;
    const recentTotal = recentRows.length;

    return {
      totalDecisions,
      approveCount,
      deferCount,
      discardCount,
      approveRate: totalDecisions > 0 ? approveCount / totalDecisions : 0,
      recentApproveRate: recentTotal > 0 ? recentApproveCount / recentTotal : 0,
    };
  } catch (error) {
    console.warn('[gateLearning] Failed to get gate stats:', error);
    return { ...DEFAULT_STATS };
  }
}

// ── Confidence Adjustment ──────────────────────────────

/**
 * Adjust a candidate's confidence based on historical gate outcomes.
 * 
 * If a particular action kind is frequently approved, boost confidence.
 * If frequently rejected/discarded, reduce it.
 * 
 * This is the "记录优先于放权，但逐步放权" mechanism.
 */
export function adjustConfidenceByHistory(
  actionKind: string,
  baseConfidence: number,
): { adjustedConfidence: number; reason: string } {
  const stats = getGateStats(actionKind);

  // Not enough history — no adjustment
  if (stats.totalDecisions < 5) {
    return {
      adjustedConfidence: baseConfidence,
      reason: `历史决策不足 (${stats.totalDecisions}/5)，不调整`,
    };
  }

  // High approve rate → boost confidence
  if (stats.recentApproveRate >= 0.8 && stats.approveRate >= 0.7) {
    const boost = Math.min(0.2, (stats.recentApproveRate - 0.7) * 0.5);
    return {
      adjustedConfidence: Math.min(1, baseConfidence + boost),
      reason: `历史 approve 率 ${(stats.approveRate * 100).toFixed(0)}%，近期 ${(stats.recentApproveRate * 100).toFixed(0)}%，提升置信 +${(boost * 100).toFixed(0)}%`,
    };
  }

  // High discard rate → reduce confidence
  if (stats.discardCount / stats.totalDecisions >= 0.4) {
    const penalty = Math.min(0.2, (stats.discardCount / stats.totalDecisions - 0.3) * 0.5);
    return {
      adjustedConfidence: Math.max(0, baseConfidence - penalty),
      reason: `discard 率 ${((stats.discardCount / stats.totalDecisions) * 100).toFixed(0)}%，降低置信 -${(penalty * 100).toFixed(0)}%`,
    };
  }

  return {
    adjustedConfidence: baseConfidence,
    reason: `approve 率 ${(stats.approveRate * 100).toFixed(0)}%，在正常范围内`,
  };
}
