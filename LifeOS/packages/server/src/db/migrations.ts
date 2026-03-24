/**
 * Database migration logic.
 *
 * Extracted from client.ts to keep connection management separate from schema evolution.
 *
 * Design rules:
 * - Tables are first created via the central SCHEMA template (IF NOT EXISTS).
 * - Migrations here handle schema evolution for existing databases:
 *   ADD COLUMN for additive changes, safe table rebuilds for constraint changes.
 * - Destructive DROP TABLE is avoided — data-preserving migrations are used instead.
 */

import type { Database } from 'better-sqlite3';
import {
  WORKER_TASK_TABLE_COLUMNS_SQL,
  WORKER_TASK_INDEXES_SQL,
  TASK_SCHEDULE_TABLE_COLUMNS_SQL,
  TASK_SCHEDULE_INDEXES_SQL,
  SOUL_ACTION_TABLE_COLUMNS_SQL,
  SOUL_ACTION_INDEXES_SQL,
  PERSONA_SNAPSHOT_TABLE_COLUMNS_SQL,
  PERSONA_SNAPSHOT_INDEXES_SQL,
  REINTEGRATION_RECORD_TABLE_COLUMNS_SQL,
  REINTEGRATION_RECORD_INDEXES_SQL,
  EVENT_NODE_TABLE_COLUMNS_SQL,
  EVENT_NODE_INDEXES_SQL,
  CONTINUITY_RECORD_TABLE_COLUMNS_SQL,
  CONTINUITY_RECORD_INDEXES_SQL,
  GATE_DECISION_TABLE_COLUMNS_SQL,
  GATE_DECISION_INDEXES_SQL,
  BRAINSTORM_SESSION_TABLE_COLUMNS_SQL,
  BRAINSTORM_SESSION_INDEXES_SQL,
  AI_PROVIDER_SETTINGS_TABLE_COLUMNS_SQL,
  AI_PROVIDER_SETTINGS_INDEXES_SQL,
} from './schema.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('migrations');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTableColumns(database: Database, tableName: string): Array<{ name: string }> {
  return database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
}

function hasColumn(columns: Array<{ name: string }>, name: string): boolean {
  return columns.some((c) => c.name === name);
}

function addColumnIfMissing(
  database: Database,
  tableName: string,
  columns: Array<{ name: string }>,
  columnName: string,
  columnDef: string,
): void {
  if (!hasColumn(columns, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    logger.info(`Migration: added ${columnName} column to ${tableName}`);
  }
}

function getCreateTableSql(database: Database, tableName: string): string {
  const row = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(tableName) as { sql?: string } | undefined;
  return row?.sql ?? '';
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

// ---------------------------------------------------------------------------
// Safe table rebuild — preserves data by migrating common columns
// ---------------------------------------------------------------------------

/**
 * Rebuild a table while preserving all data in columns that exist in both
 * the old and new schema.  This replaces the old destructive DROP TABLE
 * approach that silently discarded data.
 */
function safeRebuildTable(
  database: Database,
  tableName: string,
  columnsSQL: string,
  indexesSQL: string,
  existingColumns: Array<{ name: string }>,
): void {
  const tmpTable = `${tableName}_new`;
  database.exec(`CREATE TABLE ${tmpTable} (\n${columnsSQL}\n);`);

  // Discover which columns the NEW table has
  const newColumns = getTableColumns(database, tmpTable);
  // Intersect with old — only migrate columns that exist in both tables
  const commonColumns = newColumns
    .map((c) => c.name)
    .filter((name) => existingColumns.some((ec) => ec.name === name));

  if (commonColumns.length > 0) {
    const columnList = commonColumns.join(', ');
    database.exec(`INSERT INTO ${tmpTable} (${columnList}) SELECT ${columnList} FROM ${tableName};`);
  }

  database.exec(`DROP TABLE ${tableName};`);
  database.exec(`ALTER TABLE ${tmpTable} RENAME TO ${tableName};`);
  database.exec(indexesSQL);
}

// ---------------------------------------------------------------------------
// Individual table migrations
// ---------------------------------------------------------------------------

function ensureTaskTableConstraintOrRebuild(database: Database, options: {
  tableName: 'worker_tasks' | 'task_schedules';
  insertSql: string;
  createTableSql: string;
  selectColumnsSql: string;
  recreateIndexesSql: string;
  rebuildingLog: string;
  rebuiltLog: string;
}): void {
  const legacyRows = database.prepare(
    `SELECT COUNT(*) as total FROM ${options.tableName} WHERE task_type = 'collect_trending_news'`,
  ).get() as { total: number };

  if (legacyRows.total > 0) {
    logger.info(options.rebuildingLog!);
    database.exec(rebuildTableWithNormalizedTaskType({
      tableName: options.tableName,
      createTableSql: options.createTableSql,
      selectColumnsSql: options.selectColumnsSql,
      recreateIndexesSql: options.recreateIndexesSql,
    }));
    logger.info(options.rebuiltLog!);
    return;
  }

  try {
    database.exec(`INSERT INTO ${options.tableName} ${options.insertSql}`);
    database.exec(`DELETE FROM ${options.tableName} WHERE id = '__migration_test__'`);
  } catch {
    logger.info(options.rebuildingLog!);
    database.exec(rebuildTableWithNormalizedTaskType({
      tableName: options.tableName,
      createTableSql: options.createTableSql,
      selectColumnsSql: options.selectColumnsSql,
      recreateIndexesSql: options.recreateIndexesSql,
    }));
    logger.info(options.rebuiltLog!);
  }
}

function ensureSoulActionsTable(database: Database): void {
  const columns = getTableColumns(database, 'soul_actions');
  if (columns.length === 0) {
    database.exec(`CREATE TABLE IF NOT EXISTS soul_actions (\n${SOUL_ACTION_TABLE_COLUMNS_SQL}\n);\n${SOUL_ACTION_INDEXES_SQL}`);
    return;
  }

  const requiredColumns = [
    'id', 'source_note_id', 'source_reintegration_id', 'action_kind',
    'governance_status', 'execution_status', 'governance_reason', 'worker_task_id',
    'created_at', 'updated_at', 'approved_at', 'deferred_at', 'discarded_at',
    'started_at', 'finished_at', 'error', 'result_summary',
  ];

  const hasSourceReintegrationIdColumn = hasColumn(columns, 'source_reintegration_id');
  const currentCreateTableSql = getCreateTableSql(database, 'soul_actions');
  const hasLegacyStatusOnly = hasColumn(columns, 'status')
    && !hasColumn(columns, 'governance_status')
    && !hasColumn(columns, 'execution_status');
  const needsRebuild = hasLegacyStatusOnly
    || requiredColumns.some((name) => !hasColumn(columns, name))
    || !currentCreateTableSql.includes('UNIQUE(source_note_id, action_kind, source_reintegration_id)');

  if (!needsRebuild) {
    database.exec(SOUL_ACTION_INDEXES_SQL);
    return;
  }

  logger.info('Migration: rebuilding soul_actions table with latest schema...');
  const executionStatusSelectSql = hasLegacyStatusOnly
    ? `CASE
        WHEN status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled') THEN status
        ELSE 'not_dispatched'
      END`
    : 'execution_status';
  const governanceStatusSelectSql = hasLegacyStatusOnly ? `'approved'` : 'governance_status';
  const approvedAtSelectSql = hasLegacyStatusOnly ? 'created_at' : 'approved_at';
  const sourceReintegrationColumnSql = hasSourceReintegrationIdColumn ? 'source_reintegration_id' : 'NULL';

  database.exec(`
    CREATE TABLE soul_actions_new (
${SOUL_ACTION_TABLE_COLUMNS_SQL}
    );
    INSERT INTO soul_actions_new (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason,
      worker_task_id, created_at, updated_at, approved_at, deferred_at, discarded_at,
      started_at, finished_at, error, result_summary
    )
    SELECT
      id,
      source_note_id,
      CASE
        WHEN action_kind IN ('create_event_node', 'promote_event_node', 'promote_continuity_record') THEN COALESCE(
          ${sourceReintegrationColumnSql},
          CASE
            WHEN source_note_id LIKE 'reint:%' THEN source_note_id
            ELSE NULL
          END
        )
        ELSE ${sourceReintegrationColumnSql}
      END,
      action_kind,
      ${governanceStatusSelectSql},
      ${executionStatusSelectSql},
      governance_reason,
      worker_task_id,
      created_at,
      updated_at,
      ${approvedAtSelectSql},
      deferred_at,
      discarded_at,
      started_at,
      finished_at,
      error,
      result_summary
    FROM soul_actions;
    DROP TABLE soul_actions;
    ALTER TABLE soul_actions_new RENAME TO soul_actions;
    ${SOUL_ACTION_INDEXES_SQL}
  `);
  logger.info('Migration: soul_actions table rebuilt with latest schema');
}

/**
 * Generic safe migration for tables that previously used destructive DROP TABLE.
 * Now preserves existing data by migrating common columns to the new schema.
 */
function ensureTableSafe(
  database: Database,
  tableName: string,
  columnsSQL: string,
  indexesSQL: string,
  requiredColumns: string[],
  extraNeedsRebuild?: (columns: Array<{ name: string }>, createSql: string) => boolean,
): void {
  const columns = getTableColumns(database, tableName);
  if (columns.length === 0) {
    database.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (\n${columnsSQL}\n);\n${indexesSQL}`);
    return;
  }

  const currentCreateSql = getCreateTableSql(database, tableName);
  const missingColumns = requiredColumns.filter((name) => !hasColumn(columns, name));
  const needsConstraintChange = extraNeedsRebuild?.(columns, currentCreateSql) ?? false;

  if (missingColumns.length === 0 && !needsConstraintChange) {
    database.exec(indexesSQL);
    return;
  }

  logger.info(`Migration: rebuilding ${tableName} table with latest schema (preserving data)...`);
  safeRebuildTable(database, tableName, columnsSQL, indexesSQL, columns);
  logger.info(`Migration: ${tableName} table rebuilt with latest schema`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all migrations against an already-initialized database.
 * Called from initDatabase() after the SCHEMA template has been applied.
 */
export function runMigrations(database: Database): void {
  database.pragma('foreign_keys = ON');
  // --- Additive column migrations (ALTER TABLE ADD COLUMN) -----------------

  const workerTaskCols = getTableColumns(database, 'worker_tasks');
  addColumnIfMissing(database, 'worker_tasks', workerTaskCols, 'schedule_id', 'TEXT');
  addColumnIfMissing(database, 'worker_tasks', workerTaskCols, 'source_reintegration_id', 'TEXT');

  const notesCols = getTableColumns(database, 'notes');
  addColumnIfMissing(database, 'notes', notesCols, 'inbox_origin', 'TEXT');

  const schedCols = getTableColumns(database, 'task_schedules');
  addColumnIfMissing(database, 'task_schedules', schedCols, 'consecutive_failures', 'INTEGER DEFAULT 0');
  addColumnIfMissing(database, 'task_schedules', schedCols, 'last_error', 'TEXT');

  const promptCols = getTableColumns(database, 'ai_prompts');
  addColumnIfMissing(database, 'ai_prompts', promptCols, 'notes', 'TEXT');

  // --- Constraint migrations (table rebuild) --------------------------------

  ensureTaskTableConstraintOrRebuild(database, {
    tableName: 'worker_tasks',
    insertSql: "(id, task_type, input_json, status, worker, created_at, updated_at) VALUES ('__migration_test__', 'extract_tasks', '{}', 'pending', 'lifeos', '', '')",
    createTableSql: WORKER_TASK_TABLE_COLUMNS_SQL,
    selectColumnsSql: `        id,
        ${normalizeLegacyTaskTypeSql()},
        input_json, status, worker, created_at, updated_at,
        started_at, finished_at, error, result_json, result_summary, source_note_id, source_reintegration_id, output_note_paths, schedule_id`,
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

  // --- Data-preserving migrations for tables that previously used DROP TABLE ---

  ensureTableSafe(database, 'persona_snapshots', PERSONA_SNAPSHOT_TABLE_COLUMNS_SQL, PERSONA_SNAPSHOT_INDEXES_SQL, [
    'id', 'source_note_id', 'soul_action_id', 'worker_task_id',
    'summary', 'snapshot_json', 'created_at', 'updated_at',
  ]);

  ensureTableSafe(database, 'reintegration_records', REINTEGRATION_RECORD_TABLE_COLUMNS_SQL, REINTEGRATION_RECORD_INDEXES_SQL, [
    'id', 'worker_task_id', 'source_note_id', 'soul_action_id', 'task_type', 'terminal_status',
    'signal_kind', 'review_status', 'target', 'strength', 'summary', 'evidence_json',
    'review_reason', 'created_at', 'updated_at', 'reviewed_at',
  ]);

  ensureTableSafe(database, 'event_nodes', EVENT_NODE_TABLE_COLUMNS_SQL, EVENT_NODE_INDEXES_SQL, [
    'id', 'source_reintegration_id', 'source_note_id', 'source_soul_action_id', 'promotion_soul_action_id',
    'event_kind', 'title', 'summary', 'threshold', 'status', 'evidence_json', 'explanation_json',
    'occurred_at', 'created_at', 'updated_at',
  ]);

  ensureTableSafe(database, 'continuity_records', CONTINUITY_RECORD_TABLE_COLUMNS_SQL, CONTINUITY_RECORD_INDEXES_SQL, [
    'id', 'source_reintegration_id', 'source_note_id', 'source_soul_action_id', 'promotion_soul_action_id',
    'continuity_kind', 'target', 'strength', 'summary', 'continuity_json', 'evidence_json', 'explanation_json',
    'recorded_at', 'created_at', 'updated_at',
  ], (_columns, createSql) => !createSql.includes("'daily_rhythm'"));

  // --- Migration safety net for tables previously without ensureTableSafe ---

  ensureTableSafe(database, 'gate_decisions', GATE_DECISION_TABLE_COLUMNS_SQL, GATE_DECISION_INDEXES_SQL, [
    'id', 'action_kind', 'decision', 'created_at',
  ]);

  ensureTableSafe(database, 'brainstorm_sessions', BRAINSTORM_SESSION_TABLE_COLUMNS_SQL, BRAINSTORM_SESSION_INDEXES_SQL, [
    'id', 'source_note_id', 'raw_input_preview', 'themes_json', 'emotional_tone',
    'extracted_questions_json', 'ambiguity_points_json', 'distilled_insights_json',
    'suggested_action_kinds_json', 'actionability', 'continuity_signals_json',
    'status', 'created_at', 'updated_at',
  ], (_columns, createSql) => !createSql.includes("'distilled'"));

  ensureTableSafe(database, 'ai_provider_settings', AI_PROVIDER_SETTINGS_TABLE_COLUMNS_SQL, AI_PROVIDER_SETTINGS_INDEXES_SQL, [
    'id', 'base_url', 'model', 'api_key', 'enabled', 'updated_at',
  ]);
}

// ---------------------------------------------------------------------------
// Ordered Versioned Migrations
// ---------------------------------------------------------------------------

interface Migration {
  version: number;
  up: (db: Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      // The basic ai_usage table and index.
      // Note: this might already exist if the DB was freshly created by SCHEMA.
      // Running it again via IF NOT EXISTS is safe.
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date);
      `);
      logger.info('Migration v1 applied: ai_usage table verified.');
    }
  },
  {
    version: 2,
    up: (db) => {
      // FTS5 full-text search index on notes for hybrid search
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
          note_id UNINDEXED,
          title,
          content,
          tags,
          content='',
          tokenize='unicode61'
        );
      `);
      // Populate from existing notes
      const rows = db.prepare('SELECT id, title, content, tags FROM notes').all() as any[];
      const insert = db.prepare('INSERT INTO notes_fts(note_id, title, content, tags) VALUES (?, ?, ?, ?)');
      for (const row of rows) {
        insert.run(row.id, row.title || '', row.content || '', row.tags || '');
      }
      logger.info(`Migration v2 applied: notes_fts created and populated (${rows.length} notes).`);
    }
  },
  {
    version: 3,
    up: (db) => {
      // Phase 3: Physical Actions table
      db.exec(`
        CREATE TABLE IF NOT EXISTS physical_actions (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('calendar_event', 'send_email', 'webhook_call', 'iot_command')),
          status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed')),
          source_soul_action_id TEXT,
          source_note_id TEXT,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          payload_json TEXT NOT NULL,
          approval_policy TEXT NOT NULL DEFAULT 'always_ask' CHECK(approval_policy IN ('always_ask', 'auto_after_first', 'auto_approve')),
          auto_approve_key TEXT,
          execution_log TEXT,
          external_id TEXT,
          error_message TEXT,
          dry_run_preview TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          approved_at TEXT,
          executed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_physical_actions_status ON physical_actions(status);
        CREATE INDEX IF NOT EXISTS idx_physical_actions_type ON physical_actions(type);
        CREATE INDEX IF NOT EXISTS idx_physical_actions_created ON physical_actions(created_at);
      `);
      // Integration credentials (OAuth tokens)
      db.exec(`
        CREATE TABLE IF NOT EXISTS integration_credentials (
          provider TEXT PRIMARY KEY,
          access_token TEXT,
          refresh_token TEXT,
          token_expiry TEXT,
          scopes TEXT,
          metadata_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      logger.info('Migration v3 applied: physical_actions + integration_credentials tables created.');
    }
  }
];

/**
 * Runs the ordered, versioned migrations.
 * Each migration is run inside a transaction.
 */
export function applyVersionedMigrations(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const row = database.prepare('SELECT MAX(version) as max_v FROM schema_version').get() as { max_v: number | null };
  const currentVersion = row?.max_v || 0;

  for (const migration of MIGRATIONS.sort((a, b) => a.version - b.version)) {
    if (migration.version > currentVersion) {
      logger.info(`Applying database migration version ${migration.version}...`);
      database.transaction(() => {
        migration.up(database);
        database.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
          migration.version, new Date().toISOString()
        );
      })();
      logger.info(`Migration version ${migration.version} applied successfully.`);
    }
  }
}

