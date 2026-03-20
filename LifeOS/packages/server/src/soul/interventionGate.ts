import type { SoulActionCandidate } from './soulActionGenerator.js';

export interface InterventionGateDecision {
  decision: 'queue_for_review' | 'observe_only';
  reason: string;
}

export function evaluateInterventionGate(candidate: SoulActionCandidate | null): InterventionGateDecision {
  if (!candidate?.sourceNoteId || !candidate.noteId) {
    return {
      decision: 'observe_only',
      reason: 'missing source note context for PR3 governance queue',
    };
  }

  return {
    decision: 'queue_for_review',
    reason: 'PR3 governance bridge requires review before dispatch',
  };
}
