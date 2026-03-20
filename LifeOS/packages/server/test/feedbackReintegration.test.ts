import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import type { WorkerTask } from '@lifeos/shared';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { createWorkerTask, executeWorkerTask, cancelWorkerTask } from '../src/workers/workerTasks.js';
import { getSoulActionBySourceNoteIdAndKind, getSoulActionByWorkerTaskId } from '../src/soul/soulActions.js';
import { getPersonaSnapshotBySourceNoteId } from '../src/soul/personaSnapshots.js';
import {
  createFeedbackReintegrationPayload,
  SUPPORTED_REINTEGRATION_TASK_TYPES,
  type SupportedReintegrationTaskType,
} from '../src/workers/feedbackReintegration.js';
import { integrateContinuity } from '../src/workers/continuityIntegrator.js';
import { generateSoulActionCandidate } from '../src/soul/soulActionGenerator.js';
import { evaluateInterventionGate } from '../src/soul/interventionGate.js';
import { dispatchSoulActionCandidate } from '../src/soul/soulActionDispatcher.js';
import { IndexQueue } from '../src/indexer/indexQueue.js';
import { createFile, rewriteMarkdownContent, updateFrontmatter } from '../src/vault/fileManager.js';

function buildTerminalTask(taskType: SupportedReintegrationTaskType, overrides: Partial<WorkerTask> = {}): WorkerTask {
  return {
    id: `task-${taskType}`,
    taskType,
    input: {} as never,
    status: 'succeeded',
    worker: 'lifeos',
    createdAt: '2026-03-20T09:00:00.000Z',
    updatedAt: '2026-03-20T09:05:00.000Z',
    startedAt: '2026-03-20T09:01:00.000Z',
    finishedAt: '2026-03-20T09:05:00.000Z',
    error: null,
    resultSummary: `${taskType} summary`,
    sourceNoteId: taskType === 'openclaw_task' ? null : 'note-1',
    scheduleId: null,
    outputNotePaths: taskType === 'openclaw_task' || taskType === 'update_persona_snapshot' ? [] : [`/tmp/${taskType}.md`],
    outputNotes: taskType === 'openclaw_task' || taskType === 'update_persona_snapshot'
      ? []
      : [{ id: `${taskType}-note`, title: `${taskType} output`, filePath: `/tmp/${taskType}.md`, fileName: `${taskType}.md` }],
    ...overrides,
  };
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for condition');
}

async function waitForQueueToDrain(queue: IndexQueue): Promise<void> {
  await waitFor(() => {
    const status = queue.getStatus();
    return !status.processing && status.queueSize === 0;
  });
}

function buildNoteMarkdown(frontmatter: Record<string, unknown>, content: string): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((item) => JSON.stringify(item)).join(', ')}]`);
      continue;
    }
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('---', '', content);
  return `${lines.join('\n')}\n`;
}

test('extract_tasks with sourceNoteId creates and reuses a SoulAction record', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-create-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-soul-create', '/tmp/note-soul-create.md', 'note-soul-create.md', 'Soul 创建测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const firstTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-create' },
    sourceNoteId: 'note-soul-create',
  });

  const firstSoulAction = getSoulActionBySourceNoteIdAndKind('note-soul-create', 'extract_tasks');
  assert.ok(firstSoulAction);
  assert.equal(firstSoulAction.status, 'pending');
  assert.equal(firstSoulAction.workerTaskId, firstTask.id);

  const secondTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-create' },
    sourceNoteId: 'note-soul-create',
  });

  const reusedSoulAction = getSoulActionBySourceNoteIdAndKind('note-soul-create', 'extract_tasks');
  assert.ok(reusedSoulAction);
  assert.equal(reusedSoulAction.id, firstSoulAction.id);
  assert.equal(reusedSoulAction.workerTaskId, secondTask.id);
});

test('worker tasks without supported SoulAction path do not create SoulAction records', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-skip-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const noSourceTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-missing-source' },
  });
  assert.equal(getSoulActionByWorkerTaskId(noSourceTask.id), null);

  const unsupportedTask = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
    sourceNoteId: 'note-missing-source',
  });
  assert.equal(getSoulActionByWorkerTaskId(unsupportedTask.id), null);
});

test('extract_tasks execution syncs SoulAction lifecycle to terminal state', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-sync-success-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{
      type: 'text',
      text: JSON.stringify({ tasks: [] }),
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-soul-success', '/tmp/note-soul-success.md', 'note-soul-success.md', 'Soul 成功测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-success' },
    sourceNoteId: 'note-soul-success',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);

  assert.equal(result.status, 'succeeded');
  assert.ok(soulAction);
  assert.equal(soulAction.status, 'succeeded');
  assert.equal(soulAction.sourceNoteId, 'note-soul-success');
  assert.equal(soulAction.workerTaskId, task.id);
  assert.ok(soulAction.startedAt);
  assert.ok(soulAction.finishedAt);
  assert.equal(soulAction.error, null);
  assert.equal(soulAction.resultSummary, result.resultSummary ?? null);
});

test('terminal failure and cancellation also sync SoulAction lifecycle', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-sync-terminal-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let shouldCancel = false;
  let cancelTaskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    if (shouldCancel && cancelTaskId) {
      cancelWorkerTask(cancelTaskId);
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({ tasks: [] }),
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('extract-tasks-upstream-failure', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES
      (
        'note-soul-failed', '/tmp/note-soul-failed.md', 'note-soul-failed.md', 'Soul 失败测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
      ),
      (
        'note-soul-cancelled', '/tmp/note-soul-cancelled.md', 'note-soul-cancelled.md', 'Soul 取消测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 B。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
      )
  `).run();

  const failedTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-failed' },
    sourceNoteId: 'note-soul-failed',
  });
  const failedResult = await executeWorkerTask(failedTask.id);
  const failedSoulAction = getSoulActionByWorkerTaskId(failedTask.id);

  assert.equal(failedResult.status, 'failed');
  assert.ok(failedSoulAction);
  assert.equal(failedSoulAction.status, 'failed');
  assert.match(failedSoulAction.error || '', /API error: 500 extract-tasks-upstream-failure/);
  assert.equal(failedSoulAction.resultSummary, null);
  assert.ok(failedSoulAction.finishedAt);

  shouldCancel = true;
  const cancelledTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-cancelled' },
    sourceNoteId: 'note-soul-cancelled',
  });
  cancelTaskId = cancelledTask.id;

  const cancelledResult = await executeWorkerTask(cancelledTask.id);
  const cancelledSoulAction = getSoulActionByWorkerTaskId(cancelledTask.id);

  assert.equal(cancelledResult.status, 'cancelled');
  assert.ok(cancelledSoulAction);
  assert.equal(cancelledSoulAction.status, 'cancelled');
  assert.equal(cancelledSoulAction.error, '任务已取消');
  assert.equal(cancelledSoulAction.resultSummary, null);
  assert.ok(cancelledSoulAction.finishedAt);
});

test('supported task types generate stable reintegration payloads', () => {
  for (const taskType of SUPPORTED_REINTEGRATION_TASK_TYPES) {
    const task = buildTerminalTask(taskType);
    const payload = createFeedbackReintegrationPayload(task);

    assert.deepEqual(Object.keys(payload), [
      'taskId',
      'taskType',
      'status',
      'resultSummary',
      'error',
      'sourceNoteId',
      'outputNotePaths',
    ]);
    assert.equal(payload.taskId, task.id);
    assert.equal(payload.taskType, taskType);
    assert.equal(payload.status, 'succeeded');
    assert.equal(payload.resultSummary, `${taskType} summary`);
    assert.equal(payload.error, null);
    assert.equal(payload.sourceNoteId, task.sourceNoteId ?? null);
    assert.deepEqual(payload.outputNotePaths, task.outputNotePaths ?? []);
    assert.notEqual(payload.outputNotePaths, task.outputNotePaths);
  }
});

test('continuity integrator returns stable, predictable results', () => {
  const sourceTask = buildTerminalTask('summarize_note');
  const sourcePacket = createFeedbackReintegrationPayload(sourceTask);
  const sourceResult = integrateContinuity(sourcePacket);

  assert.deepEqual(sourceResult, {
    taskId: 'task-summarize_note',
    taskType: 'summarize_note',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'summarize_note summary Continuity target: source_note.',
  });

  const extractTask = buildTerminalTask('extract_tasks');
  const extractPacket = createFeedbackReintegrationPayload(extractTask);
  const extractResult = integrateContinuity(extractPacket);

  assert.deepEqual(extractResult, {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'extract_tasks summary Continuity target: source_note.',
  });

  const personaTask = buildTerminalTask('update_persona_snapshot');
  const personaPacket = createFeedbackReintegrationPayload(personaTask);
  const personaResult = integrateContinuity(personaPacket);

  assert.deepEqual(personaResult, {
    taskId: 'task-update_persona_snapshot',
    taskType: 'update_persona_snapshot',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'update_persona_snapshot summary Continuity target: source_note.',
  });

  const classifyTask = buildTerminalTask('classify_inbox', {
    sourceNoteId: null,
  });
  const classifyPacket = createFeedbackReintegrationPayload(classifyTask);
  const classifyResult = integrateContinuity(classifyPacket);

  assert.deepEqual(classifyResult, {
    taskId: 'task-classify_inbox',
    taskType: 'classify_inbox',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'classify_inbox summary Continuity target: derived_outputs.',
  });

  const dailyTask = buildTerminalTask('daily_report', {
    sourceNoteId: null,
  });
  const dailyPacket = createFeedbackReintegrationPayload(dailyTask);
  const dailyResult = integrateContinuity(dailyPacket);

  assert.deepEqual(dailyResult, {
    taskId: 'task-daily_report',
    taskType: 'daily_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily_report summary Continuity target: derived_outputs.',
  });

  const weeklyTask = buildTerminalTask('weekly_report', {
    sourceNoteId: null,
  });
  const weeklyPacket = createFeedbackReintegrationPayload(weeklyTask);
  const weeklyResult = integrateContinuity(weeklyPacket);

  assert.deepEqual(weeklyResult, {
    taskId: 'task-weekly_report',
    taskType: 'weekly_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly_report summary Continuity target: derived_outputs.',
  });

  const failedTask = buildTerminalTask('openclaw_task', {
    status: 'failed',
    resultSummary: null,
    error: 'provider unavailable',
    outputNotePaths: [],
    outputNotes: [],
  });
  const failedPacket = createFeedbackReintegrationPayload(failedTask);
  const failedResult = integrateContinuity(failedPacket);

  assert.deepEqual(failedResult, {
    taskId: 'task-openclaw_task',
    taskType: 'openclaw_task',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'openclaw_task ended as failed; continuity remains observational only (provider unavailable).',
  });
});

test('continuity integrator reports no reintegration candidate when terminal tasks have no error and no outputs', () => {
  const failedTask = buildTerminalTask('openclaw_task', {
    status: 'failed',
    resultSummary: null,
    error: null,
    outputNotePaths: [],
    outputNotes: [],
  });
  const failedResult = integrateContinuity(createFeedbackReintegrationPayload(failedTask));

  assert.deepEqual(failedResult, {
    taskId: 'task-openclaw_task',
    taskType: 'openclaw_task',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'openclaw_task ended as failed; no reintegration candidate was produced.',
  });

  const cancelledTask = buildTerminalTask('openclaw_task', {
    status: 'cancelled',
    resultSummary: null,
    error: null,
    outputNotePaths: [],
    outputNotes: [],
  });
  const cancelledResult = integrateContinuity(createFeedbackReintegrationPayload(cancelledTask));

  assert.deepEqual(cancelledResult, {
    taskId: 'task-openclaw_task',
    taskType: 'openclaw_task',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'openclaw_task ended as cancelled; no reintegration candidate was produced.',
  });
});

test('continuity integrator falls back to output-count summary for succeeded tasks without resultSummary', () => {
  const extractTask = buildTerminalTask('extract_tasks', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: ['/tmp/out-1.md', '/tmp/out-2.md'],
    outputNotes: [
      { id: 'out-1', title: 'out-1', filePath: '/tmp/out-1.md', fileName: 'out-1.md' },
      { id: 'out-2', title: 'out-2', filePath: '/tmp/out-2.md', fileName: 'out-2.md' },
    ],
  });
  const extractResult = integrateContinuity(createFeedbackReintegrationPayload(extractTask));

  assert.deepEqual(extractResult, {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'extract_tasks completed with 2 output note(s). Continuity target: derived_outputs.',
  });

  const summarizeTask = buildTerminalTask('summarize_note', {
    resultSummary: null,
    outputNotePaths: ['/tmp/summarize-out-1.md'],
    outputNotes: [
      { id: 'summarize-out-1', title: 'summarize-out-1', filePath: '/tmp/summarize-out-1.md', fileName: 'summarize-out-1.md' },
    ],
  });
  const summarizeResult = integrateContinuity(createFeedbackReintegrationPayload(summarizeTask));

  assert.deepEqual(summarizeResult, {
    taskId: 'task-summarize_note',
    taskType: 'summarize_note',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'summarize_note completed with 1 output note(s). Continuity target: source_note.',
  });

  const dailyTask = buildTerminalTask('daily_report', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: ['/tmp/daily-out-1.md'],
    outputNotes: [
      { id: 'daily-out-1', title: 'daily-out-1', filePath: '/tmp/daily-out-1.md', fileName: 'daily-out-1.md' },
    ],
  });
  const dailyResult = integrateContinuity(createFeedbackReintegrationPayload(dailyTask));

  assert.deepEqual(dailyResult, {
    taskId: 'task-daily_report',
    taskType: 'daily_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily_report completed with 1 output note(s). Continuity target: derived_outputs.',
  });

  const weeklyTask = buildTerminalTask('weekly_report', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: ['/tmp/weekly-out-1.md', '/tmp/weekly-out-2.md'],
    outputNotes: [
      { id: 'weekly-out-1', title: 'weekly-out-1', filePath: '/tmp/weekly-out-1.md', fileName: 'weekly-out-1.md' },
      { id: 'weekly-out-2', title: 'weekly-out-2', filePath: '/tmp/weekly-out-2.md', fileName: 'weekly-out-2.md' },
    ],
  });
  const weeklyResult = integrateContinuity(createFeedbackReintegrationPayload(weeklyTask));

  assert.deepEqual(weeklyResult, {
    taskId: 'task-weekly_report',
    taskType: 'weekly_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly_report completed with 2 output note(s). Continuity target: derived_outputs.',
  });
});

test('update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot', async (t) => {
  const env = await createTestEnv('lifeos-persona-snapshot-success-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-success', '/tmp/note-persona-success.md', 'note-persona-success.md', 'Persona 成功测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更专注长期主义、系统化推进与稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-success' },
    sourceNoteId: 'note-persona-success',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-success');

  assert.equal(result.status, 'succeeded');
  assert.ok(soulAction);
  assert.equal(soulAction?.status, 'succeeded');
  assert.match(result.resultSummary || '', /已更新人格快照/);
  assert.ok(snapshot);
  assert.equal(snapshot?.workerTaskId, task.id);
  assert.equal(snapshot?.soulActionId, soulAction?.id ?? null);
  assert.match(snapshot?.summary || '', /已更新人格快照/);
  assert.equal(snapshot?.snapshot.sourceNoteTitle, 'Persona 成功测试笔记');
  assert.match(snapshot?.snapshot.contentPreview || '', /长期主义/);
  assert.deepEqual(result.outputNotePaths, []);
});

test('update_persona_snapshot missing note fails without creating persona snapshot', async (t) => {
  const env = await createTestEnv('lifeos-persona-snapshot-failed-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-missing' },
    sourceNoteId: 'note-persona-missing',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-missing');

  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /笔记不存在/);
  assert.ok(soulAction);
  assert.equal(soulAction?.status, 'failed');
  assert.equal(snapshot, null);
});

test('post-index queue dispatches update_persona_snapshot for new growth note', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-create-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-自动触发.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '我最近更重视长期主义与系统化迭代。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);

  const soulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId(note!.id);

  assert.ok(soulAction);
  assert.equal(soulAction?.status, 'succeeded');
  assert.ok(snapshot);
  assert.match(snapshot?.snapshot.contentPreview || '', /长期主义/);
});

test('post-index queue updates persona snapshot when growth note content changes', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-append-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-正文变化.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '第一版内容。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);
  const firstSnapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  assert.ok(firstSnapshot);

  await rewriteMarkdownContent(filePath, (content) => `${content}\n\n补充：现在我更强调稳态推进与节奏感。`);
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const updatedSnapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  assert.ok(updatedSnapshot);
  assert.match(updatedSnapshot?.snapshot.contentPreview || '', /稳态推进/);
  assert.notEqual(updatedSnapshot?.updatedAt, firstSnapshot?.updatedAt);
});

test('post-index queue ignores frontmatter-only updates for growth note', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-frontmatter-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-前言更新.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '正文保持不变。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);
  const beforeSnapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  assert.ok(beforeSnapshot);
  const beforeTasks = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  await updateFrontmatter(filePath, { priority: 'high', status: 'done' });
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const afterSnapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  const afterTasks = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  assert.ok(afterSnapshot);
  assert.equal(afterSnapshot?.updatedAt, beforeSnapshot?.updatedAt);
  assert.equal(afterTasks.total, beforeTasks.total);
});

test('post-index queue ignores non-target notes for persona snapshot trigger', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-filter-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const learningFilePath = path.join(env.vaultPath, '学习', '2026-03-20-非成长.md');
  const taskFilePath = path.join(env.vaultPath, '成长', '2026-03-20-任务.md');
  const emptyFilePath = path.join(env.vaultPath, '成长', '2026-03-20-空正文.md');

  await createFile(learningFilePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'learning',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '这是一条学习笔记。'));
  await createFile(taskFilePath, buildNoteMarkdown({
    type: 'task',
    dimension: 'growth',
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '这是一条任务。'));
  await createFile(emptyFilePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '   '));

  queue.enqueue(learningFilePath, 'upsert');
  queue.enqueue(taskFilePath, 'upsert');
  queue.enqueue(emptyFilePath, 'upsert');
  await waitForQueueToDrain(queue);

  const taskCount = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot'").get() as { total: number };
  assert.equal(taskCount.total, 0);
});

test('generator gate dispatcher runs minimal PR2 update_persona_snapshot closure', async (t) => {
  const env = await createTestEnv('lifeos-persona-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-dispatch', '/tmp/note-persona-dispatch.md', 'note-persona-dispatch.md', 'Persona 派发测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我希望继续以系统化、简洁、稳态的方式推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const candidate = generateSoulActionCandidate({
    sourceNoteId: 'note-persona-dispatch',
    noteId: 'note-persona-dispatch',
    noteContent: '我希望继续以系统化、简洁、稳态的方式推进。',
  });
  assert.deepEqual(candidate, {
    sourceNoteId: 'note-persona-dispatch',
    actionKind: 'update_persona_snapshot',
    noteId: 'note-persona-dispatch',
  });

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'dispatch_now',
    reason: 'low-risk persona snapshot update can run immediately',
  });

  const dispatchResult = await dispatchSoulActionCandidate(candidate!, gateDecision);
  assert.equal(dispatchResult.dispatched, true);
  assert.ok(dispatchResult.workerTaskId);

  const task = getSoulActionByWorkerTaskId(dispatchResult.workerTaskId!);
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-dispatch');
  assert.ok(task);
  assert.equal(task?.status, 'succeeded');
  assert.ok(snapshot);
  assert.equal(snapshot?.workerTaskId, dispatchResult.workerTaskId);
});

test('generator and gate stay observational when source context is missing', () => {
  const candidate = generateSoulActionCandidate({
    sourceNoteId: null,
    noteId: 'note-persona-observe',
    noteContent: '仍有内容，但没有 source note 上下文。',
  });
  assert.equal(candidate, null);

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'observe_only',
    reason: 'missing source note context for update_persona_snapshot',
  });
});

test('executeWorkerTask hits reintegration wiring on classify_inbox success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-classify-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'classify_inbox',
    input: { dryRun: false },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /_Inbox 目录为空或不存在|_Inbox 中没有待分类文件|已分类 \d+ 个文件/);
  assert.ok(Array.isArray(result.outputNotePaths));
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));
  assert.equal(integrateContinuity(createFeedbackReintegrationPayload(result)).taskType, 'classify_inbox');
});

test('executeWorkerTask hits reintegration wiring on extract_tasks success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-extract-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          tasks: [],
        }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-extract', '/tmp/note-extract.md', 'note-extract.md', '提取测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();
  const task = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-extract' },
    sourceNoteId: 'note-extract',
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /未发现可创建的行动项|已创建 \d+ 个行动项/);
  assert.ok(Array.isArray(result.outputNotePaths));
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));
  assert.equal(integrateContinuity(createFeedbackReintegrationPayload(result)).taskType, 'extract_tasks');
});

test('executeWorkerTask hits reintegration wiring on supported success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-wire-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: '示例摘要',
          summary: '这是稳定摘要',
          keyPoints: ['k1', 'k2'],
        }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-1', '/tmp/note-1.md', 'note-1.md', '测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '这是测试内容。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();
  const task = createWorkerTask({
    taskType: 'summarize_note',
    input: { noteId: 'note-1', language: 'zh', maxLength: 200 },
    sourceNoteId: 'note-1',
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /已生成摘要/);
  assert.ok((result.outputNotePaths?.length || 0) > 0);
  assert.equal(result.sourceNoteId, 'note-1');
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));
  assert.equal(integrateContinuity(createFeedbackReintegrationPayload(result)).shouldReintegrate, true);
});

test('executeWorkerTask hits reintegration wiring on daily_report success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-daily-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这是日报摘要',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /日报已生成/);
  assert.ok((result.outputNotePaths?.length || 0) > 0);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'daily_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: `${result.resultSummary} Continuity target: derived_outputs.`,
  });
});

test('executeWorkerTask hits reintegration wiring on daily_report failed path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-daily-failed-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('daily-report-upstream-failure', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.resultSummary, null);
  assert.match(result.error || '', /API error: 500 daily-report-upstream-failure/);
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'daily_report',
    status: 'failed',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: `daily_report ended as failed; continuity remains observational only (${result.error}).`,
  });
});

test('executeWorkerTask hits reintegration wiring on daily_report cancelled path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-daily-cancelled-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;
  let taskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (taskId) {
      cancelWorkerTask(taskId);
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这条日报会在返回前触发取消',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
  });
  taskId = task.id;

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.resultSummary, null);
  assert.equal(result.error, '任务已取消');
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'daily_report',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: 'daily_report ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('executeWorkerTask hits reintegration wiring on weekly_report success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-weekly-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这是周报摘要',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'weekly_report',
    input: { weekStart: '2026-03-16' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /周报已生成/);
  assert.ok((result.outputNotePaths?.length || 0) > 0);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'weekly_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: `${result.resultSummary} Continuity target: derived_outputs.`,
  });
});

test('executeWorkerTask hits reintegration wiring on weekly_report failed path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-weekly-failed-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('weekly-report-upstream-failure', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'weekly_report',
    input: { weekStart: '2026-03-16' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.resultSummary, null);
  assert.match(result.error || '', /API error: 500 weekly-report-upstream-failure/);
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'weekly_report',
    status: 'failed',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: `weekly_report ended as failed; continuity remains observational only (${result.error}).`,
  });
});

test('executeWorkerTask hits reintegration wiring on failed supported path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-failed-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'openclaw_task',
    input: { instruction: 'test failed path', outputDimension: 'learning' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /OpenClaw 未配置/);
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'openclaw_task',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: `openclaw_task ended as failed; continuity remains observational only (${result.error}).`,
  });
});

test('executeWorkerTask hits reintegration wiring on weekly_report cancelled path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-weekly-cancelled-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;
  let taskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (taskId) {
      cancelWorkerTask(taskId);
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这条周报会在返回前触发取消',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'weekly_report',
    input: { weekStart: '2026-03-16' },
  });
  taskId = task.id;

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.resultSummary, null);
  assert.equal(result.error, '任务已取消');
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'weekly_report',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: 'weekly_report ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('executeWorkerTask hits reintegration wiring on cancelled supported path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-cancelled-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;
  let taskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (taskId) {
      cancelWorkerTask(taskId);
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: '取消中的摘要',
          summary: '这条摘要会在返回前触发取消',
          keyPoints: ['k1'],
        }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-cancelled', '/tmp/note-cancelled.md', 'note-cancelled.md', '取消测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '这是取消测试内容。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();
  const task = createWorkerTask({
    taskType: 'summarize_note',
    input: { noteId: 'note-cancelled', language: 'zh', maxLength: 200 },
    sourceNoteId: 'note-cancelled',
  });
  taskId = task.id;

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.error, '任务已取消');
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'summarize_note',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'source_note',
    strength: 'low',
    summary: 'summarize_note ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('feedback reintegration rejects unsupported or non-terminal tasks', () => {
  const unsupportedTask = {
    ...buildTerminalTask('summarize_note'),
    id: 'task-unsupported',
    taskType: 'unsupported_task',
  } as unknown as WorkerTask;
  assert.throws(() => createFeedbackReintegrationPayload(unsupportedTask), /Unsupported reintegration task type/);

  const runningTask = buildTerminalTask('daily_report', {
    status: 'running',
    finishedAt: null,
  });
  assert.throws(() => createFeedbackReintegrationPayload(runningTask), /requires a terminal WorkerTask/);
});
