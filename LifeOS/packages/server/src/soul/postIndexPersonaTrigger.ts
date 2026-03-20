import { getDb } from '../db/client.js';
import { generateSoulActionCandidate } from './soulActionGenerator.js';
import { evaluateInterventionGate } from './interventionGate.js';
import { dispatchSoulActionCandidate } from './soulActionDispatcher.js';

interface IndexedNoteSnapshot {
  id: string;
  type: string;
  dimension: string;
  content: string;
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
}): Promise<void> {
  const currentNote = readIndexedNoteByFilePath(params.filePath);
  if (!shouldTriggerPersonaSnapshot(params.previousNote, currentNote)) {
    return;
  }

  const candidate = generateSoulActionCandidate({
    sourceNoteId: currentNote.id,
    noteId: currentNote.id,
    noteContent: currentNote.content,
  });
  const gateDecision = evaluateInterventionGate(candidate);

  if (!candidate || gateDecision.decision !== 'dispatch_now') {
    return;
  }

  await dispatchSoulActionCandidate(candidate, gateDecision);
}
