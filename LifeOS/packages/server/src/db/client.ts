import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../..');

function getDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }

  return path.join(SERVER_ROOT, 'data/lifeos.db');
}

const DB_PATH = getDbPath();

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
  }
  return db;
}

export function initDatabase(): void {
  const database = getDb();
  database.exec(SCHEMA);

  // Migration: add schedule_id column to worker_tasks if missing
  const columns = database.prepare("PRAGMA table_info(worker_tasks)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'schedule_id')) {
    database.exec('ALTER TABLE worker_tasks ADD COLUMN schedule_id TEXT');
    console.log('Migration: added schedule_id column to worker_tasks');
  }

  // Migration: add inbox_origin column to notes if missing
  const notesCols = database.prepare("PRAGMA table_info(notes)").all() as Array<{ name: string }>;
  if (!notesCols.some(c => c.name === 'inbox_origin')) {
    database.exec('ALTER TABLE notes ADD COLUMN inbox_origin TEXT');
    console.log('Migration: added inbox_origin column to notes');
  }

  // Migration: add consecutive_failures and last_error columns to task_schedules if missing
  const schedCols = database.prepare("PRAGMA table_info(task_schedules)").all() as Array<{ name: string }>;
  if (!schedCols.some(c => c.name === 'consecutive_failures')) {
    database.exec('ALTER TABLE task_schedules ADD COLUMN consecutive_failures INTEGER DEFAULT 0');
    console.log('Migration: added consecutive_failures column to task_schedules');
  }
  if (!schedCols.some(c => c.name === 'last_error')) {
    database.exec('ALTER TABLE task_schedules ADD COLUMN last_error TEXT');
    console.log('Migration: added last_error column to task_schedules');
  }

  // Migration: rebuild worker_tasks/task_schedules with latest task_type CHECK constraints
  // Also migrate existing legacy external-task records to openclaw_task
  try {
    database.exec(`
      INSERT INTO worker_tasks (id, task_type, input_json, status, worker, created_at, updated_at)
      VALUES ('__migration_test__', 'extract_tasks', '{}', 'pending', 'lifeos', '', '')
    `);
    database.exec("DELETE FROM worker_tasks WHERE id = '__migration_test__'");
  } catch {
    console.log('Migration: rebuilding worker_tasks table with latest task_type CHECK constraint...');
    database.exec(`
      CREATE TABLE worker_tasks_new (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL CHECK(task_type IN ('openclaw_task', 'summarize_note', 'classify_inbox', 'extract_tasks', 'daily_report', 'weekly_report')),
        input_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
        worker TEXT NOT NULL CHECK(worker IN ('openclaw', 'lifeos')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        error TEXT,
        result_summary TEXT,
        source_note_id TEXT,
        output_note_paths TEXT,
        schedule_id TEXT
      );
      INSERT INTO worker_tasks_new SELECT
        id,
        CASE WHEN task_type = 'collect_trending_news' THEN 'openclaw_task' ELSE task_type END,
        input_json, status, worker, created_at, updated_at,
        started_at, finished_at, error, result_summary, source_note_id, output_note_paths, schedule_id
      FROM worker_tasks;
      DROP TABLE worker_tasks;
      ALTER TABLE worker_tasks_new RENAME TO worker_tasks;
      CREATE INDEX IF NOT EXISTS idx_worker_tasks_status ON worker_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_worker_tasks_type ON worker_tasks(task_type);
      CREATE INDEX IF NOT EXISTS idx_worker_tasks_created_at ON worker_tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_worker_tasks_source_note_id ON worker_tasks(source_note_id);
    `);
    console.log('Migration: worker_tasks table rebuilt with latest task types');
  }

  try {
    database.exec(`
      INSERT INTO task_schedules (id, task_type, input_json, cron_expression, label, enabled, created_at, updated_at)
      VALUES ('__migration_test__', 'extract_tasks', '{}', '0 9 * * *', 'test', 1, '', '')
    `);
    database.exec("DELETE FROM task_schedules WHERE id = '__migration_test__'");
  } catch {
    console.log('Migration: rebuilding task_schedules table with latest task_type CHECK constraint...');
    database.exec(`
      CREATE TABLE task_schedules_new (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL CHECK(task_type IN ('openclaw_task', 'summarize_note', 'classify_inbox', 'extract_tasks', 'daily_report', 'weekly_report')),
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
      INSERT INTO task_schedules_new SELECT
        id,
        CASE WHEN task_type = 'collect_trending_news' THEN 'openclaw_task' ELSE task_type END,
        input_json, cron_expression, label, enabled, created_at, updated_at,
        last_run_at, last_task_id, consecutive_failures, last_error
      FROM task_schedules;
      DROP TABLE task_schedules;
      ALTER TABLE task_schedules_new RENAME TO task_schedules;
      CREATE INDEX IF NOT EXISTS idx_task_schedules_enabled ON task_schedules(enabled);
    `);
    console.log('Migration: task_schedules table rebuilt with latest task types');
  }

  // Migration: add notes column to ai_prompts if missing
  const promptCols = database.prepare("PRAGMA table_info(ai_prompts)").all() as Array<{ name: string }>;
  if (!promptCols.some(c => c.name === 'notes')) {
    database.exec('ALTER TABLE ai_prompts ADD COLUMN notes TEXT');
    console.log('Migration: added notes column to ai_prompts');
  }

  // Migration: create ai_provider_settings table if missing
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_provider_settings (
      id TEXT PRIMARY KEY,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_provider_settings_enabled ON ai_provider_settings(enabled);
  `);

  console.log('Database initialized successfully');
  console.log('Database path:', DB_PATH);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
