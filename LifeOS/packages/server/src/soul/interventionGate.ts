import type { SoulActionCandidate } from './soulActionGenerator.js';
import { getGateStats, detectGatePatterns, adjustConfidenceByHistory } from './gateLearning.js';

// ── Types ──────────────────────────────────────────────

export type GateDecisionType = 'dispatch_now' | 'queue_for_review' | 'observe_only' | 'discard';

export interface InterventionGateDecision {
  decision: GateDecisionType;
  reason: string;
  confidence: number;  // passed through from candidate
}

// ── Configuration ──────────────────────────────────────

const GATE_CONFIG = {
  // Minimum confidence to allow auto-dispatch (bypassing review)
  autoDispatchMinConfidence: 0.85,

  // Minimum historical decisions needed before allowing auto-dispatch
  autoDispatchMinHistory: 10,

  // Minimum historical approve rate for auto-dispatch
  autoDispatchMinApproveRate: 0.8,

  // Below this confidence, mark as observe_only
  observeOnlyThreshold: 0.35,

  // Below this confidence, discard
  discardThreshold: 0.2,

  // Action kinds that are NEVER auto-dispatched (always require review)
  alwaysReviewKinds: ['create_event_node', 'promote_event_node', 'promote_continuity_record'] as string[],

  // Action kinds that are considered low-cost and reversible
  lowCostKinds: ['update_persona_snapshot'] as string[],
} as const;

// ── Core Gate Logic ────────────────────────────────────

/**
 * Evaluate whether a candidate should be dispatched, queued for review,
 * observed, or discarded.
 * 
 * Decision logic (in priority order):
 * 1. Missing context → observe_only
 * 2. Very low confidence → discard
 * 3. Low confidence → observe_only
 * 4. Promotion/irreversible actions → always queue_for_review
 * 5. High confidence + strong history + low-cost → dispatch_now
 * 6. Default → queue_for_review
 */
export function evaluateInterventionGate(candidate: SoulActionCandidate | null): InterventionGateDecision {
  // ── Guard: missing context
  if (!candidate?.sourceNoteId || !candidate.noteId) {
    return {
      decision: 'observe_only',
      reason: 'missing source note context for governance queue',
      confidence: 0,
    };
  }

  const rawConfidence = candidate.confidence ?? 0.6;
  const { adjustedConfidence: confidence, reason: adjustReason, patterns } = adjustConfidenceByHistory(
    candidate.actionKind,
    rawConfidence
  );

  const patternTexts = patterns.length > 0 ? ` [模式识别: ${patterns.map(p => p.description).join('; ')}]` : '';
  const adjText = Math.abs(rawConfidence - confidence) > 0.01
    ? `(Gate 历史调整: 原 ${(rawConfidence * 100).toFixed(0)}% -> 现 ${(confidence * 100).toFixed(0)}%, 理由: ${adjustReason}${patternTexts})`
    : '';

  // ── Very low confidence → discard
  if (confidence < GATE_CONFIG.discardThreshold) {
    return {
      decision: 'discard',
      reason: `置信度过低 (${(confidence * 100).toFixed(0)}% < ${GATE_CONFIG.discardThreshold * 100}%)，自动丢弃。${adjText}`,
      confidence,
    };
  }

  // ── Low confidence → observe only
  if (confidence < GATE_CONFIG.observeOnlyThreshold) {
    return {
      decision: 'observe_only',
      reason: `置信度较低 (${(confidence * 100).toFixed(0)}% < ${GATE_CONFIG.observeOnlyThreshold * 100}%)，仅观察不入队。${adjText}`,
      confidence,
    };
  }

  // ── Irreversible/high-stakes actions → always review
  if (GATE_CONFIG.alwaysReviewKinds.includes(candidate.actionKind)) {
    return {
      decision: 'queue_for_review',
      reason: buildQueueReason(candidate, confidence, `${candidate.actionKind} 是不可逆的高影响操作，必须人工审批。${adjText}`),
      confidence,
    };
  }

  // ── Check if auto-dispatch is warranted
  if (confidence >= GATE_CONFIG.autoDispatchMinConfidence
    && GATE_CONFIG.lowCostKinds.includes(candidate.actionKind)) {
    const stats = getGateStats(candidate.actionKind);
    const patterns = detectGatePatterns(candidate.actionKind);
    
    // We can also leverage patterns for auto-dispatch here. For example if there is a strong consecutive discarded streak, we might want to block auto-dispatch.
    const hasNegativeStreak = patterns.some(p => p.patternType === 'consecutive_streak' && p.influence < 0);

    if (stats.totalDecisions >= GATE_CONFIG.autoDispatchMinHistory
      && stats.recentApproveRate >= GATE_CONFIG.autoDispatchMinApproveRate
      && !hasNegativeStreak) {
      
      return {
        decision: 'dispatch_now',
        reason: `高置信 (${(confidence * 100).toFixed(0)}%) + 低成本可逆操作 + 历史 approve 率 ${(stats.recentApproveRate * 100).toFixed(0)}% (${stats.totalDecisions} 次决策)，自动放行。${adjText}`,
        confidence,
      };
    }
  }

  // ── Default: queue for review
  return {
    decision: 'queue_for_review',
    reason: buildQueueReason(candidate, confidence, `需要人工审批。${adjText}`),
    confidence,
  };
}

// ── Helpers ────────────────────────────────────────────

function buildQueueReason(candidate: SoulActionCandidate, confidence: number, suffix: string): string {
  const parts: string[] = [];

  if (candidate.trigger === 'cognitive_analysis') {
    parts.push(`认知分析建议 ${candidate.actionKind}`);
  } else if (candidate.trigger === 'manual_extract_tasks_request') {
    parts.push('手动提取任务请求');
  } else {
    parts.push(`${candidate.actionKind} 候选`);
  }

  parts.push(`置信度 ${(confidence * 100).toFixed(0)}%`);

  if (candidate.analysisReason) {
    parts.push(candidate.analysisReason);
  }

  return parts.join('，') + '，' + suffix;
}
