/**
 * Persona-snapshot executor — updates the persona snapshot for a given note.
 */
import type { WorkerTask, WorkerTaskInputMap, WorkerTaskResultMap } from '@lifeos/shared';
import { getSoulActionByIdentityAndKind } from '../../soul/soulActions.js';
import { upsertPersonaSnapshot } from '../../soul/personaSnapshots.js';
import { getRequiredWorkerNote, getWorkerNoteTitle } from './shared.js';

function buildPersonaContentPreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 280);
}

export async function runUpdatePersonaSnapshot(
  task: WorkerTask<'update_persona_snapshot'>
): Promise<WorkerTaskResultMap['update_persona_snapshot']> {
  const input = task.input as WorkerTaskInputMap['update_persona_snapshot'];
  const note = getRequiredWorkerNote(input.noteId);
  const sourceNoteTitle = getWorkerNoteTitle(note);
  const contentPreview = buildPersonaContentPreview(note.content || '');
  const summary = contentPreview
    ? `已更新人格快照：${sourceNoteTitle}`
    : `已更新人格快照：${sourceNoteTitle}（原笔记内容为空）`;
  const action = task.sourceNoteId
    ? getSoulActionByIdentityAndKind({
      sourceNoteId: task.sourceNoteId,
      sourceReintegrationId: task.sourceReintegrationId ?? null,
      actionKind: 'update_persona_snapshot',
    })
    : null;

  const snapshot = upsertPersonaSnapshot({
    sourceNoteId: task.sourceNoteId ?? input.noteId,
    soulActionId: action?.id ?? null,
    workerTaskId: task.id,
    summary,
    snapshot: {
      sourceNoteTitle,
      summary,
      contentPreview,
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    title: `${sourceNoteTitle} 人格快照更新`,
    summary,
    sourceNoteTitle,
    snapshotId: snapshot.id,
    snapshot: snapshot.snapshot,
  };
}

export function summarizeUpdatePersonaSnapshotResult(result: WorkerTaskResultMap['update_persona_snapshot']): string {
  return result.summary;
}
