import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, closeDb, getDb } from '../src/db/client.js';
import { SUPPORTED_WORKER_TASK_TYPES } from '@lifeos/shared';

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) as { name: string } | undefined;
  return !!row;
}

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
}

test('initDatabase creates key tables and columns', async () => {
  const env = await createTestEnv('lifeos-db-test-');
  try {
    initDatabase();
    const db = getDb();

    for (const table of ['notes', 'worker_tasks', 'task_schedules', 'soul_actions', 'persona_snapshots', 'reintegration_records', 'event_nodes', 'continuity_records', 'ai_prompts', 'ai_provider_settings']) {
      assert.equal(tableExists(db, table), true, `missing table ${table}`);
    }

    assert.deepEqual(columnNames(db, 'worker_tasks').includes('schedule_id'), true);
    assert.deepEqual(columnNames(db, 'notes').includes('inbox_origin'), true);
    assert.deepEqual(columnNames(db, 'task_schedules').includes('consecutive_failures'), true);
    assert.deepEqual(columnNames(db, 'task_schedules').includes('last_error'), true);
    const soulActionsSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'soul_actions'").get() as { sql: string }).sql;
    assert.match(soulActionsSql, /UNIQUE\(source_note_id, action_kind, source_reintegration_id\)/);
    assert.deepEqual(columnNames(db, 'persona_snapshots').includes('snapshot_json'), true);
    assert.deepEqual(columnNames(db, 'reintegration_records').includes('worker_task_id'), true);
    assert.deepEqual(columnNames(db, 'reintegration_records').includes('signal_kind'), true);
    assert.deepEqual(columnNames(db, 'reintegration_records').includes('evidence_json'), true);
    assert.deepEqual(columnNames(db, 'event_nodes').includes('source_reintegration_id'), true);
    assert.deepEqual(columnNames(db, 'event_nodes').includes('promotion_soul_action_id'), true);
    assert.deepEqual(columnNames(db, 'continuity_records').includes('source_reintegration_id'), true);
    assert.deepEqual(columnNames(db, 'continuity_records').includes('promotion_soul_action_id'), true);
    assert.deepEqual(columnNames(db, 'ai_prompts').includes('notes'), true);
  } finally {
    await env.cleanup();
  }
});

test('initDatabase migrates legacy task type rows to openclaw_task', async () => {
  const env = await createTestEnv('lifeos-db-legacy-');
  try {
    closeDb();
    const legacyDb = new Database(env.dbPath);
    legacyDb.exec(`
      CREATE TABLE worker_tasks (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL CHECK(task_type IN ('collect_trending_news', 'extract_tasks')),
        input_json TEXT NOT NULL,
        status TEXT NOT NULL,
        worker TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        error TEXT,
        result_json TEXT,
        result_summary TEXT,
        source_note_id TEXT,
        source_reintegration_id TEXT,
        output_note_paths TEXT,
        schedule_id TEXT
      );
      CREATE TABLE task_schedules (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL CHECK(task_type IN ('collect_trending_news', 'extract_tasks')),
        input_json TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        label TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_run_at TEXT,
        last_task_id TEXT,
        consecutive_failures INTEGER DEFAULT 0,
        last_error TEXT
      );
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        title TEXT,
        type TEXT NOT NULL,
        dimension TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        privacy TEXT NOT NULL,
        date TEXT NOT NULL,
        due TEXT,
        tags TEXT,
        source TEXT NOT NULL,
        created TEXT NOT NULL,
        updated TEXT,
        content TEXT,
        indexed_at TEXT NOT NULL,
        file_modified_at TEXT NOT NULL
      );
      CREATE TABLE ai_prompts (
        key TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
    `);

    legacyDb.prepare("INSERT INTO worker_tasks (id, task_type, input_json, status, worker, created_at, updated_at) VALUES ('wt1', 'collect_trending_news', '{}', 'pending', 'openclaw', 'a', 'a')").run();
    legacyDb.prepare("INSERT INTO task_schedules (id, task_type, input_json, cron_expression, label, enabled, created_at, updated_at) VALUES ('sch1', 'collect_trending_news', '{}', '* * * * *', 'legacy', 1, 'a', 'a')").run();
    legacyDb.close();

    initDatabase();
    const db = getDb();

    const taskType = db.prepare("SELECT task_type FROM worker_tasks WHERE id = 'wt1'").get() as { task_type: string };
    const scheduleType = db.prepare("SELECT task_type FROM task_schedules WHERE id = 'sch1'").get() as { task_type: string };
    assert.equal(taskType.task_type, 'openclaw_task');
    assert.equal(scheduleType.task_type, 'openclaw_task');

    const workerSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'worker_tasks'").get() as { sql: string }).sql;
    for (const taskType of SUPPORTED_WORKER_TASK_TYPES) {
      assert.match(workerSql, new RegExp(`'${taskType}'`));
    }
  } finally {
    await env.cleanup();
  }
});

test('initDatabase migrates legacy PR6 promotion actions to explicit reintegration source ids', async () => {
  const env = await createTestEnv('lifeos-db-legacy-pr6-promotion-');
  try {
    closeDb();
    const legacyDb = new Database(env.dbPath);
    legacyDb.exec(`
      CREATE TABLE soul_actions (
        id TEXT PRIMARY KEY,
        source_note_id TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        governance_status TEXT NOT NULL CHECK(governance_status IN ('pending_review', 'approved', 'deferred', 'discarded')),
        execution_status TEXT NOT NULL CHECK(execution_status IN ('not_dispatched', 'pending', 'running', 'succeeded', 'failed', 'cancelled')),
        governance_reason TEXT,
        worker_task_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        approved_at TEXT,
        deferred_at TEXT,
        discarded_at TEXT,
        started_at TEXT,
        finished_at TEXT,
        error TEXT,
        result_summary TEXT,
        UNIQUE(source_note_id, action_kind),
        UNIQUE(worker_task_id)
      );
    `);
    legacyDb.prepare(`
      INSERT INTO soul_actions (
        id, source_note_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
        created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'soul:promote_event_node:reint:legacy-pr6-record',
      'reint:legacy-pr6-record',
      'promote_event_node',
      'approved',
      'not_dispatched',
      'legacy promotion action',
      null,
      '2026-03-22T03:00:00.000Z',
      '2026-03-22T03:00:00.000Z',
      '2026-03-22T03:00:00.000Z',
      null,
      null,
      null,
      null,
      null,
      null,
    );
    legacyDb.close();

    initDatabase();
    const db = getDb();
    const migrated = db.prepare(`
      SELECT source_note_id, source_reintegration_id, action_kind, governance_status, execution_status
      FROM soul_actions
      WHERE id = ?
    `).get('soul:promote_event_node:reint:legacy-pr6-record') as {
      source_note_id: string;
      source_reintegration_id: string | null;
      action_kind: string;
      governance_status: string;
      execution_status: string;
    } | undefined;

    assert.ok(migrated);
    assert.equal(migrated?.source_note_id, 'reint:legacy-pr6-record');
    assert.equal(migrated?.source_reintegration_id, 'reint:legacy-pr6-record');
    assert.equal(migrated?.action_kind, 'promote_event_node');
    assert.equal(migrated?.governance_status, 'approved');
    assert.equal(migrated?.execution_status, 'not_dispatched');
  } finally {
    await env.cleanup();
  }
});

test('initDatabase preserves explicit reintegration source ids on legacy PR6 promotion rows', async () => {
  const env = await createTestEnv('lifeos-db-legacy-pr6-explicit-source-');
  try {
    closeDb();
    const legacyDb = new Database(env.dbPath);
    legacyDb.exec(`
      CREATE TABLE soul_actions (
        id TEXT PRIMARY KEY,
        source_note_id TEXT NOT NULL,
        source_reintegration_id TEXT,
        action_kind TEXT NOT NULL,
        governance_status TEXT NOT NULL CHECK(governance_status IN ('pending_review', 'approved', 'deferred', 'discarded')),
        execution_status TEXT NOT NULL CHECK(execution_status IN ('not_dispatched', 'pending', 'running', 'succeeded', 'failed', 'cancelled')),
        governance_reason TEXT,
        worker_task_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        approved_at TEXT,
        deferred_at TEXT,
        discarded_at TEXT,
        started_at TEXT,
        finished_at TEXT,
        error TEXT,
        result_summary TEXT,
        UNIQUE(source_note_id, action_kind),
        UNIQUE(worker_task_id)
      );
    `);
    legacyDb.prepare(`
      INSERT INTO soul_actions (
        id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
        created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'soul:promote_continuity_record:reint:explicit-pr6-record',
      'note-explicit-pr6-source',
      'reint:explicit-pr6-record',
      'promote_continuity_record',
      'approved',
      'not_dispatched',
      'explicit promotion action',
      null,
      '2026-03-22T04:00:00.000Z',
      '2026-03-22T04:00:00.000Z',
      '2026-03-22T04:00:00.000Z',
      null,
      null,
      null,
      null,
      null,
      null,
    );
    legacyDb.close();

    initDatabase();
    const db = getDb();
    const migrated = db.prepare(`
      SELECT source_note_id, source_reintegration_id, action_kind, governance_status, execution_status
      FROM soul_actions
      WHERE id = ?
    `).get('soul:promote_continuity_record:reint:explicit-pr6-record') as {
      source_note_id: string;
      source_reintegration_id: string | null;
      action_kind: string;
      governance_status: string;
      execution_status: string;
    } | undefined;

    assert.ok(migrated);
    assert.equal(migrated?.source_note_id, 'note-explicit-pr6-source');
    assert.equal(migrated?.source_reintegration_id, 'reint:explicit-pr6-record');
    assert.equal(migrated?.action_kind, 'promote_continuity_record');
    assert.equal(migrated?.governance_status, 'approved');
    assert.equal(migrated?.execution_status, 'not_dispatched');
  } finally {
    await env.cleanup();
  }
});

test('initDatabase is idempotent', async () => {
  const env = await createTestEnv('lifeos-db-idempotent-');
  try {
    initDatabase();
    initDatabase();
    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as total FROM sqlite_master WHERE type = 'table' AND name = 'worker_tasks'").get() as { total: number };
    assert.equal(count.total, 1);
  } finally {
    await env.cleanup();
  }
});
