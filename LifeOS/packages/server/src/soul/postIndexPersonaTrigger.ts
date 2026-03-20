import { getDb } from '../db/client.js';
import { generateSoulActionCandidate } from './soulActionGenerator.js';
import { evaluateInterventionGate } from './interventionGate.js';
import { createOrReuseSoulAction } from './soulActions.js';

interface IndexedNoteSnapshot {
  id: string;
  type: string;
  dimension: string;
  content: string;
}

export interface PostIndexPersonaTriggerResult {
  triggered: boolean;
  reason: string;
  soulActionId: string | null;
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

  if (!row) {
    return null;
  }

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

function shouldTriggerPersonaSnapshot(
  previousNote: IndexedNoteSnapshot | null,
  currentNote: IndexedNoteSnapshot | null,
): currentNote is IndexedNoteSnapshot {
  if (!currentNote) return false;
  if (currentNote.type !== 'note') return false;
  if (currentNote.dimension !== 'growth') return false;
  if (!currentNote.content.trim()) return false;
  if (!previousNote) return true;
  return previousNote.content !== currentNote.content;
}

export async function triggerPersonaSnapshotAfterIndex(params: {
  filePath: string;
  previousNote: IndexedNoteSnapshot | null;
}): Promise<PostIndexPersonaTriggerResult> {
  const currentNote = readIndexedNoteByFilePath(params.filePath);
  if (!shouldTriggerPersonaSnapshot(params.previousNote, currentNote)) {
    return {
      triggered: false,
      reason: 'current note does not match PR3 persona snapshot review baseline',
      soulActionId: null,
    };
  }

  const candidate = generateSoulActionCandidate({
    sourceNoteId: currentNote.id,
    noteId: currentNote.id,
    noteContent: currentNote.content,
  });
  const gateDecision = evaluateInterventionGate(candidate);

  if (!candidate) {
    return {
      triggered: false,
      reason: 'candidate generation returned null for PR3 persona snapshot review baseline',
      soulActionId: null,
    };
  }

  if (gateDecision.decision !== 'queue_for_review') {
    return {
      triggered: false,
      reason: gateDecision.reason,
      soulActionId: null,
    };
  }

  const soulAction = createOrReuseSoulAction({
    sourceNoteId: candidate.sourceNoteId,
    actionKind: candidate.actionKind,
    governanceReason: gateDecision.reason,
  });

  return {
    triggered: true,
    reason: gateDecision.reason,
    soulActionId: soulAction.id,
  };
}
