import Database from 'better-sqlite3';
import { SCHEMA, WORKER_TASK_TABLE_COLUMNS_SQL, WORKER_TASK_INDEXES_SQL, TASK_SCHEDULE_TABLE_COLUMNS_SQL, TASK_SCHEDULE_INDEXES_SQL } from './schema.js';
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

function ensureTaskTypeConstraint(tableName: 'worker_tasks' | 'task_schedules', insertSql: string): string {
  return `
      INSERT INTO ${tableName} ${insertSql}
    `;
}

function normalizeLegacyTaskTypeSql(columnName = 'task_type'): string {
  return `CASE WHEN ${columnName} = 'collect_trending_news' THEN 'openclaw_task' ELSE ${columnName} END`;
}

function rebuildTableWithNormalizedTaskType(options: {
  tableName: 'worker_tasks' | 'task_schedules';
  createTableSql: string;
  selectColumnsSql: string;
  recreateIndexesSql: string;
}): string {
  const nextTableName = `${options.tableName}_new`;
  return `
      CREATE TABLE ${nextTableName} (
${options.createTableSql}
      );
      INSERT INTO ${nextTableName} SELECT
${options.selectColumnsSql}
      FROM ${options.tableName};
      DROP TABLE ${options.tableName};
      ALTER TABLE ${nextTableName} RENAME TO ${options.tableName};
${options.recreateIndexesSql}
    `;
}

function ensureTaskTableConstraintOrRebuild(database: Database.Database, options: {
  tableName: 'worker_tasks' | 'task_schedules';
  insertSql: string;
  createTableSql: string;
  selectColumnsSql: string;
  recreateIndexesSql: string;
  rebuildingLog: string;
  rebuiltLog: string;
}): void {
  try {
    database.exec(ensureTaskTypeConstraint(options.tableName, options.insertSql));
    database.exec(`DELETE FROM ${options.tableName} WHERE id = '__migration_test__'`);
  } catch {
    console.log(options.rebuildingLog);
    database.exec(rebuildTableWithNormalizedTaskType({
      tableName: options.tableName,
      createTableSql: options.createTableSql,
      selectColumnsSql: options.selectColumnsSql,
      recreateIndexesSql: options.recreateIndexesSql,
    }));
    console.log(options.rebuiltLog);
  }
}

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
  ensureTaskTableConstraintOrRebuild(database, {
    tableName: 'worker_tasks',
    insertSql: "(id, task_type, input_json, status, worker, created_at, updated_at) VALUES ('__migration_test__', 'extract_tasks', '{}', 'pending', 'lifeos', '', '')",
    createTableSql: WORKER_TASK_TABLE_COLUMNS_SQL,
    selectColumnsSql: `        id,
        ${normalizeLegacyTaskTypeSql()},
        input_json, status, worker, created_at, updated_at,
        started_at, finished_at, error, result_summary, source_note_id, output_note_paths, schedule_id`,
    recreateIndexesSql: WORKER_TASK_INDEXES_SQL,
    rebuildingLog: 'Migration: rebuilding worker_tasks table with latest task_type CHECK constraint...',
    rebuiltLog: 'Migration: worker_tasks table rebuilt with latest task types',
  });

  ensureTaskTableConstraintOrRebuild(database, {
    tableName: 'task_schedules',
    insertSql: "(id, task_type, input_json, cron_expression, label, enabled, created_at, updated_at) VALUES ('__migration_test__', 'extract_tasks', '{}', '0 9 * * *', 'test', 1, '', '')",
    createTableSql: TASK_SCHEDULE_TABLE_COLUMNS_SQL,
    selectColumnsSql: `        id,
        ${normalizeLegacyTaskTypeSql()},
        input_json, cron_expression, label, enabled, created_at, updated_at,
        last_run_at, last_task_id, consecutive_failures, last_error`,
    recreateIndexesSql: TASK_SCHEDULE_INDEXES_SQL,
    rebuildingLog: 'Migration: rebuilding task_schedules table with latest task_type CHECK constraint...',
    rebuiltLog: 'Migration: task_schedules table rebuilt with latest task types',
  });

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
