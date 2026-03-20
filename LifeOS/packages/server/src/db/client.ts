import Database from 'better-sqlite3';
import { SCHEMA, WORKER_TASK_TABLE_COLUMNS_SQL, WORKER_TASK_INDEXES_SQL, TASK_SCHEDULE_TABLE_COLUMNS_SQL, TASK_SCHEDULE_INDEXES_SQL, SOUL_ACTION_TABLE_COLUMNS_SQL, SOUL_ACTION_INDEXES_SQL, PERSONA_SNAPSHOT_TABLE_COLUMNS_SQL, PERSONA_SNAPSHOT_INDEXES_SQL, REINTEGRATION_RECORD_TABLE_COLUMNS_SQL, REINTEGRATION_RECORD_INDEXES_SQL, EVENT_NODE_TABLE_COLUMNS_SQL, EVENT_NODE_INDEXES_SQL, CONTINUITY_RECORD_TABLE_COLUMNS_SQL, CONTINUITY_RECORD_INDEXES_SQL } from './schema.js';
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
  const legacyRows = database.prepare(`SELECT COUNT(*) as total FROM ${options.tableName} WHERE task_type = 'collect_trending_news'`).get() as { total: number };
  if (legacyRows.total > 0) {
    console.log(options.rebuildingLog);
    database.exec(rebuildTableWithNormalizedTaskType({
      tableName: options.tableName,
      createTableSql: options.createTableSql,
      selectColumnsSql: options.selectColumnsSql,
      recreateIndexesSql: options.recreateIndexesSql,
    }));
    console.log(options.rebuiltLog);
    return;
  }

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

function ensureSoulActionsTable(database: Database.Database): void {
  const tableSql = `CREATE TABLE IF NOT EXISTS soul_actions (\n${SOUL_ACTION_TABLE_COLUMNS_SQL}\n);`;
  const indexesSql = SOUL_ACTION_INDEXES_SQL;
  const columns = database.prepare("PRAGMA table_info(soul_actions)").all() as Array<{ name: string }>;

  if (columns.length === 0) {
    database.exec(`${tableSql}\n${indexesSql}`);
    return;
  }

  const requiredColumns = [
    'id',
    'source_note_id',
    'action_kind',
    'governance_status',
    'execution_status',
    'governance_reason',
    'worker_task_id',
    'created_at',
    'updated_at',
    'approved_at',
    'deferred_at',
    'discarded_at',
    'started_at',
    'finished_at',
    'error',
    'result_summary',
  ];

  const hasLegacyStatusOnly = columns.some((column) => column.name === 'status')
    && !columns.some((column) => column.name === 'governance_status')
    && !columns.some((column) => column.name === 'execution_status');
  const needsRebuild = hasLegacyStatusOnly || requiredColumns.some((name) => !columns.some((column) => column.name === name));
  if (!needsRebuild) {
    database.exec(indexesSql);
    return;
  }

  console.log('Migration: rebuilding soul_actions table with latest schema...');
  database.exec(`
    CREATE TABLE soul_actions_new (
${SOUL_ACTION_TABLE_COLUMNS_SQL}
    );
    INSERT INTO soul_actions_new (
      id, source_note_id, action_kind, governance_status, execution_status, governance_reason,
      worker_task_id, created_at, updated_at, approved_at, deferred_at, discarded_at,
      started_at, finished_at, error, result_summary
    )
    SELECT
      id,
      source_note_id,
      action_kind,
      'approved',
      CASE
        WHEN status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled') THEN status
        ELSE 'not_dispatched'
      END,
      NULL,
      worker_task_id,
      created_at,
      updated_at,
      created_at,
      NULL,
      NULL,
      started_at,
      finished_at,
      error,
      result_summary
    FROM soul_actions;
    DROP TABLE soul_actions;
    ALTER TABLE soul_actions_new RENAME TO soul_actions;
    ${indexesSql}
  `);
  console.log('Migration: soul_actions table rebuilt with latest schema');
}

function ensurePersonaSnapshotsTable(database: Database.Database): void {
  const tableSql = `CREATE TABLE IF NOT EXISTS persona_snapshots (\n${PERSONA_SNAPSHOT_TABLE_COLUMNS_SQL}\n);`;
  const indexesSql = PERSONA_SNAPSHOT_INDEXES_SQL;
  const columns = database.prepare("PRAGMA table_info(persona_snapshots)").all() as Array<{ name: string }>;

  if (columns.length === 0) {
    database.exec(`${tableSql}\n${indexesSql}`);
    return;
  }

  const requiredColumns = [
    'id',
    'source_note_id',
    'soul_action_id',
    'worker_task_id',
    'summary',
    'snapshot_json',
    'created_at',
    'updated_at',
  ];

  const needsRebuild = requiredColumns.some((name) => !columns.some((column) => column.name === name));
  if (!needsRebuild) {
    database.exec(indexesSql);
    return;
  }

  console.log('Migration: rebuilding persona_snapshots table with latest schema...');
  database.exec(`
    DROP TABLE persona_snapshots;
    ${tableSql}
    ${indexesSql}
  `);
  console.log('Migration: persona_snapshots table rebuilt with latest schema');
}

function ensureReintegrationRecordsTable(database: Database.Database): void {
  const tableSql = `CREATE TABLE IF NOT EXISTS reintegration_records (\n${REINTEGRATION_RECORD_TABLE_COLUMNS_SQL}\n);`;
  const indexesSql = REINTEGRATION_RECORD_INDEXES_SQL;
  const columns = database.prepare("PRAGMA table_info(reintegration_records)").all() as Array<{ name: string }>;

  if (columns.length === 0) {
    database.exec(`${tableSql}\n${indexesSql}`);
    return;
  }

  const requiredColumns = [
    'id',
    'worker_task_id',
    'source_note_id',
    'soul_action_id',
    'task_type',
    'terminal_status',
    'signal_kind',
    'review_status',
    'target',
    'strength',
    'summary',
    'evidence_json',
    'review_reason',
    'created_at',
    'updated_at',
    'reviewed_at',
  ];

  const needsRebuild = requiredColumns.some((name) => !columns.some((column) => column.name === name));
  if (!needsRebuild) {
    database.exec(indexesSql);
    return;
  }

  console.log('Migration: rebuilding reintegration_records table with latest schema...');
  database.exec(`
    DROP TABLE reintegration_records;
    ${tableSql}
    ${indexesSql}
  `);
  console.log('Migration: reintegration_records table rebuilt with latest schema');
}

function ensureEventNodesTable(database: Database.Database): void {
  const tableSql = `CREATE TABLE IF NOT EXISTS event_nodes (\n${EVENT_NODE_TABLE_COLUMNS_SQL}\n);`;
  const indexesSql = EVENT_NODE_INDEXES_SQL;
  const columns = database.prepare("PRAGMA table_info(event_nodes)").all() as Array<{ name: string }>;

  if (columns.length === 0) {
    database.exec(`${tableSql}\n${indexesSql}`);
    return;
  }

  const requiredColumns = [
    'id', 'source_reintegration_id', 'source_note_id', 'source_soul_action_id', 'promotion_soul_action_id',
    'event_kind', 'title', 'summary', 'threshold', 'status', 'evidence_json', 'explanation_json',
    'occurred_at', 'created_at', 'updated_at',
  ];

  const needsRebuild = requiredColumns.some((name) => !columns.some((column) => column.name === name));
  if (!needsRebuild) {
    database.exec(indexesSql);
    return;
  }

  console.log('Migration: rebuilding event_nodes table with latest schema...');
  database.exec(`
    DROP TABLE event_nodes;
    ${tableSql}
    ${indexesSql}
  `);
  console.log('Migration: event_nodes table rebuilt with latest schema');
}

function ensureContinuityRecordsTable(database: Database.Database): void {
  const tableSql = `CREATE TABLE IF NOT EXISTS continuity_records (\n${CONTINUITY_RECORD_TABLE_COLUMNS_SQL}\n);`;
  const indexesSql = CONTINUITY_RECORD_INDEXES_SQL;
  const columns = database.prepare("PRAGMA table_info(continuity_records)").all() as Array<{ name: string }>;

  if (columns.length === 0) {
    database.exec(`${tableSql}\n${indexesSql}`);
    return;
  }

  const requiredColumns = [
    'id', 'source_reintegration_id', 'source_note_id', 'source_soul_action_id', 'promotion_soul_action_id',
    'continuity_kind', 'target', 'strength', 'summary', 'continuity_json', 'evidence_json', 'explanation_json',
    'recorded_at', 'created_at', 'updated_at',
  ];

  const needsRebuild = requiredColumns.some((name) => !columns.some((column) => column.name === name));
  if (!needsRebuild) {
    database.exec(indexesSql);
    return;
  }

  console.log('Migration: rebuilding continuity_records table with latest schema...');
  database.exec(`
    DROP TABLE continuity_records;
    ${tableSql}
    ${indexesSql}
  `);
  console.log('Migration: continuity_records table rebuilt with latest schema');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
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

  ensureSoulActionsTable(database);
  ensurePersonaSnapshotsTable(database);
  ensureReintegrationRecordsTable(database);
  ensureEventNodesTable(database);
  ensureContinuityRecordsTable(database);

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
  console.log('Database path:', getDbPath());
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
