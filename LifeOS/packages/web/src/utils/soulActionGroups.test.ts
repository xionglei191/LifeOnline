import { describe, expect, it } from 'vitest';
import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';
import {
  buildSoulActionGroups,
  getSoulActionGroupCount,
  getSoulActionGroupQuickFilterLabel,
  getSoulActionGroupQuickFilterStats,
} from './soulActionGroups';

function createSoulAction(overrides: Partial<SoulAction> & Pick<SoulAction, 'id' | 'sourceNoteId' | 'createdAt'>): SoulAction {
  return {
    id: overrides.id,
    kind: overrides.kind ?? 'promote_event_node',
    title: overrides.title ?? overrides.id,
    summary: overrides.summary ?? null,
    detail: overrides.detail ?? null,
    payload: overrides.payload ?? {},
    governanceStatus: overrides.governanceStatus ?? 'pending_review',
    executionStatus: overrides.executionStatus ?? 'not_dispatched',
    sourceNoteId: overrides.sourceNoteId,
    workerTaskId: overrides.workerTaskId ?? null,
    resultNoteId: overrides.resultNoteId ?? null,
    governanceReason: overrides.governanceReason ?? null,
    reviewComment: overrides.reviewComment ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    approvedAt: overrides.approvedAt ?? null,
    approvedBy: overrides.approvedBy ?? null,
    dispatchedAt: overrides.dispatchedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    errorMessage: overrides.errorMessage ?? null,
  };
}

function createReintegrationRecord(overrides: Partial<ReintegrationRecord> & Pick<ReintegrationRecord, 'id' | 'createdAt'>): ReintegrationRecord {
  return {
    id: overrides.id,
    workerTaskId: overrides.workerTaskId ?? 'task-1',
    sourceNoteId: overrides.sourceNoteId ?? 'note-1',
    signalKind: overrides.signalKind ?? 'daily_report_reintegration',
    taskType: overrides.taskType ?? 'daily_report',
    reviewStatus: overrides.reviewStatus ?? 'pending_review',
    payload: overrides.payload ?? {},
    result: overrides.result ?? null,
    reviewReason: overrides.reviewReason ?? null,
    evidence: overrides.evidence ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    reviewedAt: overrides.reviewedAt ?? null,
    reviewedBy: overrides.reviewedBy ?? null,
  };
}

describe('soulActionGroups', () => {
  const reintegrationRecords: ReintegrationRecord[] = [
    createReintegrationRecord({ id: 'record-ready', createdAt: '2026-03-21T10:00:00.000Z' }),
    createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z' }),
    createReintegrationRecord({ id: 'record-dispatched', createdAt: '2026-03-19T10:00:00.000Z' }),
  ];

  const soulActions: SoulAction[] = [
    createSoulAction({
      id: 'ready-1',
      sourceNoteId: 'record-ready',
      createdAt: '2026-03-21T10:01:00.000Z',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
    }),
    createSoulAction({
      id: 'ready-2',
      sourceNoteId: 'record-ready',
      createdAt: '2026-03-21T10:02:00.000Z',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
    }),
    createSoulAction({
      id: 'mixed-pending',
      sourceNoteId: 'record-mixed',
      createdAt: '2026-03-20T10:01:00.000Z',
      governanceStatus: 'pending_review',
      executionStatus: 'not_dispatched',
    }),
    createSoulAction({
      id: 'mixed-approved',
      sourceNoteId: 'record-mixed',
      createdAt: '2026-03-20T10:02:00.000Z',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
    }),
    createSoulAction({
      id: 'done-1',
      sourceNoteId: 'record-dispatched',
      createdAt: '2026-03-19T10:01:00.000Z',
      governanceStatus: 'approved',
      executionStatus: 'succeeded',
    }),
    createSoulAction({
      id: 'done-2',
      sourceNoteId: 'record-dispatched',
      createdAt: '2026-03-19T10:02:00.000Z',
      governanceStatus: 'approved',
      executionStatus: 'succeeded',
    }),
  ];

  it('counts all source-note groups from soul actions', () => {
    expect(getSoulActionGroupCount(soulActions)).toBe(3);
  });

  it('keeps only groups with pending items in pending_only mode', () => {
    const groups = buildSoulActionGroups(soulActions, reintegrationRecords, 'pending_only');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sourceNoteId).toBe('record-mixed');
    expect(groups[0]?.pendingCount).toBe(1);
    expect(groups[0]?.dispatchReadyCount).toBe(1);
  });

  it('keeps only fully dispatch-ready groups in dispatch_ready_only mode', () => {
    const groups = buildSoulActionGroups(soulActions, reintegrationRecords, 'dispatch_ready_only');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sourceNoteId).toBe('record-ready');
    expect(groups[0]?.dispatchReadyCount).toBe(2);
    expect(groups[0]?.actions).toHaveLength(2);
  });

  it('sorts groups by reintegration record recency when available', () => {
    const groups = buildSoulActionGroups(soulActions, reintegrationRecords, 'all');

    expect(groups.map((group) => group.sourceNoteId)).toEqual([
      'record-ready',
      'record-mixed',
      'record-dispatched',
    ]);
  });

  it('reports the current filter label and stats consistently', () => {
    expect(getSoulActionGroupQuickFilterLabel('all')).toBe('全部分组');
    expect(getSoulActionGroupQuickFilterLabel('pending_only')).toBe('仅待治理分组');
    expect(getSoulActionGroupQuickFilterLabel('dispatch_ready_only')).toBe('仅可派发分组');
    expect(getSoulActionGroupQuickFilterStats(soulActions, reintegrationRecords, 'dispatch_ready_only')).toBe('1 / 3 分组命中');
  });
});
