/**
 * cognitiveHealth.ts
 *
 * Aggregates data health metrics across the 5 core cognitive objects:
 * BrainstormSessions, SoulActions, ReintegrationRecords, EventNodes, ContinuityRecords.
 *
 * Called by GET /api/cognitive-health
 */
import { getDb } from '../db/client.js';

export interface CognitiveObjectHealth {
  name: string;
  total: number;
  recent24h: number | null;      // new items in last 24h (null if not applicable)
  distilledRatio: number | null; // distilled/total ratio (null if not applicable)
  pendingReview: number | null;  // items pending review (null if not applicable)
  successRate: number | null;    // execution success rate (null if not applicable)
  latestUpdatedAt: string | null;
}

export interface CognitiveHealthReport {
  generatedAt: string;
  objects: CognitiveObjectHealth[];
}

export function getCognitiveHealth(): CognitiveHealthReport {
  const db = getDb();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // ── BrainstormSessions ───────────────────────────────
  const bsTotal = (db.prepare('SELECT COUNT(*) as c FROM brainstorm_sessions').get() as { c: number }).c;
  const bsRecent = (db.prepare('SELECT COUNT(*) as c FROM brainstorm_sessions WHERE created_at >= ?').get(yesterday) as { c: number }).c;
  const bsDistilled = (db.prepare("SELECT COUNT(*) as c FROM brainstorm_sessions WHERE status = 'distilled'").get() as { c: number }).c;
  const bsLatest = (db.prepare('SELECT updated_at FROM brainstorm_sessions ORDER BY updated_at DESC LIMIT 1').get() as { updated_at: string } | undefined)?.updated_at ?? null;

  // ── SoulActions ──────────────────────────────────────
  const saTotal = (db.prepare('SELECT COUNT(*) as c FROM soul_actions').get() as { c: number }).c;
  const saPending = (db.prepare("SELECT COUNT(*) as c FROM soul_actions WHERE governance_status = 'pending_review'").get() as { c: number }).c;
  const saSucceeded = (db.prepare("SELECT COUNT(*) as c FROM soul_actions WHERE execution_status = 'succeeded'").get() as { c: number }).c;
  const saDispatched = (db.prepare("SELECT COUNT(*) as c FROM soul_actions WHERE execution_status != 'not_dispatched'").get() as { c: number }).c;
  const saLatest = (db.prepare('SELECT updated_at FROM soul_actions ORDER BY updated_at DESC LIMIT 1').get() as { updated_at: string } | undefined)?.updated_at ?? null;

  // ── ReintegrationRecords ─────────────────────────────
  const rrTotal = (db.prepare('SELECT COUNT(*) as c FROM reintegration_records').get() as { c: number }).c;
  const rrPending = (db.prepare("SELECT COUNT(*) as c FROM reintegration_records WHERE review_status = 'pending_review'").get() as { c: number }).c;
  const rrAccepted = (db.prepare("SELECT COUNT(*) as c FROM reintegration_records WHERE review_status = 'accepted'").get() as { c: number }).c;
  const rrLatest = (db.prepare('SELECT updated_at FROM reintegration_records ORDER BY updated_at DESC LIMIT 1').get() as { updated_at: string } | undefined)?.updated_at ?? null;

  // ── EventNodes ───────────────────────────────────────
  const enTotal = (db.prepare('SELECT COUNT(*) as c FROM event_nodes').get() as { c: number }).c;
  const enLatest = (db.prepare('SELECT updated_at FROM event_nodes ORDER BY updated_at DESC LIMIT 1').get() as { updated_at: string } | undefined)?.updated_at ?? null;

  // ── ContinuityRecords ────────────────────────────────
  const crTotal = (db.prepare('SELECT COUNT(*) as c FROM continuity_records').get() as { c: number }).c;
  const crLatest = (db.prepare('SELECT updated_at FROM continuity_records ORDER BY updated_at DESC LIMIT 1').get() as { updated_at: string } | undefined)?.updated_at ?? null;

  return {
    generatedAt: now.toISOString(),
    objects: [
      {
        name: 'brainstorm_sessions',
        total: bsTotal,
        recent24h: bsRecent,
        distilledRatio: bsTotal > 0 ? parseFloat((bsDistilled / bsTotal).toFixed(2)) : null,
        pendingReview: null,
        successRate: null,
        latestUpdatedAt: bsLatest,
      },
      {
        name: 'soul_actions',
        total: saTotal,
        recent24h: null,
        distilledRatio: null,
        pendingReview: saPending,
        successRate: saDispatched > 0 ? parseFloat((saSucceeded / saDispatched).toFixed(2)) : null,
        latestUpdatedAt: saLatest,
      },
      {
        name: 'reintegration_records',
        total: rrTotal,
        recent24h: null,
        distilledRatio: null,
        pendingReview: rrPending,
        successRate: rrTotal > 0 ? parseFloat((rrAccepted / rrTotal).toFixed(2)) : null,
        latestUpdatedAt: rrLatest,
      },
      {
        name: 'event_nodes',
        total: enTotal,
        recent24h: null,
        distilledRatio: null,
        pendingReview: null,
        successRate: null,
        latestUpdatedAt: enLatest,
      },
      {
        name: 'continuity_records',
        total: crTotal,
        recent24h: null,
        distilledRatio: null,
        pendingReview: null,
        successRate: null,
        latestUpdatedAt: crLatest,
      },
    ],
  };
}
