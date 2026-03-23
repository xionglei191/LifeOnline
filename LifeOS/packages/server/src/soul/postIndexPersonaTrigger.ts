import { getDb } from '../db/client.js';
import { generateSoulActionCandidates, type SoulActionCandidate } from './soulActionGenerator.js';
import { evaluateInterventionGate, type GateDecisionType } from './interventionGate.js';
import { createOrReuseSoulAction } from './soulActions.js';

interface IndexedNoteSnapshot {
  id: string;
  type: string;
  dimension: string;
  content: string;
}

export interface PostIndexTriggerResult {
  triggered: boolean;
  reason: string;
  soulActionIds: string[];
  candidateCount: number;
}

interface IndexedNoteRow {
  id: string;
  file_path: string;
  type: string;
  dimension: string;
  content: string | null;
}

function readIndexedNoteByFilePath(filePath: string): IndexedNoteSnapshot | null {
  const row = getDb()
    .prepare('SELECT id, file_path, type, dimension, content FROM notes WHERE file_path = ?')
    .get(filePath) as IndexedNoteRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    type: row.type,
    dimension: row.dimension,
    content: row.content ?? '',
  };
}

export function getIndexedNoteTriggerSnapshot(filePath: string): IndexedNoteSnapshot | null {
  return readIndexedNoteByFilePath(filePath);
}

/**
 * Determine if this note should be analyzed at all.
 * 
 * Previously: hardcoded to only growth-dimension notes.
 * Now: any note with changed content goes through cognitive analysis,
 * which decides what actions to suggest.
 */
function shouldAnalyze(
  previousNote: IndexedNoteSnapshot | null,
  currentNote: IndexedNoteSnapshot | null,
): currentNote is IndexedNoteSnapshot {
  if (!currentNote) return false;
  if (currentNote.type !== 'note') return false;
  if (!currentNote.content.trim()) return false;
  // Only analyze if content actually changed
  if (previousNote && previousNote.content === currentNote.content) return false;
  return true;
}

/**
 * After a note is indexed, run it through the cognitive pipeline:
 * 1. Cognitive analysis (AI or rules) extracts structured signals
 * 2. Smart generator produces ranked action candidates
 * 3. Intervention gate decides each candidate's fate
 * 4. Qualifying candidates become soul actions
 */
export async function triggerCognitiveAnalysisAfterIndex(params: {
  filePath: string;
  previousNote: IndexedNoteSnapshot | null;
}): Promise<PostIndexTriggerResult> {
  const currentNote = readIndexedNoteByFilePath(params.filePath);

  if (!shouldAnalyze(params.previousNote, currentNote)) {
    return {
      triggered: false,
      reason: 'note does not qualify for cognitive analysis',
      soulActionIds: [],
      candidateCount: 0,
    };
  }

  // Run through the cognitive pipeline
  const { candidates, analysis, skippedReason } = await generateSoulActionCandidates({
    sourceNoteId: currentNote.id,
    noteId: currentNote.id,
    noteContent: currentNote.content,
    noteDimension: currentNote.dimension,
    noteType: currentNote.type,
  });

  if (candidates.length === 0) {
    return {
      triggered: false,
      reason: skippedReason ?? '认知分析未产生候选动作',
      soulActionIds: [],
      candidateCount: 0,
    };
  }

  // Evaluate each candidate through the gate
  const soulActionIds: string[] = [];

  for (const candidate of candidates) {
    const gateDecision = evaluateInterventionGate(candidate);

    if (gateDecision.decision === 'discard' || gateDecision.decision === 'observe_only') {
      continue;
    }

    // dispatch_now or queue_for_review → create soul action
    const soulAction = createOrReuseSoulAction({
      sourceNoteId: candidate.sourceNoteId,
      actionKind: candidate.actionKind,
      governanceReason: `${gateDecision.reason} [置信度: ${(candidate.confidence * 100).toFixed(0)}%]`,
    });

    soulActionIds.push(soulAction.id);
  }

  return {
    triggered: soulActionIds.length > 0,
    reason: soulActionIds.length > 0
      ? `认知分析产生 ${candidates.length} 个候选，${soulActionIds.length} 个通过门控`
      : `认知分析产生 ${candidates.length} 个候选，但均未通过门控`,
    soulActionIds,
    candidateCount: candidates.length,
  };
}

// ── Legacy compat alias (will be removed) ──────────────
/** @deprecated Use triggerCognitiveAnalysisAfterIndex instead */
export const triggerPersonaSnapshotAfterIndex = triggerCognitiveAnalysisAfterIndex;
export type PostIndexPersonaTriggerResult = PostIndexTriggerResult;
