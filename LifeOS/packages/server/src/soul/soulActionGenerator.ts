import type { SoulActionKind } from './types.js';

export interface SoulActionCandidate {
  sourceNoteId: string;
  actionKind: SoulActionKind;
  noteId: string;
}

export function generateSoulActionCandidate(input: {
  sourceNoteId?: string | null;
  noteId: string;
  noteContent?: string | null;
}): SoulActionCandidate | null {
  if (!input.sourceNoteId) {
    return null;
  }

  if (!input.noteContent?.trim()) {
    return null;
  }

  return {
    sourceNoteId: input.sourceNoteId,
    actionKind: 'update_persona_snapshot',
    noteId: input.noteId,
  };
}
