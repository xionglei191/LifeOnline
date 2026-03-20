import type { SoulActionCandidate } from './soulActionGenerator.js';

export interface InterventionGateDecision {
  decision: 'dispatch_now' | 'observe_only';
  reason: string;
}

export function evaluateInterventionGate(candidate: SoulActionCandidate | null): InterventionGateDecision {
  if (!candidate?.sourceNoteId || !candidate.noteId) {
    return {
      decision: 'observe_only',
      reason: 'missing source note context for update_persona_snapshot',
    };
  }

  return {
    decision: 'dispatch_now',
    reason: 'low-risk persona snapshot update can run immediately',
  };
}
