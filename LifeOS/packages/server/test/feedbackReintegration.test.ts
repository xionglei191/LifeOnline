import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import type { WorkerTask } from '@lifeos/shared';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb, closeDb } from '../src/db/client.js';
import { createWorkerTask, executeWorkerTask, cancelWorkerTask } from '../src/workers/workerTasks.js';
import { approveSoulAction, createOrReuseSoulAction, getSoulActionByIdentityAndKind, getSoulActionBySourceNoteIdAndKind, getSoulActionBySourceReintegrationIdAndKind, getSoulActionByWorkerTaskId } from '../src/soul/soulActions.js';
import { getPersonaSnapshotBySourceNoteId } from '../src/soul/personaSnapshots.js';
import {
  createFeedbackReintegrationPayload,
  createReintegrationRecordInput,
  getReintegrationSignalKind,
  SUPPORTED_REINTEGRATION_TASK_TYPES,
  type SupportedReintegrationTaskType,
} from '../src/workers/feedbackReintegration.js';
import { integrateContinuity } from '../src/workers/continuityIntegrator.js';
import { getReintegrationRecordByWorkerTaskId, upsertReintegrationRecord } from '../src/soul/reintegrationRecords.js';
import { acceptReintegrationRecord, acceptReintegrationRecordAndPlanPromotions } from '../src/soul/reintegrationReview.js';
import { planPromotionSoulActions } from '../src/soul/reintegrationPromotionPlanner.js';
import { listEventNodes } from '../src/soul/eventNodes.js';
import { listContinuityRecords } from '../src/soul/continuityRecords.js';
import { getPromotionActionKindsForReintegration } from '../src/soul/pr6PromotionRules.js';
import { generateSoulActionCandidate } from '../src/soul/soulActionGenerator.js';
import { evaluateInterventionGate } from '../src/soul/interventionGate.js';
import { dispatchSoulActionCandidate, dispatchApprovedSoulAction } from '../src/soul/soulActionDispatcher.js';
import { executePromotionSoulAction } from '../src/soul/pr6PromotionExecutor.js';
import { resolveSoulActionSourceReintegrationId } from '../src/soul/types.js';
import { getIndexedNoteTriggerSnapshot, triggerPersonaSnapshotAfterIndex } from '../src/soul/postIndexPersonaTrigger.js';
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

test('createOrReuseSoulAction persists explicit sourceReintegrationId independently from sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-source-reintegration-column-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const action = createOrReuseSoulAction({
    sourceNoteId: 'note-separated-source',
    sourceReintegrationId: 'reint:separated-source',
    actionKind: 'promote_event_node',
    governanceReason: 'persist explicit source reintegration id',
  });

  const reloaded = getSoulActionByIdentityAndKind({
    sourceNoteId: 'note-separated-source',
    sourceReintegrationId: 'reint:separated-source',
    actionKind: 'promote_event_node',
  });
  assert.ok(reloaded);
  assert.equal(action.id, 'soul:promote_event_node:reint:separated-source');
  assert.equal(action.sourceNoteId, 'note-separated-source');
  assert.equal(action.sourceReintegrationId, 'reint:separated-source');
  assert.equal(reloaded?.sourceNoteId, 'note-separated-source');
  assert.equal(reloaded?.sourceReintegrationId, 'reint:separated-source');
  assert.equal(reloaded?.id, action.id);
});

test('createOrReuseSoulAction reuses promotion actions by legacy reintegration source encoded in sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-legacy-source-identity-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const first = createOrReuseSoulAction({
    sourceNoteId: 'reint:legacy-identity-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
    governanceReason: 'legacy identity seed',
  });

  const reused = createOrReuseSoulAction({
    sourceNoteId: 'reint:legacy-identity-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
    governanceReason: 'legacy identity second pass',
  });

  const reloaded = getSoulActionByIdentityAndKind({
    sourceNoteId: 'reint:legacy-identity-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
  });

  assert.equal(reused.id, first.id);
  assert.equal(reloaded?.id, first.id);
  assert.equal(reloaded?.sourceReintegrationId, 'reint:legacy-identity-source');
  assert.equal(reloaded?.sourceNoteId, 'reint:legacy-identity-source');
});

test('createReintegrationRecordInput centralizes record assembly for terminal tasks', () => {
  const task = buildTerminalTask('update_persona_snapshot', {
    id: 'task-record-input',
    resultSummary: '已更新人格快照：更稳定推进。',
    sourceNoteId: 'note-record-input',
    outputNotePaths: [],
    outputNotes: [],
  });

  const recordInput = createReintegrationRecordInput(task, {
    soulActionId: 'soul-123',
    personaSnapshot: {
      id: 'persona-123',
      sourceNoteId: 'note-record-input',
      soulActionId: 'soul-123',
      workerTaskId: 'task-record-input',
      summary: '长期主义与稳定节奏',
      snapshot: {
        sourceNoteTitle: '测试笔记',
        summary: '人格快照摘要',
        contentPreview: '长期主义与稳定节奏',
        updatedAt: '2026-03-20T09:00:00.000Z',
      },
      createdAt: '2026-03-20T09:00:00.000Z',
      updatedAt: '2026-03-20T09:00:00.000Z',
    },
  });

  assert.deepEqual(recordInput, {
    workerTaskId: 'task-record-input',
    sourceNoteId: 'note-record-input',
    soulActionId: 'soul-123',
    taskType: 'update_persona_snapshot',
    terminalStatus: 'succeeded',
    signalKind: 'persona_snapshot_reintegration',
    target: 'source_note',
    strength: 'medium',
    summary: '已更新人格快照：更稳定推进。 Continuity target: source_note.',
    evidence: {
      taskId: 'task-record-input',
      taskType: 'update_persona_snapshot',
      sourceNoteId: 'note-record-input',
      resultSummary: '已更新人格快照：更稳定推进。',
      error: null,
      outputNotePaths: [],
      personaSnapshotId: 'persona-123',
      personaSnapshotSummary: '长期主义与稳定节奏',
      personaContentPreview: '长期主义与稳定节奏',
    },
  });
});

test('createReintegrationRecordInput keeps persona evidence nullable when absent', () => {
  const task = buildTerminalTask('daily_report', {
    id: 'task-record-input-daily',
    sourceNoteId: null,
    resultSummary: '已生成今日日报',
  });

  const recordInput = createReintegrationRecordInput(task);

  assert.equal(recordInput.signalKind, 'daily_report_reintegration');
  assert.equal(recordInput.target, 'derived_outputs');
  assert.equal(recordInput.evidence.personaSnapshotId, null);
  assert.equal(recordInput.evidence.personaSnapshotSummary, null);
  assert.equal(recordInput.evidence.personaContentPreview, null);
});

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

test('resolveSoulActionSourceReintegrationId prefers explicit sourceReintegrationId and falls back to legacy reint sourceNoteId', () => {
  assert.equal(resolveSoulActionSourceReintegrationId({
    sourceNoteId: 'note-plain-source',
    sourceReintegrationId: 'reint:explicit-source',
  }), 'reint:explicit-source');

  assert.equal(resolveSoulActionSourceReintegrationId({
    sourceNoteId: 'reint:legacy-source',
    sourceReintegrationId: null,
  }), 'reint:legacy-source');

  assert.equal(resolveSoulActionSourceReintegrationId({
    sourceNoteId: 'note-without-reintegration-prefix',
    sourceReintegrationId: null,
  }), null);
});

test('executePromotionSoulAction reports the explicit reintegration source contract when missing promotion source ids', () => {
  assert.throws(
    () => executePromotionSoulAction({
      id: 'soul:promote-event-missing-source',
      sourceNoteId: 'note-without-reintegration-prefix',
      sourceReintegrationId: null,
      actionKind: 'promote_event_node',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      status: 'not_dispatched',
      workerTaskId: null,
      governanceReason: null,
      resultSummary: null,
      error: null,
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      approvedAt: '2026-03-22T10:00:00.000Z',
      deferredAt: null,
      discardedAt: null,
      startedAt: null,
      finishedAt: null,
    }),
    /requires sourceReintegrationId or reintegration-record sourceNoteId/,
  );
});

test('executePromotionSoulAction prefers explicit sourceReintegrationId over a non-reintegration sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-pr6-explicit-source-reintegration-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'task-pr6-explicit-source',
    sourceNoteId: 'note-original-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly reviewed summary',
    evidence: { source: 'feedback-test' },
    reviewStatus: 'accepted',
    reviewReason: 'looks good',
  });

  const result = executePromotionSoulAction({
    id: 'soul:promote-event-explicit-source',
    sourceNoteId: 'note-original-source',
    sourceReintegrationId: 'reint:task-pr6-explicit-source',
    actionKind: 'promote_event_node',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    status: 'not_dispatched',
    workerTaskId: null,
    governanceReason: null,
    resultSummary: null,
    error: null,
    createdAt: '2026-03-22T10:05:00.000Z',
    updatedAt: '2026-03-22T10:05:00.000Z',
    approvedAt: '2026-03-22T10:05:00.000Z',
    deferredAt: null,
    discardedAt: null,
    startedAt: null,
    finishedAt: null,
  });

  assert.match(result.summary, /已创建 event node:/);

  const eventNode = listEventNodes().find((item) => item.sourceReintegrationId === 'reint:task-pr6-explicit-source');
  assert.ok(eventNode);
  assert.equal(eventNode?.sourceReintegrationId, 'reint:task-pr6-explicit-source');
  assert.equal(eventNode?.sourceNoteId, 'note-original-source');
  assert.equal(eventNode?.title, '周回顾事件');
});

test('executePromotionSoulAction still supports legacy reintegration ids stored in sourceNoteId for event-node promotions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-legacy-source-note-event-fallback-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'task-pr6-legacy-event-source',
    sourceNoteId: 'note-legacy-event-original-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly legacy reviewed summary',
    evidence: { source: 'feedback-test-event' },
    reviewStatus: 'accepted',
    reviewReason: 'legacy event fallback still supported',
  });

  const result = executePromotionSoulAction({
    id: 'soul:promote-event-legacy-source',
    sourceNoteId: 'reint:task-pr6-legacy-event-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    status: 'not_dispatched',
    workerTaskId: null,
    governanceReason: null,
    resultSummary: null,
    error: null,
    createdAt: '2026-03-22T10:08:00.000Z',
    updatedAt: '2026-03-22T10:08:00.000Z',
    approvedAt: '2026-03-22T10:08:00.000Z',
    deferredAt: null,
    discardedAt: null,
    startedAt: null,
    finishedAt: null,
  });

  assert.match(result.summary, /已创建 event node:/);

  const eventNode = listEventNodes().find((item) => item.sourceReintegrationId === 'reint:task-pr6-legacy-event-source');
  assert.ok(eventNode);
  assert.equal(eventNode?.sourceReintegrationId, 'reint:task-pr6-legacy-event-source');
  assert.equal(eventNode?.sourceNoteId, 'note-legacy-event-original-source');
  assert.equal(eventNode?.eventKind, 'weekly_reflection');
  assert.equal(eventNode?.title, '周回顾事件');
});

test('executePromotionSoulAction still supports legacy reintegration ids stored in sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-pr6-legacy-source-note-fallback-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'task-pr6-legacy-source',
    sourceNoteId: 'note-legacy-original-source',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily reviewed summary',
    evidence: { source: 'feedback-test' },
    reviewStatus: 'accepted',
    reviewReason: 'legacy still supported',
  });

  const result = executePromotionSoulAction({
    id: 'soul:promote-continuity-legacy-source',
    sourceNoteId: 'reint:task-pr6-legacy-source',
    sourceReintegrationId: null,
    actionKind: 'promote_continuity_record',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    status: 'not_dispatched',
    workerTaskId: null,
    governanceReason: null,
    resultSummary: null,
    error: null,
    createdAt: '2026-03-22T10:10:00.000Z',
    updatedAt: '2026-03-22T10:10:00.000Z',
    approvedAt: '2026-03-22T10:10:00.000Z',
    deferredAt: null,
    discardedAt: null,
    startedAt: null,
    finishedAt: null,
  });

  assert.match(result.summary, /已创建 continuity record:/);

  const continuity = listContinuityRecords().find((item) => item.sourceReintegrationId === 'reint:task-pr6-legacy-source');
  assert.ok(continuity);
  assert.equal(continuity?.sourceReintegrationId, 'reint:task-pr6-legacy-source');
  assert.equal(continuity?.sourceNoteId, 'note-legacy-original-source');
  assert.equal(continuity?.continuityKind, 'daily_rhythm');
});

test('update_persona_snapshot with sourceNoteId creates and reuses a SoulAction record', async (t) => {
  const env = await createTestEnv('lifeos-persona-soul-action-create-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-create', '/tmp/note-persona-create.md', 'note-persona-create.md', 'Persona 创建测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我想继续稳定推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const firstTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-create' },
    sourceNoteId: 'note-persona-create',
  });

  const firstSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-create', 'update_persona_snapshot');
  assert.ok(firstSoulAction);
  assert.equal(firstSoulAction.governanceStatus, 'approved');
  assert.equal(firstSoulAction.executionStatus, 'pending');
  assert.equal(firstSoulAction.workerTaskId, firstTask.id);

  const secondTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-create' },
    sourceNoteId: 'note-persona-create',
  });

  const reusedSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-create', 'update_persona_snapshot');
  assert.ok(reusedSoulAction);
  assert.equal(reusedSoulAction.id, firstSoulAction.id);
  assert.equal(reusedSoulAction.workerTaskId, secondTask.id);
});

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
  assert.equal(firstSoulAction.governanceStatus, 'approved');
  assert.equal(firstSoulAction.executionStatus, 'pending');
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
  assert.equal(soulAction.governanceStatus, 'approved');
  assert.equal(soulAction.executionStatus, 'succeeded');
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
  assert.equal(failedSoulAction.governanceStatus, 'approved');
  assert.equal(failedSoulAction.executionStatus, 'failed');
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
  assert.equal(cancelledSoulAction.governanceStatus, 'approved');
  assert.equal(cancelledSoulAction.executionStatus, 'cancelled');
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
    assert.equal(getReintegrationSignalKind(taskType), {
      summarize_note: 'summary_reintegration',
      classify_inbox: 'classification_reintegration',
      extract_tasks: 'task_extraction_reintegration',
      update_persona_snapshot: 'persona_snapshot_reintegration',
      daily_report: 'daily_report_reintegration',
      weekly_report: 'weekly_report_reintegration',
      openclaw_task: 'openclaw_reintegration',
    }[taskType]);
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
      'note-persona-success-pr5', '/tmp/note-persona-success-pr5.md', 'note-persona-success-pr5.md', 'Persona 成功测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更专注长期主义、系统化推进与稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-success-pr5' },
    sourceNoteId: 'note-persona-success-pr5',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-success-pr5');
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);

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
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'persona_snapshot_reintegration');
  assert.equal(reintegrationRecord?.sourceNoteId, 'note-persona-success-pr5');
  assert.equal(reintegrationRecord?.soulActionId, soulAction?.id ?? null);
  assert.equal(reintegrationRecord?.reviewStatus, 'pending_review');
  assert.deepEqual(result.outputNotePaths, []);
});

test('update_persona_snapshot terminal failure and cancellation also sync SoulAction lifecycle', async (t) => {
  const env = await createTestEnv('lifeos-persona-soul-action-sync-terminal-');
  let cancelTaskId = '';

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-cancelled', '/tmp/note-persona-cancelled.md', 'note-persona-cancelled.md', 'Persona 取消测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我想继续稳定推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const failedTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-missing-sync' },
    sourceNoteId: 'note-persona-missing-sync',
  });
  const failedResult = await executeWorkerTask(failedTask.id);
  const failedSoulAction = getSoulActionByWorkerTaskId(failedTask.id);

  assert.equal(failedResult.status, 'failed');
  assert.ok(failedSoulAction);
  assert.equal(failedSoulAction.governanceStatus, 'approved');
  assert.equal(failedSoulAction.executionStatus, 'failed');
  assert.match(failedSoulAction.error || '', /笔记不存在/);
  assert.equal(failedSoulAction.resultSummary, null);

  const cancelledTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-cancelled' },
    sourceNoteId: 'note-persona-cancelled',
  });
  cancelTaskId = cancelledTask.id;
  cancelWorkerTask(cancelTaskId);
  const cancelledResult = await executeWorkerTask(cancelledTask.id);
  const cancelledSoulAction = getSoulActionByWorkerTaskId(cancelledTask.id);

  assert.equal(cancelledResult.status, 'cancelled');
  assert.ok(cancelledSoulAction);
  assert.equal(cancelledSoulAction.governanceStatus, 'approved');
  assert.equal(cancelledSoulAction.executionStatus, 'cancelled');
  assert.equal(cancelledSoulAction.error, '任务已取消');
  assert.equal(cancelledSoulAction.resultSummary, null);
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

test('post-index queue creates pending_review soul action for new growth note', async (t) => {
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
  const workerTaskCount = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(workerTaskCount.total, 0);
  assert.equal(snapshot, null);
});

test('post-index queue reuses pending_review soul action when growth note content changes', async (t) => {
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
  const firstSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  assert.ok(firstSoulAction);

  await rewriteMarkdownContent(filePath, (content) => `${content}\n\n补充：现在我更强调稳态推进与节奏感。`);
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const updatedSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  assert.ok(updatedSoulAction);
  assert.equal(updatedSoulAction?.id, firstSoulAction?.id);
  assert.equal(updatedSoulAction?.governanceStatus, 'pending_review');
  assert.equal(updatedSoulAction?.executionStatus, 'not_dispatched');
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
  const beforeSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  assert.ok(beforeSoulAction);
  const beforeTasks = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  await updateFrontmatter(filePath, { priority: 'high', status: 'done' });
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const afterSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const afterTasks = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  assert.ok(afterSoulAction);
  assert.equal(afterSoulAction?.updatedAt, beforeSoulAction?.updatedAt);
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

test('post-index PR3 baseline queues reviewable soul action instead of auto-dispatching', async (t) => {
  const env = await createTestEnv('lifeos-persona-pr3-queue-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-pr3-queue.md');
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
  }, '我最近更强调长期主义、稳态推进与节奏感。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);

  const soulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  const workerTaskCount = getDb()
    .prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?")
    .get(note!.id) as { total: number };

  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(workerTaskCount.total, 0);
  assert.equal(snapshot, null);
});

test('generator gate queues PR3 reviewable update_persona_snapshot action', async (t) => {
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
    trigger: 'post_index_growth_note',
  });

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'queue_for_review',
    reason: 'persona snapshot candidate requires review-backed dispatch',
  });

  const dispatchResult = await dispatchSoulActionCandidate(candidate!, gateDecision);
  assert.equal(dispatchResult.dispatched, false);
  assert.equal(dispatchResult.workerTaskId, null);
  assert.ok(dispatchResult.soulActionId);

  const soulAction = getSoulActionBySourceNoteIdAndKind('note-persona-dispatch', 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-dispatch');
  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(snapshot, null);
});

test('generator gate queues and dispatches review-backed extract_tasks closure', async (t) => {
  const env = await createTestEnv('lifeos-extract-dispatch-');
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
      'note-extract-closure', '/tmp/note-extract-closure.md', 'note-extract-closure.md', 'Extract Closure 测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请帮我整理任务。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const candidate = generateSoulActionCandidate({
    sourceNoteId: 'note-extract-closure',
    noteId: 'note-extract-closure',
    noteContent: '请帮我整理任务。',
    preferredActionKind: 'extract_tasks',
  });
  assert.deepEqual(candidate, {
    sourceNoteId: 'note-extract-closure',
    actionKind: 'extract_tasks',
    noteId: 'note-extract-closure',
    trigger: 'manual_extract_tasks_request',
  });

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'queue_for_review',
    reason: 'extract_tasks candidate requires review-backed dispatch',
  });

  const queued = await dispatchSoulActionCandidate(candidate!, gateDecision);
  assert.equal(queued.dispatched, false);
  assert.ok(queued.soulActionId);
  assert.equal(queued.workerTaskId, null);

  const queuedSoulAction = getSoulActionBySourceNoteIdAndKind('note-extract-closure', 'extract_tasks');
  assert.ok(queuedSoulAction);
  assert.equal(queuedSoulAction?.governanceStatus, 'pending_review');
  assert.equal(queuedSoulAction?.executionStatus, 'not_dispatched');

  const approved = approveSoulAction(queuedSoulAction!.id, 'approve extract closure');
  assert.ok(approved);
  assert.equal(approved?.governanceStatus, 'approved');

  const { dispatchApprovedSoulAction } = await import('../src/soul/soulActionDispatcher.js');
  const dispatched = await dispatchApprovedSoulAction(queuedSoulAction!.id);
  assert.equal(dispatched.dispatched, true);
  assert.ok(dispatched.workerTaskId);

  const task = getSoulActionByWorkerTaskId(dispatched.workerTaskId!);
  assert.ok(task);
  assert.equal(task?.executionStatus, 'succeeded');
  assert.equal(task?.governanceStatus, 'approved');
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
    reason: 'missing source note context for governance queue',
  });
});

test('post-index PR3 baseline returns explicit trigger result and creates reviewable soul action', async (t) => {
  const env = await createTestEnv('lifeos-persona-pr2-baseline-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-pr2-baseline.md');
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
  }, '我想继续以稳态、节奏感和系统化方式推进。'));

  const queue = new IndexQueue(() => {});
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);

  const previousNote = getIndexedNoteTriggerSnapshot(filePath);
  const result = await triggerPersonaSnapshotAfterIndex({
    filePath,
    previousNote,
  });

  assert.equal(result.triggered, false);
  assert.match(result.reason, /current note does not match PR3 persona snapshot review baseline/);

  const soulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  const workerTaskCount = getDb()
    .prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?")
    .get(note!.id) as { total: number };

  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(workerTaskCount.total, 0);
  assert.equal(snapshot, null);
});

test('dispatcher reuses stable PR3 soul action id across repeated queueing', async (t) => {
  const env = await createTestEnv('lifeos-persona-pr2-repeat-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-repeat', '/tmp/note-persona-repeat.md', 'note-persona-repeat.md', 'Persona 重复派发测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更强调长期主义和系统化推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const firstCandidate = generateSoulActionCandidate({
    sourceNoteId: 'note-persona-repeat',
    noteId: 'note-persona-repeat',
    noteContent: '我最近更强调长期主义和系统化推进。',
  });
  const firstDispatch = await dispatchSoulActionCandidate(firstCandidate!, evaluateInterventionGate(firstCandidate));
  const firstSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-repeat', 'update_persona_snapshot');

  assert.ok(firstDispatch.soulActionId);
  assert.ok(firstSoulAction);

  getDb().prepare(`UPDATE notes SET content = ?, updated = ? WHERE id = ?`).run(
    '我最近更强调长期主义、系统化推进和节奏感。',
    '2026-03-20T10:00:00.000Z',
    'note-persona-repeat',
  );

  const secondCandidate = generateSoulActionCandidate({
    sourceNoteId: 'note-persona-repeat',
    noteId: 'note-persona-repeat',
    noteContent: '我最近更强调长期主义、系统化推进和节奏感。',
  });
  const secondDispatch = await dispatchSoulActionCandidate(secondCandidate!, evaluateInterventionGate(secondCandidate));
  const secondSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-repeat', 'update_persona_snapshot');
  const workerTaskCount = getDb()
    .prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?")
    .get('note-persona-repeat') as { total: number };

  assert.equal(secondDispatch.soulActionId, firstDispatch.soulActionId);
  assert.equal(secondSoulAction?.id, firstSoulAction?.id);
  assert.equal(secondDispatch.workerTaskId, null);
  assert.equal(workerTaskCount.total, 0);
  assert.equal(secondSoulAction?.governanceStatus, 'pending_review');
  assert.equal(secondSoulAction?.executionStatus, 'not_dispatched');
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
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'classification_reintegration');
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
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'task_extraction_reintegration');
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
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'daily_report_reintegration');
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
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'weekly_report_reintegration');
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

test('approved create_event_node action reuses PR6 event promotion executor', async (t) => {
  const env = await createTestEnv('lifeos-pr2-create-event-node-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO reintegration_records (
      id, worker_task_id, source_note_id, soul_action_id, task_type, terminal_status,
      signal_kind, review_status, target, strength, summary, evidence_json,
      review_reason, created_at, updated_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'reint:create-event-node',
    'task-create-event-node',
    'note-create-event-node',
    'soul:update_persona_snapshot:note-create-event-node',
    'update_persona_snapshot',
    'succeeded',
    'persona_snapshot_reintegration',
    'accepted',
    'source_note',
    'medium',
    '稳定人格变化信号，值得沉淀为 event node。',
    JSON.stringify({ source: 'test' }),
    'accepted for create_event_node coverage',
    '2026-03-20T09:00:00.000Z',
    '2026-03-20T09:00:00.000Z',
    '2026-03-20T09:00:00.000Z',
  );

  const soulAction = approveSoulAction(
    'soul:create_event_node:reint:create-event-node',
    'approve create_event_node coverage',
    '2026-03-20T09:01:00.000Z',
  ) ?? getSoulActionBySourceReintegrationIdAndKind('reint:create-event-node', 'create_event_node');

  if (!soulAction) {
    getDb().prepare(`
      INSERT INTO soul_actions (
        id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
        created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'soul:create_event_node:reint:create-event-node',
      'reint:create-event-node',
      'reint:create-event-node',
      'create_event_node',
      'approved',
      'not_dispatched',
      'approve create_event_node coverage',
      null,
      '2026-03-20T09:00:00.000Z',
      '2026-03-20T09:01:00.000Z',
      '2026-03-20T09:01:00.000Z',
      null,
      null,
      null,
      null,
      null,
      null,
    );
  }

  const dispatchResult = await dispatchApprovedSoulAction('soul:create_event_node:reint:create-event-node');
  const eventNodes = listEventNodes();
  const createdAction = getSoulActionBySourceReintegrationIdAndKind('reint:create-event-node', 'create_event_node');

  assert.equal(dispatchResult.dispatched, true);
  assert.match(dispatchResult.reason, /已创建 event node|已更新 event node/);
  assert.ok(createdAction);
  assert.equal(createdAction?.executionStatus, 'succeeded');
  assert.equal(eventNodes.length, 1);
  assert.equal(eventNodes[0]?.sourceReintegrationId, 'reint:create-event-node');
});

test('acceptReintegrationRecordAndPlanPromotions auto-plans PR6 actions on acceptance', async (t) => {
  const env = await createTestEnv('lifeos-pr6-accept-plan-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-accept-plan',
    sourceNoteId: 'note-pr6-accept-plan',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly accept-plan summary',
    evidence: { source: 'test' },
    now: '2026-03-21T08:30:00.000Z',
  });

  const reintegrationRecord = getReintegrationRecordByWorkerTaskId('manual-task-pr6-accept-plan');
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.reviewStatus, 'pending_review');

  const acceptedResult = acceptReintegrationRecordAndPlanPromotions(reintegrationRecord!.id, 'accept and auto-plan PR6 promotions');
  assert.ok(acceptedResult);
  assert.equal(acceptedResult?.reintegrationRecord.reviewStatus, 'accepted');
  assert.equal(acceptedResult?.soulActions.length, 2);
  assert.deepEqual(
    acceptedResult?.soulActions.map((action) => action.actionKind).sort(),
    ['promote_continuity_record', 'promote_event_node'],
  );
  assert.ok(acceptedResult?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-accept-plan'));
  assert.ok(acceptedResult?.soulActions.every((action) => action.sourceReintegrationId === reintegrationRecord!.id));

  const persistedEventAction = getSoulActionByIdentityAndKind({
    sourceNoteId: 'note-pr6-accept-plan',
    sourceReintegrationId: reintegrationRecord!.id,
    actionKind: 'promote_event_node',
  });
  const persistedContinuityAction = getSoulActionByIdentityAndKind({
    sourceNoteId: 'note-pr6-accept-plan',
    sourceReintegrationId: reintegrationRecord!.id,
    actionKind: 'promote_continuity_record',
  });
  assert.ok(persistedEventAction);
  assert.ok(persistedContinuityAction);
});

test('acceptReintegrationRecordAndPlanPromotions reuses existing PR6 promotion actions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-accept-plan-idempotent-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-auto-plan',
    sourceNoteId: 'note-pr6-auto-plan',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly auto-plan summary',
    evidence: { source: 'test' },
    now: '2026-03-21T09:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-pr6-auto-plan');
  assert.ok(record);

  const firstAcceptance = acceptReintegrationRecordAndPlanPromotions(record!.id, 'first accept');
  assert.ok(firstAcceptance);
  assert.equal(firstAcceptance?.soulActions.length, 2);
  assert.ok(firstAcceptance?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-auto-plan'));
  assert.ok(firstAcceptance?.soulActions.every((action) => action.sourceReintegrationId === record!.id));

  const secondPlanned = planPromotionSoulActions(firstAcceptance!.reintegrationRecord);
  assert.equal(secondPlanned.length, 2);
  assert.equal(secondPlanned[0]?.id, firstAcceptance?.soulActions[0]?.id);
  assert.equal(secondPlanned[1]?.id, firstAcceptance?.soulActions[1]?.id);

  const promotionActions = getDb().prepare(`
    SELECT COUNT(*) as total
    FROM soul_actions
    WHERE source_reintegration_id = ?
      AND action_kind IN ('promote_event_node', 'promote_continuity_record')
  `).get(record!.id) as { total: number };
  assert.equal(promotionActions.total, 2);
});

test('acceptReintegrationRecordAndPlanPromotions keeps promotion actions distinct across multiple reintegration records for the same source note', async (t) => {
  const env = await createTestEnv('lifeos-pr6-multi-reintegration-same-note-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-same-note-a',
    sourceNoteId: 'note-pr6-shared-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'first reintegration for shared note',
    evidence: { source: 'test', run: 'a' },
    now: '2026-03-22T01:00:00.000Z',
  });
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-same-note-b',
    sourceNoteId: 'note-pr6-shared-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'second reintegration for shared note',
    evidence: { source: 'test', run: 'b' },
    now: '2026-03-22T02:00:00.000Z',
  });

  const recordA = getReintegrationRecordByWorkerTaskId('manual-task-pr6-same-note-a');
  const recordB = getReintegrationRecordByWorkerTaskId('manual-task-pr6-same-note-b');
  assert.ok(recordA);
  assert.ok(recordB);
  assert.notEqual(recordA?.id, recordB?.id);

  const acceptedA = acceptReintegrationRecordAndPlanPromotions(recordA!.id, 'accept first shared-note reintegration');
  const acceptedB = acceptReintegrationRecordAndPlanPromotions(recordB!.id, 'accept second shared-note reintegration');
  assert.ok(acceptedA);
  assert.ok(acceptedB);
  assert.equal(acceptedA?.soulActions.length, 2);
  assert.equal(acceptedB?.soulActions.length, 2);
  assert.ok(acceptedA?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-shared-source'));
  assert.ok(acceptedB?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-shared-source'));
  assert.ok(acceptedA?.soulActions.every((action) => action.sourceReintegrationId === recordA!.id));
  assert.ok(acceptedB?.soulActions.every((action) => action.sourceReintegrationId === recordB!.id));

  const plannedActions = getDb().prepare(`
    SELECT id, source_note_id, source_reintegration_id, action_kind
    FROM soul_actions
    WHERE source_note_id = ?
      AND action_kind IN ('promote_event_node', 'promote_continuity_record')
    ORDER BY source_reintegration_id, action_kind
  `).all('note-pr6-shared-source') as Array<{
    id: string;
    source_note_id: string;
    source_reintegration_id: string;
    action_kind: string;
  }>;

  assert.equal(plannedActions.length, 4);
  assert.deepEqual(
    plannedActions.map((action) => `${action.source_reintegration_id}:${action.action_kind}`),
    [
      `${recordA!.id}:promote_continuity_record`,
      `${recordA!.id}:promote_event_node`,
      `${recordB!.id}:promote_continuity_record`,
      `${recordB!.id}:promote_event_node`,
    ],
  );
});

test('accepted persona reintegration can plan and dispatch PR6 event and continuity promotions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-persona-promotion-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-pr6-persona', '/tmp/note-pr6-persona.md', 'note-pr6-persona.md', 'PR6 Persona 测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更专注长期主义、系统化推进与稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-pr6-persona' },
    sourceNoteId: 'note-pr6-persona',
  });
  const result = await executeWorkerTask(task.id);
  assert.equal(result.status, 'succeeded');

  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);

  const accepted = acceptReintegrationRecord(reintegrationRecord!.id, 'accept for PR6 promotion');
  assert.ok(accepted);
  assert.equal(accepted?.reviewStatus, 'accepted');

  const planned = planPromotionSoulActions(accepted!);
  assert.equal(planned.length, 2);
  assert.ok(planned.some((action) => action.actionKind === 'promote_event_node'));
  assert.ok(planned.some((action) => action.actionKind === 'promote_continuity_record'));

  const eventAction = planned.find((action) => action.actionKind === 'promote_event_node');
  const continuityAction = planned.find((action) => action.actionKind === 'promote_continuity_record');
  assert.ok(eventAction);
  assert.ok(continuityAction);

  getDb().prepare(`UPDATE soul_actions SET governance_status = 'approved', approved_at = updated_at WHERE id = ?`).run(eventAction!.id);
  getDb().prepare(`UPDATE soul_actions SET governance_status = 'approved', approved_at = updated_at WHERE id = ?`).run(continuityAction!.id);

  const { dispatchApprovedSoulAction } = await import('../src/soul/soulActionDispatcher.js');
  const eventDispatch = await dispatchApprovedSoulAction(eventAction!.id);
  const continuityDispatch = await dispatchApprovedSoulAction(continuityAction!.id);

  assert.equal(eventDispatch.dispatched, true);
  assert.equal(continuityDispatch.dispatched, true);

  const eventNodes = listEventNodes();
  const continuityRecords = listContinuityRecords();
  assert.equal(eventNodes.length, 1);
  assert.equal(continuityRecords.length, 1);
  assert.equal(eventNodes[0]?.sourceReintegrationId, reintegrationRecord!.id);
  assert.equal(continuityRecords[0]?.sourceReintegrationId, reintegrationRecord!.id);
});

test('accepted daily report reintegration plans PR6 event and continuity promotions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-daily-promotion-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: '这是日报摘要' }],
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
  const task = createWorkerTask({ taskType: 'daily_report', input: { date: '2026-03-20' } });
  const result = await executeWorkerTask(task.id);
  assert.equal(result.status, 'succeeded');

  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  const accepted = acceptReintegrationRecord(reintegrationRecord!.id, 'accept daily report event and continuity');
  const planned = planPromotionSoulActions(accepted!);
  assert.equal(planned.length, 2);
  assert.deepEqual(
    getPromotionActionKindsForReintegration(accepted!).sort(),
    ['promote_continuity_record', 'promote_event_node'],
  );
  assert.ok(planned.some((action) => action.actionKind === 'promote_event_node'));
  assert.ok(planned.some((action) => action.actionKind === 'promote_continuity_record'));
});

test('unaccepted reintegration cannot plan PR6 promotions', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-unaccepted-plan-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6',
    sourceNoteId: null,
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'manual summary',
    evidence: {},
    now: '2026-03-20T09:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-pr6');
  assert.ok(record);
  assert.throws(() => planPromotionSoulActions(record!), /accepted/);
});

test('dispatch blocks PR6 promotion when reintegration review is still pending', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-pending-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-pending-dispatch',
    sourceNoteId: 'note-pr6-pending-dispatch',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'pending review summary',
    evidence: { source: 'test' },
    now: '2026-03-20T09:30:00.000Z',
  });

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'soul:promote_event_node:reint:manual-task-pr6-pending-dispatch',
    'reint:manual-task-pr6-pending-dispatch',
    'reint:manual-task-pr6-pending-dispatch',
    'promote_event_node',
    'approved',
    'not_dispatched',
    'manually approved in test',
    null,
    '2026-03-20T09:30:00.000Z',
    '2026-03-20T09:30:00.000Z',
    '2026-03-20T09:30:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
  );

  await assert.rejects(
    () => dispatchApprovedSoulAction('soul:promote_event_node:reint:manual-task-pr6-pending-dispatch'),
    /accepted reintegration review/,
  );
  assert.equal(listEventNodes().length, 0);
});

test('accepted daily report continuity promotion dispatch creates daily_rhythm continuity record', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-daily-continuity-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-daily-continuity-dispatch',
    sourceNoteId: 'note-pr6-daily-continuity-dispatch',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily summary worth continuity promotion',
    evidence: { source: 'test', cadence: 'daily' },
    reviewReason: 'daily continuity accepted',
    now: '2026-03-20T10:30:00.000Z',
  });

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'soul:promote_continuity_record:reint:manual-task-pr6-daily-continuity-dispatch',
    'reint:manual-task-pr6-daily-continuity-dispatch',
    'reint:manual-task-pr6-daily-continuity-dispatch',
    'promote_continuity_record',
    'approved',
    'not_dispatched',
    'manually approved in test',
    null,
    '2026-03-20T10:30:00.000Z',
    '2026-03-20T10:30:00.000Z',
    '2026-03-20T10:30:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
  );

  const dispatchResult = await dispatchApprovedSoulAction('soul:promote_continuity_record:reint:manual-task-pr6-daily-continuity-dispatch');
  const continuityRecords = listContinuityRecords();

  assert.equal(dispatchResult.dispatched, true);
  assert.match(dispatchResult.reason, /已创建 continuity record|已更新 continuity record/);
  assert.equal(continuityRecords.length, 1);
  assert.equal(continuityRecords[0]?.continuityKind, 'daily_rhythm');
  assert.equal(continuityRecords[0]?.target, 'derived_outputs');
  assert.equal(continuityRecords[0]?.continuity.scope, 'daily');
});

test('dispatch blocks daily-report PR6 continuity promotion when reintegration review was rejected', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-daily-rejected-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-daily-rejected-dispatch',
    sourceNoteId: 'note-pr6-daily-rejected-dispatch',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'rejected',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'rejected daily continuity summary',
    evidence: { source: 'test', cadence: 'daily' },
    reviewReason: 'not enough continuity evidence',
    now: '2026-03-20T11:00:00.000Z',
  });

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'soul:promote_continuity_record:reint:manual-task-pr6-daily-rejected-dispatch',
    'reint:manual-task-pr6-daily-rejected-dispatch',
    'reint:manual-task-pr6-daily-rejected-dispatch',
    'promote_continuity_record',
    'approved',
    'not_dispatched',
    'manually approved in test',
    null,
    '2026-03-20T11:00:00.000Z',
    '2026-03-20T11:00:00.000Z',
    '2026-03-20T11:00:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
  );

  await assert.rejects(
    () => dispatchApprovedSoulAction('soul:promote_continuity_record:reint:manual-task-pr6-daily-rejected-dispatch'),
    /accepted reintegration review/,
  );
  assert.equal(listContinuityRecords().length, 0);
});


test('terminal hook does not directly create PR6 event or continuity objects', async (t) => {
  const env = await createTestEnv('lifeos-pr6-no-direct-promotion-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: '这是周报摘要' }],
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
  const task = createWorkerTask({ taskType: 'weekly_report', input: { weekStart: '2026-03-16' } });
  const result = await executeWorkerTask(task.id);
  assert.equal(result.status, 'succeeded');
  assert.equal(listEventNodes().length, 0);
  assert.equal(listContinuityRecords().length, 0);
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
