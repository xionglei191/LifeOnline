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
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL CHECK(task_type IN ('openclaw_task', 'summarize_note', 'classify_inbox', 'daily_report', 'weekly_report')),
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

CREATE INDEX IF NOT EXISTS idx_worker_tasks_status ON worker_tasks(status);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_type ON worker_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_created_at ON worker_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_source_note_id ON worker_tasks(source_note_id);

CREATE TABLE IF NOT EXISTS task_schedules (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL CHECK(task_type IN ('openclaw_task', 'summarize_note', 'classify_inbox', 'daily_report', 'weekly_report')),
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

CREATE INDEX IF NOT EXISTS idx_task_schedules_enabled ON task_schedules(enabled);

CREATE TABLE IF NOT EXISTS ai_prompts (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_enabled ON ai_prompts(enabled);

CREATE TABLE IF NOT EXISTS ai_provider_settings (
  id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_settings_enabled ON ai_provider_settings(enabled);
`;
