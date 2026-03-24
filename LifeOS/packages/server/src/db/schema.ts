import { SUPPORTED_WORKER_NAMES, SUPPORTED_WORKER_TASK_TYPES } from '@lifeos/shared';

export const SUPPORTED_WORKER_TASK_TYPES_SQL = SUPPORTED_WORKER_TASK_TYPES.map((taskType) => `'${taskType}'`).join(', ');
export const SUPPORTED_WORKER_NAMES_SQL = SUPPORTED_WORKER_NAMES.map((workerName) => `'${workerName}'`).join(', ');

export const WORKER_TASK_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL CHECK(task_type IN (${SUPPORTED_WORKER_TASK_TYPES_SQL})),
  input_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  worker TEXT NOT NULL CHECK(worker IN (${SUPPORTED_WORKER_NAMES_SQL})),
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
  schedule_id TEXT`;

export const WORKER_TASK_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_worker_tasks_status ON worker_tasks(status);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_type ON worker_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_created_at ON worker_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_source_note_id ON worker_tasks(source_note_id);`;

export const TASK_SCHEDULE_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL CHECK(task_type IN (${SUPPORTED_WORKER_TASK_TYPES_SQL})),
  input_json TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  last_task_id TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT`;

export const TASK_SCHEDULE_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_task_schedules_enabled ON task_schedules(enabled);`;

export const SOUL_ACTION_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
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
  UNIQUE(source_note_id, action_kind, source_reintegration_id),
  UNIQUE(worker_task_id)`;

export const SOUL_ACTION_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_soul_actions_source_note_id ON soul_actions(source_note_id);
CREATE INDEX IF NOT EXISTS idx_soul_actions_governance_status ON soul_actions(governance_status);
CREATE INDEX IF NOT EXISTS idx_soul_actions_execution_status ON soul_actions(execution_status);
CREATE INDEX IF NOT EXISTS idx_soul_actions_created_at ON soul_actions(created_at);`;

export const PERSONA_SNAPSHOT_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  source_note_id TEXT NOT NULL UNIQUE,
  soul_action_id TEXT,
  worker_task_id TEXT,
  summary TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL`;

export const PERSONA_SNAPSHOT_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_persona_snapshots_source_note_id ON persona_snapshots(source_note_id);
CREATE INDEX IF NOT EXISTS idx_persona_snapshots_worker_task_id ON persona_snapshots(worker_task_id);
CREATE INDEX IF NOT EXISTS idx_persona_snapshots_updated_at ON persona_snapshots(updated_at);`;

export const REINTEGRATION_RECORD_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  worker_task_id TEXT NOT NULL UNIQUE,
  source_note_id TEXT,
  soul_action_id TEXT,
  task_type TEXT NOT NULL CHECK(task_type IN ('summarize_note', 'classify_inbox', 'extract_tasks', 'update_persona_snapshot', 'daily_report', 'weekly_report', 'openclaw_task')),
  terminal_status TEXT NOT NULL CHECK(terminal_status IN ('succeeded', 'failed', 'cancelled')),
  signal_kind TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK(review_status IN ('pending_review', 'accepted', 'rejected')),
  target TEXT NOT NULL CHECK(target IN ('source_note', 'derived_outputs', 'task_record')),
  strength TEXT NOT NULL CHECK(strength IN ('low', 'medium')),
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  review_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT`;

export const REINTEGRATION_RECORD_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_reintegration_records_review_status ON reintegration_records(review_status);
CREATE INDEX IF NOT EXISTS idx_reintegration_records_signal_kind ON reintegration_records(signal_kind);
CREATE INDEX IF NOT EXISTS idx_reintegration_records_source_note_id ON reintegration_records(source_note_id);
CREATE INDEX IF NOT EXISTS idx_reintegration_records_created_at ON reintegration_records(created_at);`;

export const EVENT_NODE_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  source_reintegration_id TEXT NOT NULL UNIQUE,
  source_note_id TEXT,
  source_soul_action_id TEXT,
  promotion_soul_action_id TEXT NOT NULL UNIQUE,
  event_kind TEXT NOT NULL CHECK(event_kind IN ('weekly_reflection', 'persona_shift', 'milestone_report')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  threshold TEXT NOT NULL CHECK(threshold IN ('high')),
  status TEXT NOT NULL CHECK(status IN ('active')),
  evidence_json TEXT NOT NULL,
  explanation_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL`;

export const EVENT_NODE_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_event_nodes_source_note_id ON event_nodes(source_note_id);
CREATE INDEX IF NOT EXISTS idx_event_nodes_event_kind ON event_nodes(event_kind);
CREATE INDEX IF NOT EXISTS idx_event_nodes_created_at ON event_nodes(created_at);`;

export const CONTINUITY_RECORD_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  source_reintegration_id TEXT NOT NULL UNIQUE,
  source_note_id TEXT,
  source_soul_action_id TEXT,
  promotion_soul_action_id TEXT NOT NULL UNIQUE,
  continuity_kind TEXT NOT NULL CHECK(continuity_kind IN ('persona_direction', 'daily_rhythm', 'weekly_theme')),
  target TEXT NOT NULL CHECK(target IN ('source_note', 'derived_outputs', 'task_record')),
  strength TEXT NOT NULL CHECK(strength IN ('medium')),
  summary TEXT NOT NULL,
  continuity_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  explanation_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL`;

export const CONTINUITY_RECORD_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_continuity_records_source_note_id ON continuity_records(source_note_id);
CREATE INDEX IF NOT EXISTS idx_continuity_records_continuity_kind ON continuity_records(continuity_kind);
CREATE INDEX IF NOT EXISTS idx_continuity_records_created_at ON continuity_records(created_at);`;

export const GATE_DECISION_TABLE_COLUMNS_SQL = `  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_kind TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approved', 'deferred', 'discarded')),
  created_at TEXT NOT NULL`;

export const GATE_DECISION_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_gate_decisions_action_kind ON gate_decisions(action_kind);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_created_at ON gate_decisions(created_at);`;

export const BRAINSTORM_SESSION_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  source_note_id TEXT NOT NULL,
  raw_input_preview TEXT NOT NULL,
  themes_json TEXT NOT NULL DEFAULT '[]',
  emotional_tone TEXT NOT NULL DEFAULT '',
  extracted_questions_json TEXT NOT NULL DEFAULT '[]',
  ambiguity_points_json TEXT NOT NULL DEFAULT '[]',
  distilled_insights_json TEXT NOT NULL DEFAULT '[]',
  suggested_action_kinds_json TEXT NOT NULL DEFAULT '[]',
  actionability REAL NOT NULL DEFAULT 0,
  continuity_signals_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('parsed', 'distilled')) DEFAULT 'parsed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL`;

export const BRAINSTORM_SESSION_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_brainstorm_sessions_source_note_id ON brainstorm_sessions(source_note_id);
CREATE INDEX IF NOT EXISTS idx_brainstorm_sessions_created_at ON brainstorm_sessions(created_at);`;

export const AI_PROVIDER_SETTINGS_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL`;

export const AI_PROVIDER_SETTINGS_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_ai_provider_settings_enabled ON ai_provider_settings(enabled);`;

export const SCHEMA_VERSION_TABLE_COLUMNS_SQL = `  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL`;

export const AI_USAGE_TABLE_COLUMNS_SQL = `  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0`;

export const AI_USAGE_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date);`;

export const PHYSICAL_ACTION_TABLE_COLUMNS_SQL = `  id TEXT PRIMARY KEY,
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
  executed_at TEXT`;

export const PHYSICAL_ACTION_INDEXES_SQL = `CREATE INDEX IF NOT EXISTS idx_physical_actions_status ON physical_actions(status);
CREATE INDEX IF NOT EXISTS idx_physical_actions_type ON physical_actions(type);
CREATE INDEX IF NOT EXISTS idx_physical_actions_created ON physical_actions(created_at);`;

export const INTEGRATION_CREDENTIALS_TABLE_COLUMNS_SQL = `  provider TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TEXT,
  scopes TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL`;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  file_path TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  title TEXT,

  type TEXT NOT NULL CHECK(type IN ('schedule', 'task', 'note', 'record', 'milestone', 'review')),
  dimension TEXT NOT NULL CHECK(dimension IN ('health', 'career', 'finance', 'learning', 'relationship', 'life', 'hobby', 'growth', '_inbox')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
  privacy TEXT NOT NULL CHECK(privacy IN ('public', 'private', 'sensitive')),
  date TEXT NOT NULL,
  due TEXT,
  tags TEXT,
  source TEXT NOT NULL CHECK(source IN ('lingguang', 'desktop', 'webclipper', 'openclaw', 'web', 'auto')),
  created TEXT NOT NULL,
  updated TEXT,

  content TEXT,
  indexed_at TEXT NOT NULL,
  file_modified_at TEXT NOT NULL,

  -- OpenClaw approval fields
  approval_status TEXT,
  approval_operation TEXT,
  approval_action TEXT,
  approval_risk TEXT,
  approval_scope TEXT,

  -- Inbox dedup: original filename before classification
  inbox_origin TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_dimension ON notes(dimension);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
CREATE INDEX IF NOT EXISTS idx_notes_due ON notes(due);

CREATE TABLE IF NOT EXISTS worker_tasks (
${WORKER_TASK_TABLE_COLUMNS_SQL}
);

${WORKER_TASK_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS task_schedules (
${TASK_SCHEDULE_TABLE_COLUMNS_SQL}
);

${TASK_SCHEDULE_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS soul_actions (
${SOUL_ACTION_TABLE_COLUMNS_SQL}
);

${SOUL_ACTION_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS persona_snapshots (
${PERSONA_SNAPSHOT_TABLE_COLUMNS_SQL}
);

${PERSONA_SNAPSHOT_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS reintegration_records (
${REINTEGRATION_RECORD_TABLE_COLUMNS_SQL}
);

${REINTEGRATION_RECORD_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS event_nodes (
${EVENT_NODE_TABLE_COLUMNS_SQL}
);

${EVENT_NODE_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS continuity_records (
${CONTINUITY_RECORD_TABLE_COLUMNS_SQL}
);

${CONTINUITY_RECORD_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS gate_decisions (
${GATE_DECISION_TABLE_COLUMNS_SQL}
);

${GATE_DECISION_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS ai_prompts (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_enabled ON ai_prompts(enabled);

CREATE TABLE IF NOT EXISTS ai_provider_settings (
${AI_PROVIDER_SETTINGS_TABLE_COLUMNS_SQL}
);

${AI_PROVIDER_SETTINGS_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS schema_version (
${SCHEMA_VERSION_TABLE_COLUMNS_SQL}
);

CREATE TABLE IF NOT EXISTS ai_usage (
${AI_USAGE_TABLE_COLUMNS_SQL}
);

${AI_USAGE_INDEXES_SQL}

CREATE TABLE IF NOT EXISTS brainstorm_sessions (
${BRAINSTORM_SESSION_TABLE_COLUMNS_SQL}
);

${BRAINSTORM_SESSION_INDEXES_SQL}
`;
