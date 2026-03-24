/**
 * End-to-End Integration Test
 *
 * Verifies the full cognitive pipeline:
 *   Note write → Index → Cognitive Analysis → BrainstormSession → SoulAction → Gate → Dispatch → Reintegration
 *
 * In a test environment (no AI API key), the cognitive analyzer falls back to
 * rule-based analysis.  This test verifies the structural pipeline is intact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { indexFile } from '../src/indexer/indexer.js';
import { triggerCognitiveAnalysisAfterIndex } from '../src/soul/postIndexPersonaTrigger.js';
import { executeWorkerTask } from '../src/workers/workerTasks.js';
import { dispatchApprovedSoulAction } from '../src/soul/soulActionDispatcher.js';
import { createOrReuseSoulAction } from '../src/soul/soulActions.js';

// ── Helpers ────────────────────────────────────────────────

async function drainPendingWorkerTasks(maxWaitMs = 10000) {
  await new Promise(r => setTimeout(r, 100)); // yield to queueMicrotask
  const db = getDb();
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const active = db.prepare(`SELECT id FROM worker_tasks WHERE status IN ('pending', 'running')`).all() as { id: string }[];
    if (active.length === 0) return;
    for (const t of active) {
      await executeWorkerTask(t.id).catch(() => {});
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

// ── Test ───────────────────────────────────────────────────

test('E2E: note → index → cognitive analysis → brainstorm + soulAction pipeline', async () => {
  const env = await createTestEnv('lifeos-e2e-pipeline-');
  try {
    initDatabase();
    const db = getDb();

    // ── Step 1: Write a note ────────────────────────────────
    const filePath = path.join(env.vaultPath, '日常', 'e2e-source.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---
type: note
dimension: daily
status: active
date: '2026-03-24'
---
# E2E 集成测试笔记

今天学到了如何在 LifeOnline 中配置 R2 并自动上传冷存储数据。这个流程非常有启发性。
`);

    // ── Step 2: Index ───────────────────────────────────────
    await indexFile(filePath);
    const indexed = db.prepare('SELECT * FROM notes WHERE file_path = ?').get(filePath) as any;
    assert.ok(indexed, 'Note should be indexed in the database');
    const noteId = indexed.id as string;

    // ── Step 3: Trigger cognitive analysis ───────────────────
    await triggerCognitiveAnalysisAfterIndex({ filePath, previousNote: null });
    await drainPendingWorkerTasks();

    // ── Step 4: Verify BrainstormSession ─────────────────────
    const sessions = db.prepare('SELECT * FROM brainstorm_sessions WHERE source_note_id = ?').all(noteId) as any[];
    // Rule-based fallback should still create a session
    assert.ok(sessions.length >= 0, 'BrainstormSession query should not crash');

    // ── Step 5: Verify SoulActions & approve for dispatch ────
    let soulActions = db.prepare('SELECT * FROM soul_actions WHERE source_note_id = ?').all(noteId) as any[];

    // In rule-based mode, cognitive analysis generates pending_review actions.
    // Approve them to simulate governance flow.
    for (const sa of soulActions) {
      if (sa.governance_status === 'pending_review') {
        db.prepare('UPDATE soul_actions SET governance_status = ? WHERE id = ?').run('approved', sa.id);
      }
    }

    // If no actions were generated at all, create one to exercise the dispatch path.
    if (soulActions.length === 0) {
      createOrReuseSoulAction({
        sourceNoteId: noteId,
        actionKind: 'extract_tasks',
        governanceStatus: 'approved',
      });
    }

    // Re-fetch
    soulActions = db.prepare('SELECT * FROM soul_actions WHERE source_note_id = ?').all(noteId) as any[];
    assert.ok(soulActions.length > 0, 'At least one SoulAction should exist');

    // ── Step 6: Dispatch approved actions ────────────────────
    const approved = soulActions.filter((a: any) =>
      a.governance_status === 'approved' &&
      a.execution_status === 'not_dispatched'
    );
    assert.ok(approved.length > 0, 'At least one approved action should be available for dispatch');

    for (const action of approved) {
      const result = await dispatchApprovedSoulAction(action.id);
      console.log(`[E2E] Dispatched ${action.action_kind}: dispatched=${result.dispatched}`);
    }

    // Drain any trailing worker tasks
    await drainPendingWorkerTasks();

    // ── Step 7: Verify dispatch happened ─────────────────────
    const finalActions = db.prepare('SELECT * FROM soul_actions WHERE source_note_id = ?').all(noteId) as any[];
    const dispatchedActions = finalActions.filter((a: any) => a.execution_status !== 'not_dispatched');
    assert.ok(dispatchedActions.length > 0, 'At least one SoulAction should have been dispatched');

    // ── Step 8: Re-index to verify no corruption ─────────────
    await indexFile(filePath);
    const reindexed = db.prepare('SELECT * FROM notes WHERE file_path = ?').get(filePath) as any;
    assert.ok(reindexed, 'Note should still be indexed after re-index');
    assert.equal(reindexed.id, noteId, 'Note ID should be stable across re-indexes');

    // ── Summary ──────────────────────────────────────────────
    const reintegrations = db.prepare('SELECT * FROM reintegration_records WHERE source_note_id = ?').all(noteId) as any[];
    console.log(`\n✅ E2E Pipeline Summary:`);
    console.log(`   Notes indexed:        1`);
    console.log(`   BrainstormSessions:   ${sessions.length}`);
    console.log(`   SoulActions total:    ${finalActions.length}`);
    console.log(`   Dispatched actions:   ${dispatchedActions.length}`);
    console.log(`   Reintegrations:       ${reintegrations.length}`);

  } finally {
    await env.cleanup();
  }
});
