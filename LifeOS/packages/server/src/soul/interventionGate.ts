import type { SoulActionCandidate } from './soulActionGenerator.js';

export interface InterventionGateDecision {
  decision: 'queue_for_review' | 'observe_only';
  reason: string;
}

export function evaluateInterventionGate(candidate: SoulActionCandidate | null): InterventionGateDecision {
  if (!candidate?.sourceNoteId || !candidate.noteId) {
    return {
      decision: 'observe_only',
      reason: 'missing source note context for governance queue',
    };
  }

  if (candidate.actionKind === 'extract_tasks') {
    return {
      decision: 'queue_for_review',
      reason: 'extract_tasks candidate requires review-backed dispatch',
    };
  }

  return {
    decision: 'queue_for_review',
    reason: 'persona snapshot candidate requires review-backed dispatch',
  };
}
