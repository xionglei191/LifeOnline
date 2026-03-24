import type { SoulActionKind } from './core.js';

// ── BrainstormSession ──────────────────────────────────

export interface BrainstormSession {
  id: string;
  sourceNoteId: string;
  rawInputPreview: string;  // first 500 chars of note content

  // Structured extraction (from cognitive analysis)
  themes: string[];
  emotionalTone: string;
  extractedQuestions: string[];
  ambiguityPoints: string[];
  distilledInsights: string[];

  // Action linkage
  suggestedActionKinds: SoulActionKind[];
  actionability: number;  // 0-1

  // Continuity signals
  continuitySignals: string[];

  status: 'parsed' | 'distilled';
  createdAt: string;
  updatedAt: string;
}

// ── API Response Types ─────────────────────────────────

export interface ListBrainstormSessionsResponse {
  sessions: BrainstormSession[];
  total: number;
}

export interface BrainstormSessionResponse {
  session: BrainstormSession;
}
