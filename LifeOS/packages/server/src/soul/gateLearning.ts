import { getDb } from '../db/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('gateLearning');

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

export interface GatePattern {
  patternType: 'time_trend' | 'context_correlation' | 'consecutive_streak';
  description: string;
  influence: number; // -0.2 to +0.2
}

interface GateDecisionRow {
  id: number;
  action_kind: string;
  decision: string;
  created_at: string;
}

// ── Record a Decision ──────────────────────────────────

export function recordGateOutcome(actionKind: string, decision: GateDecisionOutcome): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO gate_decisions (action_kind, decision, created_at)
      VALUES (?, ?, ?)
    `).run(actionKind, decision, new Date().toISOString());
  } catch (error) {
    logger.warn('Failed to record gate outcome:', error);
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
    logger.warn('Failed to get gate stats:', error);
    return { ...DEFAULT_STATS };
  }
}

// ── Pattern Detection ──────────────────────────────────

export function detectGatePatterns(actionKind: string): GatePattern[] {
  const patterns: GatePattern[] = [];
  const stats = getGateStats(actionKind);

  if (stats.totalDecisions < 5) {
    return patterns;
  }

  // 1. Time trend (time_trend)
  // Compare recent approve rate (last 10) against all-time approve rate.
  if (stats.recentApproveRate > stats.approveRate + 0.2) {
    patterns.push({
      patternType: 'time_trend',
      description: `近期对 ${actionKind} 的接受度显著上升 (${(stats.approveRate * 100).toFixed(0)}% -> ${(stats.recentApproveRate * 100).toFixed(0)}%)`,
      influence: 0.1,
    });
  } else if (stats.recentApproveRate < stats.approveRate - 0.2) {
    patterns.push({
      patternType: 'time_trend',
      description: `近期对 ${actionKind} 的接受度下降显著 (${(stats.approveRate * 100).toFixed(0)}% -> ${(stats.recentApproveRate * 100).toFixed(0)}%)`,
      influence: -0.1,
    });
  }

  // 2. Consecutive streak (consecutive_streak)
  try {
    const db = getDb();
    const recentDecisions = db.prepare(`
      SELECT decision
      FROM gate_decisions
      WHERE action_kind = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(actionKind) as Array<{ decision: string }>;

    let streak = 0;
    let currentDecision = recentDecisions[0]?.decision;

    for (const row of recentDecisions) {
      if (row.decision === currentDecision) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= 5 && currentDecision === 'approved') {
      patterns.push({
        patternType: 'consecutive_streak',
        description: `连续 ${streak} 次通过了 ${actionKind} 操作，形成稳定放权模式`,
        influence: 0.15,
      });
    } else if (streak >= 3 && currentDecision === 'discarded') {
      patterns.push({
        patternType: 'consecutive_streak',
        description: `连续 ${streak} 次手动丢弃了 ${actionKind} 操作，建议降低置信度`,
        influence: -0.15,
      });
    }
  } catch (error) {
    logger.warn('Failed to detect consecutive streaks:', error);
  }

  return patterns;
}

// ── Confidence Adjustment ──────────────────────────────

/**
 * Adjust a candidate's confidence based on historical gate outcomes.
 * 
 * If a particular action kind is frequently approved, boost confidence.
 * If frequently rejected/discarded, reduce it.
 * 
 * This is the "记录优先于放权，但逐步放权" mechanism, now enhanced with pattern reasoning.
 */
export function adjustConfidenceByHistory(
  actionKind: string,
  baseConfidence: number,
): { adjustedConfidence: number; reason: string; patterns: GatePattern[] } {
  const stats = getGateStats(actionKind);
  const patterns = detectGatePatterns(actionKind);
  
  // Calculate total pattern influence
  const patternInfluence = patterns.reduce((sum, p) => sum + p.influence, 0);

  // Not enough history — no adjustment
  if (stats.totalDecisions < 5) {
    return {
      adjustedConfidence: baseConfidence,
      reason: `历史决策不足 (${stats.totalDecisions}/5)，不调整`,
      patterns: [],
    };
  }

  // Base adjustments from statistical rates
  let statisticalAdjustment = 0;
  let statisticalReason = `approve 率 ${(stats.approveRate * 100).toFixed(0)}%，在正常范围内`;

  if (stats.recentApproveRate >= 0.8 && stats.approveRate >= 0.7) {
    statisticalAdjustment = Math.min(0.2, (stats.recentApproveRate - 0.7) * 0.5);
    statisticalReason = `历史 approve 率 ${(stats.approveRate * 100).toFixed(0)}%，近期 ${(stats.recentApproveRate * 100).toFixed(0)}%，基础置信调整 +${(statisticalAdjustment * 100).toFixed(0)}%`;
  } else if (stats.discardCount / stats.totalDecisions >= 0.4) {
    statisticalAdjustment = -Math.min(0.2, (stats.discardCount / stats.totalDecisions - 0.3) * 0.5);
    statisticalReason = `discard 率 ${((stats.discardCount / stats.totalDecisions) * 100).toFixed(0)}%，基础置信调整 ${(statisticalAdjustment * 100).toFixed(0)}%`;
  }

  // Combine statistical and pattern influences
  const totalAdjustment = statisticalAdjustment + patternInfluence;
  const clampedAdjustment = Math.max(-0.4, Math.min(0.4, totalAdjustment)); // Cap total adjustment to +/- 40%
  const finalConfidence = Math.max(0, Math.min(1, baseConfidence + clampedAdjustment));

  return {
    adjustedConfidence: finalConfidence,
    reason: statisticalReason,
    patterns,
  };
}

