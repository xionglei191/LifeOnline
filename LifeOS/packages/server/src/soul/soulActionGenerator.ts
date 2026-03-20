import type { SoulActionKind } from './types.js';

export interface SoulActionCandidate {
  sourceNoteId: string;
  actionKind: SoulActionKind;
  noteId: string;
  trigger: 'post_index_growth_note' | 'manual_extract_tasks_request';
}

export function generateSoulActionCandidate(input: {
  sourceNoteId?: string | null;
  noteId: string;
  noteContent?: string | null;
  preferredActionKind?: Extract<SoulActionKind, 'update_persona_snapshot' | 'extract_tasks'>;
}): SoulActionCandidate | null {
  if (!input.sourceNoteId) {
    return null;
  }

  if (!input.noteContent?.trim()) {
    return null;
  }

  return {
    sourceNoteId: input.sourceNoteId,
    actionKind: input.preferredActionKind ?? 'update_persona_snapshot',
    noteId: input.noteId,
    trigger: input.preferredActionKind === 'extract_tasks'
      ? 'manual_extract_tasks_request'
      : 'post_index_growth_note',
  };
}
