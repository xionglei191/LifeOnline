export const SUPPORTED_SOUL_ACTION_KINDS = ['extract_tasks', 'update_persona_snapshot'] as const;
export type SoulActionKind = typeof SUPPORTED_SOUL_ACTION_KINDS[number];

export const SUPPORTED_SOUL_ACTION_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type SoulActionStatus = typeof SUPPORTED_SOUL_ACTION_STATUSES[number];

export interface SoulAction {
  id: string;
  sourceNoteId: string;
  actionKind: SoulActionKind;
  status: SoulActionStatus;
  workerTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  resultSummary: string | null;
}
