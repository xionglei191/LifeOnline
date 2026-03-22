import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { createWorkerTask, getWorkerTask, normalizeTaskInput, cancelWorkerTask, retryWorkerTask, executeWorkerTask } from '../src/workers/workerTasks.js';

test('normalizeTaskInput validates required fields and defaults', async () => {
  const env = await createTestEnv('lifeos-worker-normalize-');
  try {
    initDatabase();

    assert.throws(() => normalizeTaskInput({ taskType: 'openclaw_task', input: {} as never }), /instruction/);
    assert.throws(() => normalizeTaskInput({ taskType: 'summarize_note', input: {} as never }), /noteId/);
    assert.throws(() => normalizeTaskInput({ taskType: 'extract_tasks', input: {} as never }), /noteId/);
    assert.throws(() => normalizeTaskInput({ taskType: 'update_persona_snapshot', input: {} as never }), /noteId/);

    assert.deepEqual(normalizeTaskInput({ taskType: 'classify_inbox', input: {} }), { dryRun: false });
    assert.deepEqual(normalizeTaskInput({ taskType: 'openclaw_task', input: { instruction: '  hi  ' } as never }), {
      instruction: 'hi',
      outputDimension: 'learning',
    });

    const summary = normalizeTaskInput({ taskType: 'summarize_note', input: { noteId: 'n1', language: ' ', maxLength: 5000 } as never }) as any;
    assert.equal(summary.language, 'zh');
    assert.equal(summary.maxLength, 2000);
  } finally {
    await env.cleanup();
  }
});

test('createWorkerTask persists pending task with worker and metadata', async () => {
  const env = await createTestEnv('lifeos-worker-create-');
  try {
    initDatabase();
    const task = createWorkerTask({ taskType: 'extract_tasks', input: { noteId: 'note-1' }, sourceNoteId: 'source-1' }, 'schedule-1');
    const stored = getWorkerTask(task.id);

    assert.ok(stored);
    assert.equal(stored?.status, 'pending');
    assert.equal(stored?.worker, 'lifeos');
    assert.equal(stored?.scheduleId, 'schedule-1');
    assert.equal(stored?.sourceNoteId, 'source-1');
    assert.equal(stored?.result, null);
  } finally {
    await env.cleanup();
  }
});

test('cancelWorkerTask cancels pending tasks', async () => {
  const env = await createTestEnv('lifeos-worker-cancel-');
  try {
    initDatabase();
    const task = createWorkerTask({ taskType: 'extract_tasks', input: { noteId: 'missing' } });
    const cancelled = cancelWorkerTask(task.id);

    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.error, '任务已取消');
    assert.ok(cancelled.finishedAt);
  } finally {
    await env.cleanup();
  }
});

test('executeWorkerTask stores structured result on successful completion', async () => {
  const env = await createTestEnv('lifeos-worker-success-');
  try {
    initDatabase();
    const now = '2026-03-22T10:00:00.000Z';
    getDb().prepare(`
      INSERT INTO notes (
        id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'note-success',
      `${env.vaultPath}/学习/source-note.md`,
      'source-note.md',
      'Source Note',
      'note',
      'learning',
      'pending',
      'medium',
      'private',
      '2026-03-22',
      null,
      '[]',
      'web',
      now,
      now,
      'Persona signal content for snapshot.',
      now,
      now,
    );

    const task = createWorkerTask({ taskType: 'update_persona_snapshot', input: { noteId: 'note-success' }, sourceNoteId: 'note-success' });
    const result = await executeWorkerTask(task.id);

    assert.equal(result.status, 'succeeded');
    assert.equal(result.error, null);
    assert.equal(result.resultSummary, '已更新人格快照：Source Note');
    assert.deepEqual(result.result, {
      title: 'Source Note 人格快照更新',
      summary: '已更新人格快照：Source Note',
      sourceNoteTitle: 'Source Note',
      snapshotId: result.result?.snapshotId,
      snapshot: {
        sourceNoteTitle: 'Source Note',
        summary: '已更新人格快照：Source Note',
        contentPreview: 'Persona signal content for snapshot.',
        updatedAt: result.result?.snapshot.updatedAt,
      },
    });
    assert.deepEqual(result.outputNotePaths, []);
  } finally {
    await env.cleanup();
  }
});

test('executeWorkerTask marks deterministic missing-note failure', async () => {
  const env = await createTestEnv('lifeos-worker-failure-');
  try {
    initDatabase();
    const task = createWorkerTask({ taskType: 'extract_tasks', input: { noteId: 'missing-note' } });
    const result = await executeWorkerTask(task.id);

    assert.equal(result.status, 'failed');
    assert.match(result.error || '', /笔记不存在/);
    assert.equal(result.result, null);
    assert.deepEqual(result.outputNotePaths, []);
  } finally {
    await env.cleanup();
  }
});

test('retryWorkerTask resets terminal task and requeues execution', async () => {
  const env = await createTestEnv('lifeos-worker-retry-');
  try {
    initDatabase();
    const task = createWorkerTask({ taskType: 'extract_tasks', input: { noteId: 'missing-note' } });
    await executeWorkerTask(task.id);

    const retried = retryWorkerTask(task.id);
    assert.equal(retried.status, 'pending');
    assert.equal(retried.error, null);
    assert.equal(retried.result, null);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const latest = getWorkerTask(task.id);
    assert.ok(latest);
    assert.notEqual(latest?.status, 'pending');
  } finally {
    await env.cleanup();
  }
});
