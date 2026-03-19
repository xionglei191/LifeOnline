import matter from 'gray-matter';
import type { ClassifyResult } from '../ai/classifier.js';
import type { ExtractedTask } from '../ai/taskExtractor.js';

export function buildClassifiedFrontmatter(
  original: Record<string, unknown>,
  result: ClassifyResult,
  source = 'auto'
): Record<string, unknown> {
  const now = new Date().toISOString();
  const merged: Record<string, unknown> = {
    ...original,
    type: result.type,
    dimension: result.dimension,
    status: original.status || 'pending',
    priority: result.priority,
    privacy: original.privacy || 'private',
    source,
    updated: now,
  };
  if (result.tags && result.tags.length > 0) merged.tags = result.tags;
  // Remove undefined values - gray-matter can't serialize them
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
}

export function buildTaskFrontmatter(task: ExtractedTask, date: string): string {
  const now = new Date().toISOString();
  const data: Record<string, unknown> = {
    type: 'task',
    dimension: task.dimension,
    status: 'pending',
    priority: task.priority,
    date,
    source: 'auto',
    created: now,
    updated: now,
  };
  if (task.due) data.due = task.due;
  return matter.stringify(`\n# ${task.title}\n`, data);
}

export function buildWorkerResultFrontmatter(input: {
  title: string;
  dimension: string;
  type?: string;
  date: string;
  tags?: string[];
  taskId: string;
  sourceNoteId?: string | null;
  source?: string;
  worker?: string;
  workerTaskType?: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  const data: Record<string, unknown> = {
    type: input.type || 'note',
    dimension: input.dimension,
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: input.date,
    source: input.source || 'openclaw',
    created: now,
    updated: now,
    worker_task_id: input.taskId,
    worker: input.worker || 'openclaw',
    worker_task_type: input.workerTaskType || 'openclaw_task',
  };
  if (input.tags?.length) data.tags = input.tags;
  if (input.sourceNoteId) data.source_note_id = input.sourceNoteId;
  return data;
}
