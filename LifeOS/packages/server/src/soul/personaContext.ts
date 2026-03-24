/**
 * personaContext.ts
 *
 * Builds a rich persona + reintegration context object for injecting into
 * cognitiveAnalyzer, enabling "history-aware" note analysis.
 */
import { getDb } from '../db/client.js';
import { getPersonaSnapshotBySourceNoteId } from './personaSnapshots.js';

export interface PersonaContextForAnalysis {
  personaSummary: string | null;
  recentReintegrationSummaries: string[];
}

/**
 * Query DB for the latest persona snapshot AND the most recent accepted
 * reintegration summaries to provide historical context for a note analysis.
 *
 * Returns both in a struct that cognitiveAnalyzer can consume.
 */
export function buildPersonaContextForNote(sourceNoteId: string): PersonaContextForAnalysis {
  // Persona snapshot for this specific note (null if none yet)
  const personaSnapshot = getPersonaSnapshotBySourceNoteId(sourceNoteId);

  // Also try to get any persona snapshot from any note (most recently updated)
  const latestPersonaRow = personaSnapshot
    ? null
    : (getDb().prepare(`
        SELECT summary FROM persona_snapshots
        ORDER BY updated_at DESC LIMIT 1
      `).get() as { summary: string } | undefined);

  const personaSummary = personaSnapshot?.summary ?? latestPersonaRow?.summary ?? null;

  // Most recent 3 accepted reintegration summaries (order by reviewed_at desc)
  const rows = getDb().prepare(`
    SELECT summary FROM reintegration_records
    WHERE review_status = 'accepted'
    ORDER BY reviewed_at DESC
    LIMIT 3
  `).all() as Array<{ summary: string }>;

  return {
    personaSummary,
    recentReintegrationSummaries: rows.map(r => r.summary),
  };
}
