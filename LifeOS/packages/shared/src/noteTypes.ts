// ── Note Types ─────────────────────────────────────────

import type { NoteType, Dimension, Status, Priority, Privacy, Source, ApprovalStatus } from './core.js';

export interface Frontmatter {
  type: NoteType;
  dimension: Dimension;
  status: Status;
  priority?: Priority;
  privacy: Privacy;
  date: string;
  due?: string;
  tags?: string[];
  source: Source;
  created: string;
  updated?: string;
  approval_status?: ApprovalStatus | null;
  approval_operation?: string | null;
  approval_action?: string | null;
  approval_risk?: string | null;
  approval_scope?: string | null;
}

export interface Note extends Frontmatter {
  id: string;
  file_path: string;
  file_name: string;
  title?: string | null;
  encrypted?: boolean;
  content: string;
  indexed_at: string;
  file_modified_at: string;
}

export interface UpdateNoteRequest {
  status?: Status;
  priority?: Priority;
  tags?: string[];
  approval_status?: ApprovalStatus;
}

export interface UpdateNoteResponse {
  success: true;
}

export interface CreateNoteRequest {
  title: string;
  dimension: Dimension;
  type?: NoteType;
  content?: string;
  priority?: Priority;
  tags?: string[];
}

export interface CreateNoteResponse {
  success: true;
  filePath: string;
}

export interface SearchResult {
  notes: Note[];
  total: number;
  query: string;
  filters: {
    q: string;
  };
}

export interface Config {
  vaultPath: string;
  port: number;
}

export interface UpdateConfigRequest {
  vaultPath: string;
}

export interface UpdateConfigResponse {
  success: true;
  indexResult: IndexResult | null;
}

export interface IndexStatus {
  queueSize: number;
  processing: boolean;
  processingFile: string | null;
}

export interface IndexResult {
  total: number;
  indexed: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

export type IndexOperation = 'upsert' | 'delete';

export interface IndexErrorEventData {
  filePath: string;
  operation: IndexOperation;
  error: string;
  timestamp: string;
}

// ── Dashboard / View Types ─────────────────────────────

export interface DimensionStat {
  dimension: Dimension;
  total: number;
  pending: number;
  in_progress: number;
  done: number;
  health_score: number;
}

export interface DashboardData {
  todayTodos: Note[];
  weeklyHighlights: Note[];
  dimensionStats: DimensionStat[];
  inboxCount: number;
}

export interface TimelineTrack {
  dimension: Dimension;
  notes: Note[];
}

export interface TimelineData {
  startDate: string;
  endDate: string;
  tracks: TimelineTrack[];
}

export interface CalendarDay {
  date: string;
  notes: Note[];
  count: number;
}

export interface CalendarData {
  year: number;
  month: number;
  days: CalendarDay[];
}

// ── Stats Types ────────────────────────────────────────

export interface StatsTrendPoint {
  day: string;
  total: number;
  done: number;
}

export interface StatsRadarPoint {
  dimension: string;
  rate: number;
  total: number;
  done: number;
}

export interface StatsMonthlyPoint {
  month: string;
  total: number;
  done: number;
}

export interface StatsTagPoint {
  tag: string;
  count: number;
}

export interface FailingScheduleHealthItem {
  id: string;
  label: string;
  consecutiveFailures: number;
  lastError: string | null;
}

export interface ScheduleHealth {
  total: number;
  active: number;
  failing: number;
  failingSchedules: FailingScheduleHealthItem[];
}
