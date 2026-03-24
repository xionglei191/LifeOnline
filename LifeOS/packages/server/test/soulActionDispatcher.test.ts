import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { createOrReuseSoulAction, getSoulAction } from '../src/soul/soulActions.js';
import { dispatchSoulActionCandidate, dispatchApprovedSoulAction } from '../src/soul/soulActionDispatcher.js';
import type { SoulActionCandidate } from '../src/soul/soulActionGenerator.js';
import type { InterventionGateDecision } from '../src/soul/interventionGate.js';

// ── Helpers ────────────────────────────────────────────

function makeCandidate(overrides: Partial<SoulActionCandidate> = {}): SoulActionCandidate {
  return {
    sourceNoteId: 'note-test-1',
    actionKind: 'extract_tasks',
    noteId: 'note-test-1',
    trigger: 'cognitive_analysis',
    confidence: 0.8,
    analysisReason: 'test candidate',
    ...overrides,
  };
}

function makeGateDecision(overrides: Partial<InterventionGateDecision> = {}): InterventionGateDecision {
  return {
    decision: 'dispatch_now',
    reason: 'test dispatch',
    confidence: 0.8,
    ...overrides,
  };
}

function insertTestNote(env: { vaultPath: string }, noteId = 'note-test-1', title = 'Test Note'): void {
  const now = new Date().toISOString();
  const filePath = path.join(env.vaultPath, '学习', 'test-note.md');

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, '# Test Note\n\nTest content for dispatcher tests.');

  getDb().prepare(`
    INSERT OR REPLACE INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    noteId, filePath, 'test-note.md', title, 'note', 'learning', 'pending', 'medium', 'private',
    '2026-03-24', null, '[]', 'web', now, now, 'Test content for dispatcher tests.', now, now,
  );
}

function insertReintegrationRecord(reintId: string, noteId: string, soulActionId: string | null = null): void {
  const now = new Date().toISOString();
  const workerTaskId = `wt:${reintId}`;

  // Insert a worker task first (required by reintegration foreign key)
  getDb().prepare(`
    INSERT OR REPLACE INTO worker_tasks (id, task_type, input_json, status, worker, created_at, updated_at)
    VALUES (?, 'summarize_note', '{}', 'succeeded', 'lifeos', ?, ?)
  `).run(workerTaskId, now, now);

  getDb().prepare(`
    INSERT OR REPLACE INTO reintegration_records (
      id, worker_task_id, source_note_id, soul_action_id, task_type, terminal_status,
      signal_kind, review_status, target, strength, summary, evidence_json,
      review_reason, created_at, updated_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reintId, workerTaskId, noteId, soulActionId, 'summarize_note', 'succeeded',
    'summary_reintegration', 'accepted', 'source_note', 'medium',
    'Test reintegration summary', '[]',
    'Accepted for testing', now, now, now,
  );
}

// ── Gate Decision Branch Tests ─────────────────────────

test('dispatchSoulActionCandidate: observe_only gate → no action created', async () => {
  const env = await createTestEnv('lifeos-dispatch-observe-');
  try {
    initDatabase();
    const candidate = makeCandidate();
    const gate = makeGateDecision({ decision: 'observe_only', reason: 'confidence too low' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, false);
    assert.equal(result.soulActionId, null);
    assert.equal(result.workerTaskId, null);
    assert.match(result.reason, /confidence too low/);
  } finally {
    await env.cleanup();
  }
});

test('dispatchSoulActionCandidate: discard gate → no action created', async () => {
  const env = await createTestEnv('lifeos-dispatch-discard-');
  try {
    initDatabase();
    const candidate = makeCandidate();
    const gate = makeGateDecision({ decision: 'discard', reason: 'discarded by gate' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, false);
    assert.equal(result.soulActionId, null);
    assert.equal(result.workerTaskId, null);
  } finally {
    await env.cleanup();
  }
});

test('dispatchSoulActionCandidate: queue_for_review gate → pending_review action created', async () => {
  const env = await createTestEnv('lifeos-dispatch-queue-');
  try {
    initDatabase();
    const candidate = makeCandidate();
    const gate = makeGateDecision({ decision: 'queue_for_review', reason: 'needs human review' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, false);
    assert.ok(result.soulActionId);
    assert.equal(result.workerTaskId, null);

    // Verify the soul action was created with pending_review status
    const action = getSoulAction(result.soulActionId!);
    assert.ok(action);
    assert.equal(action!.governanceStatus, 'pending_review');
    assert.equal(action!.executionStatus, 'not_dispatched');
  } finally {
    await env.cleanup();
  }
});

// ── Worker-Task Dispatch Path Tests ────────────────────

test('dispatchSoulActionCandidate: dispatch_now + extract_tasks → worker task dispatched', async () => {
  const env = await createTestEnv('lifeos-dispatch-extract-');
  try {
    initDatabase();
    insertTestNote(env);
    const candidate = makeCandidate({ actionKind: 'extract_tasks' });
    const gate = makeGateDecision({ decision: 'dispatch_now' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, true);
    assert.ok(result.soulActionId);
    assert.ok(result.workerTaskId);
    assert.ok(result.executionSummary);
    assert.equal(result.executionSummary?.objectType, 'worker_task');
  } finally {
    await env.cleanup();
  }
});

test('dispatchSoulActionCandidate: dispatch_now + update_persona_snapshot → worker task dispatched', async () => {
  const env = await createTestEnv('lifeos-dispatch-persona-');
  try {
    initDatabase();
    insertTestNote(env);
    const candidate = makeCandidate({ actionKind: 'update_persona_snapshot' });
    const gate = makeGateDecision({ decision: 'dispatch_now' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, true);
    assert.ok(result.soulActionId);
    assert.ok(result.workerTaskId);
  } finally {
    await env.cleanup();
  }
});

// ── ask_followup_question Path ─────────────────────────

test('dispatchSoulActionCandidate: dispatch_now + ask_followup_question → pending execution', async () => {
  const env = await createTestEnv('lifeos-dispatch-followup-');
  try {
    initDatabase();
    const candidate = makeCandidate({ actionKind: 'ask_followup_question' });
    const gate = makeGateDecision({ decision: 'dispatch_now', reason: '这是一个追问' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, true);
    assert.ok(result.soulActionId);
    assert.equal(result.workerTaskId, null);
    assert.ok(result.executionSummary);
    assert.equal(result.executionSummary?.objectType, 'followup_question');
    assert.equal(result.executionSummary?.operation, 'awaiting_answer');

    // Verify execution status is 'pending' (awaiting user answer)
    const action = getSoulAction(result.soulActionId!);
    assert.equal(action!.executionStatus, 'pending');
  } finally {
    await env.cleanup();
  }
});

// ── persist_continuity_markdown Path ───────────────────

test('dispatchSoulActionCandidate: dispatch_now + persist_continuity_markdown → file written', async () => {
  const env = await createTestEnv('lifeos-dispatch-persist-');
  try {
    initDatabase();
    const candidate = makeCandidate({
      actionKind: 'persist_continuity_markdown',
    });
    const gate = makeGateDecision({ decision: 'dispatch_now', reason: '持续性认知洞察内容' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, true);
    assert.ok(result.soulActionId);
    assert.ok(result.executionSummary);
    assert.equal(result.executionSummary?.objectType, 'continuity_markdown');
    assert.equal(result.executionSummary?.operation, 'persisted');

    // Verify the file was actually written to vault
    const action = getSoulAction(result.soulActionId!);
    assert.equal(action!.executionStatus, 'succeeded');
    assert.ok(action!.resultSummary?.includes('已写入'));
  } finally {
    await env.cleanup();
  }
});

// ── sync_continuity_to_r2 Path (R2 Not Configured) ────

test('dispatchSoulActionCandidate: dispatch_now + sync_continuity_to_r2 without R2 → fails gracefully', async () => {
  const env = await createTestEnv('lifeos-dispatch-r2-nocfg-');
  try {
    initDatabase();

    // Ensure R2 env vars are NOT set
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;

    const candidate = makeCandidate({ actionKind: 'sync_continuity_to_r2' });
    const gate = makeGateDecision({ decision: 'dispatch_now' });

    const result = await dispatchSoulActionCandidate(candidate, gate);

    assert.equal(result.dispatched, false);
    assert.ok(result.soulActionId);
    assert.match(result.reason, /R2 未配置/);

    // Verify the soul action was marked as failed
    const action = getSoulAction(result.soulActionId!);
    assert.equal(action!.executionStatus, 'failed');
    assert.ok(action!.error?.includes('R2 未配置'));
  } finally {
    await env.cleanup();
  }
});

// ── Promotion Path Tests ───────────────────────────────

test('dispatchSoulActionCandidate: dispatch_now + promote_event_node → event node created', async () => {
  const env = await createTestEnv('lifeos-dispatch-promote-event-');
  try {
    initDatabase();
    insertTestNote(env, 'note-promote-1');

    const reintId = 'reint:promote-event-test';
    insertReintegrationRecord(reintId, 'note-promote-1');

    const candidate = makeCandidate({
      sourceNoteId: 'note-promote-1',
      actionKind: 'promote_event_node',
    });
    const gate = makeGateDecision({ decision: 'dispatch_now' });

    // Create the soul action with proper reintegration source
    const preAction = createOrReuseSoulAction({
      sourceNoteId: 'note-promote-1',
      sourceReintegrationId: reintId,
      actionKind: 'promote_event_node',
      governanceStatus: 'approved',
    });

    const result = await dispatchApprovedSoulAction(preAction.id);

    assert.equal(result.dispatched, true);
    assert.ok(result.soulActionId);
    assert.ok(result.executionSummary);
    assert.equal(result.executionSummary?.objectType, 'event_node');
    assert.ok(result.eventNode);
  } finally {
    await env.cleanup();
  }
});

test('dispatchSoulActionCandidate: dispatch_now + promote_continuity_record → continuity record created', async () => {
  const env = await createTestEnv('lifeos-dispatch-promote-cont-');
  try {
    initDatabase();
    insertTestNote(env, 'note-promote-2');

    const reintId = 'reint:promote-continuity-test';
    insertReintegrationRecord(reintId, 'note-promote-2');

    const preAction = createOrReuseSoulAction({
      sourceNoteId: 'note-promote-2',
      sourceReintegrationId: reintId,
      actionKind: 'promote_continuity_record',
      governanceStatus: 'approved',
    });

    const result = await dispatchApprovedSoulAction(preAction.id);

    assert.equal(result.dispatched, true);
    assert.ok(result.soulActionId);
    assert.ok(result.executionSummary);
    assert.equal(result.executionSummary?.objectType, 'continuity_record');
    assert.ok(result.continuityRecord);
  } finally {
    await env.cleanup();
  }
});

// ── dispatchApprovedSoulAction Guard Tests ─────────────

test('dispatchApprovedSoulAction: rejects non-existent action', async () => {
  const env = await createTestEnv('lifeos-dispatch-guard-missing-');
  try {
    initDatabase();

    const result = await dispatchApprovedSoulAction('nonexistent-id');

    assert.equal(result.dispatched, false);
    assert.match(result.reason, /not found/);
  } finally {
    await env.cleanup();
  }
});

test('dispatchApprovedSoulAction: rejects non-approved action', async () => {
  const env = await createTestEnv('lifeos-dispatch-guard-notapproved-');
  try {
    initDatabase();

    const action = createOrReuseSoulAction({
      sourceNoteId: 'note-guard-test',
      actionKind: 'extract_tasks',
      governanceStatus: 'pending_review',
    });

    const result = await dispatchApprovedSoulAction(action.id);

    assert.equal(result.dispatched, false);
    assert.match(result.reason, /only approved/);
  } finally {
    await env.cleanup();
  }
});

test('dispatchApprovedSoulAction: rejects already dispatched action', async () => {
  const env = await createTestEnv('lifeos-dispatch-guard-dispatched-');
  try {
    initDatabase();
    insertTestNote(env, 'note-dispatched-test', 'Already Dispatched');

    const action = createOrReuseSoulAction({
      sourceNoteId: 'note-dispatched-test',
      actionKind: 'extract_tasks',
      governanceStatus: 'approved',
    });

    // First dispatch — should succeed
    const first = await dispatchApprovedSoulAction(action.id);
    assert.equal(first.dispatched, true);

    // Second dispatch — should be rejected (already dispatched)
    const second = await dispatchApprovedSoulAction(action.id);
    assert.equal(second.dispatched, false);
    assert.match(second.reason, /only not_dispatched/);
  } finally {
    await env.cleanup();
  }
});
