// ── WebSocket Event Types ──────────────────────────────

import type { IndexResult, IndexOperation, IndexErrorEventData, Note } from './noteTypes.js';
import type { WorkerTask } from './workerTypes.js';
import type { SoulAction } from './soulActionTypes.js';
import type { EventNode, ContinuityRecord } from './projectionTypes.js';
import type { ReintegrationRecord } from './reintegrationTypes.js';

export interface NoteWorkerTasksUpdatedEventData {
  sourceNoteId: string;
  task: WorkerTask;
}

export interface NoteUpdatedEventData {
  noteId: string;
}

export interface NoteCreatedEventData {
  filePath: string;
}

export interface NoteDeletedEventData {
  noteId: string;
  filePath: string;
}

export interface EventNodeUpdatedEventData {
  eventNode: EventNode;
}

export interface ContinuityRecordUpdatedEventData {
  continuityRecord: ContinuityRecord;
}

export type WsEvent =
  | { type: 'file-changed'; data: { filePath: string; operation: IndexOperation } }
  | { type: 'index-complete'; data: IndexResult }
  | { type: 'index-queue-complete' }
  | { type: 'index-error'; data: IndexErrorEventData }
  | { type: 'worker-task-updated'; data: WorkerTask }
  | { type: 'note-worker-tasks-updated'; data: NoteWorkerTasksUpdatedEventData }
  | { type: 'note-updated'; data: NoteUpdatedEventData }
  | { type: 'note-created'; data: NoteCreatedEventData }
  | { type: 'note-deleted'; data: NoteDeletedEventData }
  | { type: 'soul-action-updated'; data: SoulAction }
  | { type: 'reintegration-record-updated'; data: ReintegrationRecord }
  | { type: 'event-node-updated'; data: EventNodeUpdatedEventData }
  | { type: 'continuity-record-updated'; data: ContinuityRecordUpdatedEventData }
  | { type: 'schedule-updated' };

export type WsEventType = WsEvent['type'];
