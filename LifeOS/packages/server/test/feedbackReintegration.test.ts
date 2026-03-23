import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  formatEventKindLabel,
  getAcceptReintegrationMessage,
  getPlanReintegrationMessage,
  getPlanReintegrationMessageFromDisplaySummary,
  getProjectionContinuitySummary,
  getProjectionExplanationSummary,
  getReintegrationReviewMessage,
  getReintegrationNextActionSummary as getSharedReintegrationNextActionSummary,
  getReintegrationOutcomeDetailRows,
  getReintegrationOutcomeNoPlanReason,
  getReintegrationOutcomeDisplaySummary,
  getReintegrationOutcomeSummary,
  getSuggestedSoulActionKindsForReintegrationSignal,
  normalizeReintegrationNextActionCandidate,
  pickReintegrationNextActionCandidate,
} from '@lifeos/shared';
import type { ReintegrationEvidenceSummary, TerminalWorkerTaskStatus, WorkerTask } from '@lifeos/shared';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb, closeDb } from '../src/db/client.js';
import { createWorkerTask, executeWorkerTask, cancelWorkerTask } from '../src/workers/workerTasks.js';
import { approveSoulAction, createOrReuseSoulAction, getSoulActionByIdentityAndKind, getSoulActionBySourceNoteIdAndKind, getSoulActionBySourceReintegrationIdAndKind, getSoulActionByWorkerTaskId } from '../src/soul/soulActions.js';
import type { PersonaSnapshot } from '../src/soul/personaSnapshots.js';
import { getPersonaSnapshotBySourceNoteId } from '../src/soul/personaSnapshots.js';
import {
  createFeedbackReintegrationPayload,
  createReintegrationRecordInput,
  getReintegrationSignalKind,
  SUPPORTED_REINTEGRATION_TASK_TYPES,
  type SupportedReintegrationTaskType,
} from '../src/workers/feedbackReintegration.js';
import { integrateContinuity } from '../src/workers/continuityIntegrator.js';
import { getReintegrationRecordByWorkerTaskId, upsertReintegrationRecord } from '../src/soul/reintegrationRecords.js';
import { acceptReintegrationRecord, acceptReintegrationRecordAndPlanPromotions, getReintegrationRecord, rejectReintegrationRecord } from '../src/soul/reintegrationReview.js';
import { generateSoulActionsFromOutcome as generatePlannedSoulActions, planPromotionSoulActions } from '../src/soul/reintegrationPromotionPlanner.js';
import {
  generateSoulActionsFromOutcome as describeReintegrationOutcome,
  buildOutcomePacketExtractTaskEvidence,
  buildReintegrationEvidenceFromOutcomePacket,
  buildReintegrationRecordInputFromOutcomePacket,
  buildReintegrationSummaryFromOutcomePacket,
  generateSoulActionsFromOutcomePacket,
  getOutcomePacketNextActionCandidate,
  getOutcomeTaskSignalKind,
  hasReintegrationSignalFromOutcomePacket,
} from '../src/soul/reintegrationOutcome.js';
import { listEventNodes } from '../src/soul/eventNodes.js';
import { listContinuityRecords } from '../src/soul/continuityRecords.js';
import { getPromotionActionKindsForReintegration, getPromotionSourceForReintegration, getContinuityScopeForKind, buildEventPromotionExplanation, buildContinuityPromotionExplanation, buildEventNodePromotionInput, buildContinuityPromotionInput, getPromotionGovernanceReason, getPromotionExecutionSummary } from '../src/soul/pr6PromotionRules.js';
import { generateSoulActionCandidate } from '../src/soul/soulActionGenerator.js';
import { evaluateInterventionGate } from '../src/soul/interventionGate.js';
import { dispatchSoulActionCandidate, dispatchApprovedSoulAction } from '../src/soul/soulActionDispatcher.js';
import { executePromotionSoulAction } from '../src/soul/pr6PromotionExecutor.js';
import { resolveSoulActionSourceReintegrationId, normalizeSoulActionSourceFilters } from '../src/soul/types.js';
import { getIndexedNoteTriggerSnapshot, triggerPersonaSnapshotAfterIndex } from '../src/soul/postIndexPersonaTrigger.js';
import { IndexQueue } from '../src/indexer/indexQueue.js';
import { createFile, rewriteMarkdownContent, updateFrontmatter } from '../src/vault/fileManager.js';

function buildTerminalTask<T extends SupportedReintegrationTaskType>(taskType: T, overrides: Partial<WorkerTask<T>> = {}): WorkerTask<T> {
  return {
    id: `task-${taskType}`,
    taskType,
    input: {} as never,
    status: 'succeeded',
    worker: 'lifeos',
    createdAt: '2026-03-20T09:00:00.000Z',
    updatedAt: '2026-03-20T09:05:00.000Z',
    startedAt: '2026-03-20T09:01:00.000Z',
    finishedAt: '2026-03-20T09:05:00.000Z',
    error: null,
    resultSummary: `${taskType} summary`,
    sourceNoteId: taskType === 'openclaw_task' ? null : 'note-1',
    sourceReintegrationId: null,
    scheduleId: null,
    outputNotePaths: taskType === 'openclaw_task' || taskType === 'update_persona_snapshot' ? [] : [`/tmp/${taskType}.md`],
    outputNotes: taskType === 'openclaw_task' || taskType === 'update_persona_snapshot'
      ? []
      : [{ id: `${taskType}-note`, title: `${taskType} output`, filePath: `/tmp/${taskType}.md`, fileName: `${taskType}.md` }],
    ...overrides,
  };
}

test('formatEventKindLabel centralizes PR6 event kind display semantics', () => {
  assert.equal(formatEventKindLabel({ eventKind: 'persona_shift' }), '人格切换');
  assert.equal(formatEventKindLabel({ eventKind: 'milestone_report' }), '里程碑');
  assert.equal(formatEventKindLabel({ eventKind: 'weekly_reflection' }), '周回顾');
});

test('shared next-action candidate helpers normalize evidence payloads and pick the strongest candidate', () => {
  assert.deepEqual(normalizeReintegrationNextActionCandidate(null), null);
  assert.deepEqual(normalizeReintegrationNextActionCandidate({ due: '2026-03-22' }), null);
  assert.deepEqual(normalizeReintegrationNextActionCandidate({
    title: '整理周报素材',
    priority: 'high',
    due: '2026-03-22',
    filePath: '/tmp/high.md',
    outputNoteId: 'task-note-high',
  }), {
    title: '整理周报素材',
    dimension: '',
    priority: 'high',
    due: '2026-03-22',
    filePath: '/tmp/high.md',
    outputNoteId: 'task-note-high',
  });
  assert.deepEqual(pickReintegrationNextActionCandidate([
    normalizeReintegrationNextActionCandidate({ title: '低优先级', priority: 'low', due: '2026-03-21', filePath: '/tmp/low.md' }),
    normalizeReintegrationNextActionCandidate({ title: '高优先级', priority: 'high', due: '2026-03-23', filePath: '/tmp/high.md' }),
    normalizeReintegrationNextActionCandidate({ title: '同优先级但更早 due', priority: 'high', due: '2026-03-22', filePath: '/tmp/high-earlier.md' }),
  ]), {
    title: '同优先级但更早 due',
    dimension: '',
    priority: 'high',
    due: '2026-03-22',
    filePath: '/tmp/high-earlier.md',
    outputNoteId: null,
  });
});

test('build PR6 promotion governance and execution summaries from centralized rules', () => {
  const record = {
    id: 'reint:promotion-summary-test',
    workerTaskId: 'task-promotion-summary-test',
    sourceNoteId: 'note-promotion-summary-test',
    soulActionId: 'soul-action-promotion-summary-test',
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'A reviewed daily pattern emerged',
    evidence: { source: 'test' },
    reviewReason: 'accepted by reviewer',
    createdAt: '2026-03-22T10:00:00.000Z',
    updatedAt: '2026-03-22T10:00:00.000Z',
    reviewedAt: '2026-03-22T10:00:00.000Z',
  } as const;

  assert.equal(getPromotionGovernanceReason(record), 'PR6 promotion planned from reintegration record reint:promotion-summary-test');
  assert.equal(getPromotionExecutionSummary('promote_event_node', 'event:reint:promotion-summary-test', false), '已创建 event node: event:reint:promotion-summary-test');
  assert.equal(getPromotionExecutionSummary('create_event_node', 'event:reint:promotion-summary-test', true), '已更新 event node: event:reint:promotion-summary-test');
  assert.equal(getPromotionExecutionSummary('promote_continuity_record', 'continuity:reint:promotion-summary-test', false), '已创建 continuity record: continuity:reint:promotion-summary-test');
});

test('build PR6 promotion payloads from reintegration review context', () => {
  const record = {
    id: 'reint:promotion-payload-test',
    workerTaskId: 'task-promotion-payload-test',
    sourceNoteId: 'note-promotion-payload-test',
    soulActionId: 'soul-action-promotion-payload-test',
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'A reviewed weekly pattern emerged',
    evidence: { source: 'test' },
    reviewReason: 'accepted for weekly pattern',
    createdAt: '2026-03-22T10:00:00.000Z',
    updatedAt: '2026-03-22T10:10:00.000Z',
    reviewedAt: '2026-03-22T10:11:00.000Z',
  } as const;

  assert.deepEqual(buildEventNodePromotionInput(record, 'soul-action-event'), {
    sourceReintegrationId: record.id,
    sourceNoteId: record.sourceNoteId,
    sourceSoulActionId: record.soulActionId,
    promotionSoulActionId: 'soul-action-event',
    eventKind: 'weekly_reflection',
    title: '周回顾事件',
    summary: record.summary,
    threshold: 'high',
    status: 'active',
    evidence: record.evidence,
    explanation: {
      whyHighThreshold: 'review-backed PR6 promotion',
      whyNow: record.summary,
      reviewBacked: true,
    },
    occurredAt: record.updatedAt,
  });

  assert.deepEqual(buildContinuityPromotionInput(record, 'soul-action-continuity'), {
    sourceReintegrationId: record.id,
    sourceNoteId: record.sourceNoteId,
    sourceSoulActionId: record.soulActionId,
    promotionSoulActionId: 'soul-action-continuity',
    continuityKind: 'weekly_theme',
    target: record.target,
    strength: 'medium',
    summary: record.summary,
    continuity: {
      anchor: record.summary,
      observationWindow: 'single_reviewed_signal',
      claim: record.summary,
      scope: 'weekly',
    },
    evidence: record.evidence,
    explanation: {
      whyNotOrdinaryArtifact: 'PR6 continuity promotion',
      whyReviewBacked: record.reviewReason,
      reviewBacked: true,
    },
    recordedAt: record.updatedAt,
  });
});

test('build PR6 promotion payloads expose stable projection explanation and continuity summaries', () => {
  const record = {
    id: 'reint:projection-summary-test',
    workerTaskId: 'task-projection-summary-test',
    sourceNoteId: 'note-projection-summary-test',
    soulActionId: 'soul-action-projection-summary-test',
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'A reviewed weekly pattern emerged',
    evidence: { source: 'test' },
    reviewReason: 'accepted by reviewer',
    createdAt: '2026-03-22T10:00:00.000Z',
    updatedAt: '2026-03-22T10:00:00.000Z',
    reviewedAt: '2026-03-22T10:00:00.000Z',
  } as const;

  const eventNode = buildEventNodePromotionInput(record, 'soul-action-event');
  const continuity = buildContinuityPromotionInput(record, 'soul-action-continuity');

  assert.equal(formatEventKindLabel(eventNode), '周回顾');
  assert.deepEqual(getProjectionExplanationSummary(eventNode), {
    primaryReason: record.summary,
    rationale: 'review-backed PR6 promotion',
    reviewBacked: true,
  });
  assert.deepEqual(getProjectionContinuitySummary(continuity), {
    anchor: record.summary,
    scope: 'weekly',
  });
  assert.deepEqual(getProjectionExplanationSummary(continuity), {
    primaryReason: record.reviewReason,
    rationale: 'PR6 continuity promotion',
    reviewBacked: true,
  });
});

test('build PR6 promotion payloads reuse centralized source resolution when source note is missing', () => {
  const record = {
    id: 'reint:promotion-payload-without-note',
    workerTaskId: 'task-promotion-payload-without-note',
    sourceNoteId: null,
    soulActionId: 'soul-action-promotion-payload-without-note',
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'A reviewed daily pattern without source note',
    evidence: { source: 'test' },
    reviewReason: 'accepted without source note',
    createdAt: '2026-03-22T10:00:00.000Z',
    updatedAt: '2026-03-22T10:10:00.000Z',
    reviewedAt: '2026-03-22T10:11:00.000Z',
  } as const;

  assert.equal(getPromotionSourceForReintegration(record).sourceNoteId, record.id);
  assert.equal(getPromotionSourceForReintegration(record).sourceReintegrationId, record.id);
  assert.equal(buildEventNodePromotionInput(record, 'soul-action-event').sourceNoteId, null);
  assert.equal(buildEventNodePromotionInput(record, 'soul-action-event').sourceReintegrationId, record.id);
  assert.equal(buildContinuityPromotionInput(record, 'soul-action-continuity').sourceNoteId, null);
  assert.equal(buildContinuityPromotionInput(record, 'soul-action-continuity').sourceReintegrationId, record.id);
});

test('build PR6 promotion explanations from reintegration review context', () => {
  const record = {
    id: 'reint:explanation-test',
    workerTaskId: 'task-explanation-test',
    sourceNoteId: 'note-explanation-test',
    soulActionId: 'soul-action-explanation-test',
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'A reviewed daily pattern emerged',
    evidence: { source: 'test' },
    reviewReason: 'accepted by reviewer',
    createdAt: '2026-03-22T10:00:00.000Z',
    updatedAt: '2026-03-22T10:00:00.000Z',
    reviewedAt: '2026-03-22T10:00:00.000Z',
  } as const;

  assert.deepEqual(buildEventPromotionExplanation(record), {
    whyHighThreshold: 'review-backed PR6 promotion',
    whyNow: record.summary,
    reviewBacked: true,
  });
  assert.deepEqual(buildContinuityPromotionExplanation(record), {
    whyNotOrdinaryArtifact: 'PR6 continuity promotion',
    whyReviewBacked: record.reviewReason,
    reviewBacked: true,
  });
});

test('getPromotionSourceForReintegration keeps reintegration identity for soul action planning when source note is missing', () => {
  const source = getPromotionSourceForReintegration({
    id: 'reint:promotion-source',
    sourceNoteId: null,
  });

  assert.deepEqual(source, {
    sourceNoteId: 'reint:promotion-source',
    sourceReintegrationId: 'reint:promotion-source',
  });
});

test('shared reintegration outcome display summary and messages stay aligned for planned next actions', () => {
  const reintegrationRecord = {
    evidence: {
      extractTaskCreated: 2,
      nextActionCandidate: {
        title: '整理周报素材',
        dimension: 'career',
        priority: 'high',
        due: '2026-03-22',
        filePath: 'Tasks/整理周报素材.md',
        outputNoteId: 'task-note-1',
      },
    },
  } as const;

  const nextActionSummary = getSharedReintegrationNextActionSummary(reintegrationRecord);
  assert.deepEqual(nextActionSummary, {
    createdCount: 2,
    candidateTitle: '整理周报素材',
    candidatePriority: 'high',
    candidateDue: '2026-03-22',
    candidateOutputNoteId: 'task-note-1',
  });

  const display = getReintegrationOutcomeDisplaySummary({
    soulActions: [{ id: 'soul:1' }, { id: 'soul:2' }],
    nextActionSummary,
  }, reintegrationRecord);
  assert.deepEqual(display, {
    plannedActionCount: 2,
    nextActionCreatedCount: 2,
    nextActionText: '整理周报素材（high · due 2026-03-22）',
    hasNextActionEvidence: true,
    noPlanReason: null,
  });
  assert.equal(getAcceptReintegrationMessage({ soulActions: [{ id: 'soul:1' }, { id: 'soul:2' }], nextActionSummary }, reintegrationRecord), '已接受并自动规划 2 条候选动作');
  assert.equal(getPlanReintegrationMessage({ soulActions: [{ id: 'soul:1' }, { id: 'soul:2' }], nextActionSummary }, reintegrationRecord), '已规划 2 条候选动作 · 下一步候选：整理周报素材（high · due 2026-03-22）');
});

test('shared reintegration planning message preserves next-action evidence when no actions can be planned', () => {
  const reintegrationRecord = {
    signalKind: 'task_extraction_reintegration',
    evidence: {
      extractTaskCreated: 0,
      nextActionCandidate: {
        title: '整理周报素材',
        dimension: 'career',
        priority: 'high',
        due: '2026-03-22',
        filePath: 'Tasks/整理周报素材.md',
        outputNoteId: 'task-note-1',
      },
    },
  } as const;

  const nextActionSummary = getSharedReintegrationNextActionSummary(reintegrationRecord);
  const display = getReintegrationOutcomeDisplaySummary({
    soulActions: [],
    nextActionSummary,
  }, reintegrationRecord);
  assert.deepEqual(display, {
    plannedActionCount: 0,
    nextActionCreatedCount: 0,
    nextActionText: '整理周报素材（high · due 2026-03-22）',
    hasNextActionEvidence: true,
    noPlanReason: 'next_action_evidence_only',
  });
  assert.equal(getAcceptReintegrationMessage({ soulActions: [], nextActionSummary }, reintegrationRecord), '已接受，但已有 next-action evidence，但尚未形成可规划动作 · 已记录 next-action evidence：整理周报素材（high · due 2026-03-22）');
  assert.equal(getPlanReintegrationMessage({ soulActions: [], nextActionSummary }, reintegrationRecord), '已有 next-action evidence，但尚未形成可规划动作 · 已记录 next-action evidence：整理周报素材（high · due 2026-03-22）');
});

test('shared reintegration planning message falls back cleanly when no actions or next-action evidence exist', () => {
  const reintegrationRecord = {
    signalKind: 'daily_report_reintegration',
    evidence: {},
  } as const;

  const nextActionSummary = getSharedReintegrationNextActionSummary(reintegrationRecord);
  assert.equal(nextActionSummary, null);

  const display = getReintegrationOutcomeDisplaySummary({
    soulActions: [],
    nextActionSummary,
  }, reintegrationRecord);
  assert.deepEqual(display, {
    plannedActionCount: 0,
    nextActionCreatedCount: null,
    nextActionText: null,
    hasNextActionEvidence: false,
    noPlanReason: 'no_outcome_signal',
  });
  assert.equal(getAcceptReintegrationMessage({ soulActions: [], nextActionSummary }, reintegrationRecord), '已接受，但当前没有足够 outcome signal 进入可规划状态');
  assert.equal(getPlanReintegrationMessage({ soulActions: [], nextActionSummary }, reintegrationRecord), '当前没有足够 outcome signal 进入可规划状态');
});

test('shared reintegration planning message explains signal kinds that do not generate follow-up governance actions', () => {
  const display = getReintegrationOutcomeDisplaySummary({
    soulActions: [],
    nextActionSummary: null,
  }, {
    signalKind: 'classification_reintegration',
    evidence: {},
  });

  assert.deepEqual(display, {
    plannedActionCount: 0,
    nextActionCreatedCount: null,
    nextActionText: null,
    hasNextActionEvidence: false,
    noPlanReason: 'no_suggested_actions',
  });
  assert.equal(getPlanReintegrationMessageFromDisplaySummary(display), '该类回流当前不生成后续治理动作');
  assert.equal(getReintegrationReviewMessage('plan', display), '该类回流当前不生成后续治理动作');
  assert.equal(getReintegrationReviewMessage('accept', display), '已接受，但该类回流当前不生成后续治理动作');
  assert.equal(getReintegrationReviewMessage('reject'), '已拒绝该回流记录');
  assert.equal(getReintegrationOutcomeNoPlanReason(display), '该类回流当前不生成后续治理动作');
  assert.deepEqual(getReintegrationOutcomeDetailRows(display), [
    { label: '已规划候选动作', value: 0 },
    { label: '未进入规划原因', value: '该类回流当前不生成后续治理动作' },
  ]);
});

test('getContinuityScopeForKind maps PR6 continuity kinds to stable scopes', () => {
  assert.equal(getContinuityScopeForKind('persona_direction'), 'persona');
  assert.equal(getContinuityScopeForKind('daily_rhythm'), 'daily');
  assert.equal(getContinuityScopeForKind('weekly_theme'), 'weekly');
});

test('normalizeSoulActionSourceFilters collapses legacy reintegration note filters into sourceReintegrationId', () => {
  const normalized = normalizeSoulActionSourceFilters(
    {
      sourceNoteId: 'reint:legacy-filter-target',
      sourceReintegrationId: undefined,
    },
    [
      { sourceReintegrationId: 'reint:legacy-filter-target' },
      { sourceReintegrationId: 'reint:other-target' },
    ],
  );

  assert.equal(normalized.sourceNoteId, undefined);
  assert.equal(normalized.sourceReintegrationId, 'reint:legacy-filter-target');
});

test('createOrReuseSoulAction persists explicit sourceReintegrationId independently from sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-source-reintegration-column-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const action = createOrReuseSoulAction({
    sourceNoteId: 'note-separated-source',
    sourceReintegrationId: 'reint:separated-source',
    actionKind: 'promote_event_node',
    governanceReason: 'persist explicit source reintegration id',
  });

  const reloaded = getSoulActionByIdentityAndKind({
    sourceNoteId: 'note-separated-source',
    sourceReintegrationId: 'reint:separated-source',
    actionKind: 'promote_event_node',
  });
  assert.ok(reloaded);
  assert.equal(action.id, 'soul:promote_event_node:reint:separated-source');
  assert.equal(action.sourceNoteId, 'note-separated-source');
  assert.equal(action.sourceReintegrationId, 'reint:separated-source');
  assert.equal(reloaded?.sourceNoteId, 'note-separated-source');
  assert.equal(reloaded?.sourceReintegrationId, 'reint:separated-source');
  assert.equal(reloaded?.id, action.id);
});

test('createOrReuseSoulAction reuses promotion actions by legacy reintegration source encoded in sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-legacy-source-identity-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const first = createOrReuseSoulAction({
    sourceNoteId: 'reint:legacy-identity-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
    governanceReason: 'legacy identity seed',
  });

  const reused = createOrReuseSoulAction({
    sourceNoteId: 'reint:legacy-identity-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
    governanceReason: 'legacy identity second pass',
  });

  const reloaded = getSoulActionByIdentityAndKind({
    sourceNoteId: 'reint:legacy-identity-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
  });

  assert.equal(reused.id, first.id);
  assert.equal(reloaded?.id, first.id);
  assert.equal(reloaded?.sourceReintegrationId, 'reint:legacy-identity-source');
  assert.equal(reloaded?.sourceNoteId, 'reint:legacy-identity-source');
});

test('createOrReuseSoulAction reuses create_event_node actions by legacy reintegration source encoded in sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-create-event-node-legacy-source-identity-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const first = createOrReuseSoulAction({
    sourceNoteId: 'reint:legacy-create-event-node-source',
    sourceReintegrationId: null,
    actionKind: 'create_event_node',
    governanceReason: 'legacy create_event_node identity seed',
  });

  const reused = createOrReuseSoulAction({
    sourceNoteId: 'reint:legacy-create-event-node-source',
    sourceReintegrationId: null,
    actionKind: 'create_event_node',
    governanceReason: 'legacy create_event_node identity second pass',
  });

  const reloaded = getSoulActionByIdentityAndKind({
    sourceNoteId: 'reint:legacy-create-event-node-source',
    sourceReintegrationId: null,
    actionKind: 'create_event_node',
  });

  assert.equal(first.id, 'soul:create_event_node:reint:legacy-create-event-node-source');
  assert.equal(reused.id, first.id);
  assert.equal(reloaded?.id, first.id);
  assert.equal(reloaded?.sourceReintegrationId, 'reint:legacy-create-event-node-source');
  assert.equal(reloaded?.sourceNoteId, 'reint:legacy-create-event-node-source');
});

test('createReintegrationRecordInput centralizes record assembly for terminal tasks', () => {
  const task = buildTerminalTask('update_persona_snapshot', {
    id: 'task-record-input',
    resultSummary: '已更新人格快照：更稳定推进。',
    sourceNoteId: 'note-record-input',
    outputNotePaths: [],
    outputNotes: [],
  });

  const recordInput = createReintegrationRecordInput(task, {
    soulActionId: 'soul-123',
    personaSnapshot: {
      id: 'persona-123',
      sourceNoteId: 'note-record-input',
      soulActionId: 'soul-123',
      workerTaskId: 'task-record-input',
      summary: '长期主义与稳定节奏',
      snapshot: {
        sourceNoteTitle: '测试笔记',
        summary: '人格快照摘要',
        contentPreview: '长期主义与稳定节奏',
        updatedAt: '2026-03-20T09:00:00.000Z',
      },
      createdAt: '2026-03-20T09:00:00.000Z',
      updatedAt: '2026-03-20T09:00:00.000Z',
    },
  });

  assert.deepEqual(recordInput, {
    workerTaskId: 'task-record-input',
    sourceNoteId: 'note-record-input',
    soulActionId: 'soul-123',
    taskType: 'update_persona_snapshot',
    terminalStatus: 'succeeded',
    signalKind: 'persona_snapshot_reintegration',
    target: 'source_note',
    strength: 'medium',
    summary: '已更新人格快照：更稳定推进。 Continuity target: source_note.',
    evidence: {
      taskId: 'task-record-input',
      taskType: 'update_persona_snapshot',
      sourceNoteId: 'note-record-input',
      sourceSoulActionId: null,
      sourceReintegrationId: null,
      resultSummary: '已更新人格快照：更稳定推进。',
      error: null,
      outputNotePaths: [],
      extractTaskCreated: null,
      extractTaskItems: [],
      nextActionCandidate: null,
      personaSnapshotId: 'persona-123',
      personaSnapshotSummary: '长期主义与稳定节奏',
      personaContentPreview: '长期主义与稳定节奏',
    },
  });
});

test('createReintegrationRecordInput keeps persona evidence nullable when absent', () => {
  const task = buildTerminalTask('daily_report', {
    id: 'task-record-input-daily',
    sourceNoteId: null,
    resultSummary: '已生成今日日报',
  });

  const recordInput = createReintegrationRecordInput(task);

  assert.equal(recordInput.signalKind, 'daily_report_reintegration');
  assert.equal(recordInput.target, 'derived_outputs');
  assert.equal(recordInput.evidence.personaSnapshotId, null);
  assert.equal(recordInput.evidence.personaSnapshotSummary, null);
  assert.equal(recordInput.evidence.personaContentPreview, null);
});

test('createReintegrationRecordInput keeps extract task evidence and recommended next action for next-step planning', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-record-input-extract',
    sourceNoteId: 'note-record-input',
    resultSummary: '已提取行动项',
    result: {
      title: '行动项提取',
      summary: '已提取 3 个行动项',
      created: 3,
      sourceNoteTitle: '源笔记',
      items: [
        { title: '高优先任务', dimension: 'career', priority: 'high', due: '2026-03-23', filePath: '/tmp/high.md' },
        { title: '中优先任务', dimension: 'life', priority: 'medium', due: '2026-03-22', filePath: '/tmp/medium.md' },
        { title: '低优先任务', dimension: 'growth', priority: 'low', due: null, filePath: '/tmp/low.md' },
      ],
    },
    outputNotePaths: ['/tmp/high.md', '/tmp/medium.md', '/tmp/low.md'],
    outputNotes: [
      { id: 'task-note-high', title: '高优先任务', filePath: '/tmp/high.md', fileName: 'high.md' },
      { id: 'task-note-medium', title: '中优先任务', filePath: '/tmp/medium.md', fileName: 'medium.md' },
      { id: 'task-note-low', title: '低优先任务', filePath: '/tmp/low.md', fileName: 'low.md' },
    ],
  });

  const recordInput = createReintegrationRecordInput(task, {
    personaSnapshot: null,
  });

  assert.equal(recordInput.signalKind, 'task_extraction_reintegration');
  assert.equal(recordInput.target, 'task_record');
  assert.equal(recordInput.evidence.extractTaskCreated, 3);
  assert.deepEqual(recordInput.evidence.extractTaskItems, [
    {
      title: '高优先任务',
      dimension: 'career',
      priority: 'high',
      due: '2026-03-23',
      filePath: '/tmp/high.md',
      outputNoteId: 'task-note-high',
    },
    {
      title: '中优先任务',
      dimension: 'life',
      priority: 'medium',
      due: '2026-03-22',
      filePath: '/tmp/medium.md',
      outputNoteId: 'task-note-medium',
    },
    {
      title: '低优先任务',
      dimension: 'growth',
      priority: 'low',
      due: null,
      filePath: '/tmp/low.md',
      outputNoteId: 'task-note-low',
    },
  ]);
  assert.deepEqual(recordInput.evidence.nextActionCandidate, {
    title: '高优先任务',
    dimension: 'career',
    priority: 'high',
    due: '2026-03-23',
    filePath: '/tmp/high.md',
    outputNoteId: 'task-note-high',
  });
  assert.equal(recordInput.evidence.personaSnapshotId, null);
  assert.equal(recordInput.evidence.personaSnapshotSummary, null);
  assert.equal(recordInput.evidence.personaContentPreview, null);
});

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for condition');
}

async function waitForQueueToDrain(queue: IndexQueue): Promise<void> {
  await waitFor(() => {
    const status = queue.getStatus();
    return !status.processing && status.queueSize === 0;
  });
}

function buildNoteMarkdown(frontmatter: Record<string, unknown>, content: string): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((item) => JSON.stringify(item)).join(', ')}]`);
      continue;
    }
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('---', '', content);
  return `${lines.join('\n')}\n`;
}

test('resolveSoulActionSourceReintegrationId prefers explicit sourceReintegrationId and falls back to legacy reint sourceNoteId', () => {
  assert.equal(resolveSoulActionSourceReintegrationId({
    sourceNoteId: 'note-plain-source',
    sourceReintegrationId: 'reint:explicit-source',
  }), 'reint:explicit-source');

  assert.equal(resolveSoulActionSourceReintegrationId({
    sourceNoteId: 'reint:legacy-source',
    sourceReintegrationId: null,
  }), 'reint:legacy-source');

  assert.equal(resolveSoulActionSourceReintegrationId({
    sourceNoteId: 'note-without-reintegration-prefix',
    sourceReintegrationId: null,
  }), null);
});

test('executePromotionSoulAction reports the explicit reintegration source contract when missing promotion source ids', () => {
  assert.throws(
    () => executePromotionSoulAction({
      id: 'soul:promote-event-missing-source',
      sourceNoteId: 'note-without-reintegration-prefix',
      sourceReintegrationId: null,
      actionKind: 'promote_event_node',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      status: 'not_dispatched',
      workerTaskId: null,
      governanceReason: null,
      resultSummary: null,
      error: null,
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      approvedAt: '2026-03-22T10:00:00.000Z',
      deferredAt: null,
      discardedAt: null,
      startedAt: null,
      finishedAt: null,
    }),
    /requires sourceReintegrationId or reintegration-record sourceNoteId/,
  );
});

test('executePromotionSoulAction prefers explicit sourceReintegrationId over a non-reintegration sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-pr6-explicit-source-reintegration-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'task-pr6-explicit-source',
    sourceNoteId: 'note-original-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly reviewed summary',
    evidence: { source: 'feedback-test' },
    reviewStatus: 'accepted',
    reviewReason: 'looks good',
  });

  const result = executePromotionSoulAction({
    id: 'soul:promote-event-explicit-source',
    sourceNoteId: 'note-original-source',
    sourceReintegrationId: 'reint:task-pr6-explicit-source',
    actionKind: 'promote_event_node',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    status: 'not_dispatched',
    workerTaskId: null,
    governanceReason: null,
    resultSummary: null,
    error: null,
    createdAt: '2026-03-22T10:05:00.000Z',
    updatedAt: '2026-03-22T10:05:00.000Z',
    approvedAt: '2026-03-22T10:05:00.000Z',
    deferredAt: null,
    discardedAt: null,
    startedAt: null,
    finishedAt: null,
  });

  assert.match(result.summary, /已(?:创建|更新) event node:/);

  const eventNode = listEventNodes().find((item) => item.sourceReintegrationId === 'reint:task-pr6-explicit-source');
  assert.ok(eventNode);
  assert.equal(eventNode?.sourceReintegrationId, 'reint:task-pr6-explicit-source');
  assert.equal(eventNode?.sourceNoteId, 'note-original-source');
  assert.equal(eventNode?.title, '周回顾事件');
});

test('executePromotionSoulAction still supports legacy reintegration ids stored in sourceNoteId for event-node promotions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-legacy-source-note-event-fallback-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'task-pr6-legacy-event-source',
    sourceNoteId: 'note-legacy-event-original-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly legacy reviewed summary',
    evidence: { source: 'feedback-test-event' },
    reviewStatus: 'accepted',
    reviewReason: 'legacy event fallback still supported',
  });

  const result = executePromotionSoulAction({
    id: 'soul:promote-event-legacy-source',
    sourceNoteId: 'reint:task-pr6-legacy-event-source',
    sourceReintegrationId: null,
    actionKind: 'promote_event_node',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    status: 'not_dispatched',
    workerTaskId: null,
    governanceReason: null,
    resultSummary: null,
    error: null,
    createdAt: '2026-03-22T10:08:00.000Z',
    updatedAt: '2026-03-22T10:08:00.000Z',
    approvedAt: '2026-03-22T10:08:00.000Z',
    deferredAt: null,
    discardedAt: null,
    startedAt: null,
    finishedAt: null,
  });

  assert.match(result.summary, /已创建 event node:/);

  const eventNode = listEventNodes().find((item) => item.sourceReintegrationId === 'reint:task-pr6-legacy-event-source');
  assert.ok(eventNode);
  assert.equal(eventNode?.sourceReintegrationId, 'reint:task-pr6-legacy-event-source');
  assert.equal(eventNode?.sourceNoteId, 'note-legacy-event-original-source');
  assert.equal(eventNode?.eventKind, 'weekly_reflection');
  assert.equal(eventNode?.title, '周回顾事件');
});

test('executePromotionSoulAction still supports legacy reintegration ids stored in sourceNoteId', async (t) => {
  const env = await createTestEnv('lifeos-pr6-legacy-source-note-fallback-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'task-pr6-legacy-source',
    sourceNoteId: 'note-legacy-original-source',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily reviewed summary',
    evidence: { source: 'feedback-test' },
    reviewStatus: 'accepted',
    reviewReason: 'legacy still supported',
  });

  const result = executePromotionSoulAction({
    id: 'soul:promote-continuity-legacy-source',
    sourceNoteId: 'reint:task-pr6-legacy-source',
    sourceReintegrationId: null,
    actionKind: 'promote_continuity_record',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    status: 'not_dispatched',
    workerTaskId: null,
    governanceReason: null,
    resultSummary: null,
    error: null,
    createdAt: '2026-03-22T10:10:00.000Z',
    updatedAt: '2026-03-22T10:10:00.000Z',
    approvedAt: '2026-03-22T10:10:00.000Z',
    deferredAt: null,
    discardedAt: null,
    startedAt: null,
    finishedAt: null,
  });

  assert.match(result.summary, /已创建 continuity record:/);

  const continuity = listContinuityRecords().find((item) => item.sourceReintegrationId === 'reint:task-pr6-legacy-source');
  assert.ok(continuity);
  assert.equal(continuity?.sourceReintegrationId, 'reint:task-pr6-legacy-source');
  assert.equal(continuity?.sourceNoteId, 'note-legacy-original-source');
  assert.equal(continuity?.continuityKind, 'daily_rhythm');
});

test('update_persona_snapshot with sourceNoteId creates and reuses a SoulAction record', async (t) => {
  const env = await createTestEnv('lifeos-persona-soul-action-create-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-create', '/tmp/note-persona-create.md', 'note-persona-create.md', 'Persona 创建测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我想继续稳定推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const firstTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-create' },
    sourceNoteId: 'note-persona-create',
  });

  const firstSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-create', 'update_persona_snapshot');
  assert.ok(firstSoulAction);
  assert.equal(firstSoulAction.governanceStatus, 'approved');
  assert.equal(firstSoulAction.executionStatus, 'pending');
  assert.equal(firstSoulAction.workerTaskId, firstTask.id);

  const secondTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-create' },
    sourceNoteId: 'note-persona-create',
  });

  const reusedSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-create', 'update_persona_snapshot');
  assert.ok(reusedSoulAction);
  assert.equal(reusedSoulAction.id, firstSoulAction.id);
  assert.equal(reusedSoulAction.workerTaskId, secondTask.id);
});

test('extract_tasks with sourceNoteId creates and reuses a SoulAction record', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-create-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-soul-create', '/tmp/note-soul-create.md', 'note-soul-create.md', 'Soul 创建测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const firstTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-create' },
    sourceNoteId: 'note-soul-create',
  });

  const firstSoulAction = getSoulActionBySourceNoteIdAndKind('note-soul-create', 'extract_tasks');
  assert.ok(firstSoulAction);
  assert.equal(firstSoulAction.governanceStatus, 'approved');
  assert.equal(firstSoulAction.executionStatus, 'pending');
  assert.equal(firstSoulAction.workerTaskId, firstTask.id);

  const secondTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-create' },
    sourceNoteId: 'note-soul-create',
  });

  const reusedSoulAction = getSoulActionBySourceNoteIdAndKind('note-soul-create', 'extract_tasks');
  assert.ok(reusedSoulAction);
  assert.equal(reusedSoulAction.id, firstSoulAction.id);
  assert.equal(reusedSoulAction.workerTaskId, secondTask.id);
});

test('worker tasks without supported SoulAction path do not create SoulAction records', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-skip-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  const noSourceTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-missing-source' },
  });
  assert.equal(getSoulActionByWorkerTaskId(noSourceTask.id), null);

  const unsupportedTask = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
    sourceNoteId: 'note-missing-source',
  });
  assert.equal(getSoulActionByWorkerTaskId(unsupportedTask.id), null);
});

test('extract_tasks execution syncs SoulAction lifecycle to terminal state', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-sync-success-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{
      type: 'text',
      text: JSON.stringify({ tasks: [] }),
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-soul-success', '/tmp/note-soul-success.md', 'note-soul-success.md', 'Soul 成功测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-success' },
    sourceNoteId: 'note-soul-success',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);

  assert.equal(result.status, 'succeeded');
  assert.ok(soulAction);
  assert.equal(soulAction.governanceStatus, 'approved');
  assert.equal(soulAction.executionStatus, 'succeeded');
  assert.equal(soulAction.sourceNoteId, 'note-soul-success');
  assert.equal(soulAction.workerTaskId, task.id);
  assert.ok(soulAction.startedAt);
  assert.ok(soulAction.finishedAt);
  assert.equal(soulAction.error, null);
  assert.equal(soulAction.resultSummary, result.resultSummary ?? null);
});

test('terminal failure and cancellation also sync SoulAction lifecycle', async (t) => {
  const env = await createTestEnv('lifeos-soul-action-sync-terminal-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let shouldCancel = false;
  let cancelTaskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    if (shouldCancel && cancelTaskId) {
      cancelWorkerTask(cancelTaskId);
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({ tasks: [] }),
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('extract-tasks-upstream-failure', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES
      (
        'note-soul-failed', '/tmp/note-soul-failed.md', 'note-soul-failed.md', 'Soul 失败测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
      ),
      (
        'note-soul-cancelled', '/tmp/note-soul-cancelled.md', 'note-soul-cancelled.md', 'Soul 取消测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 B。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
      )
  `).run();

  const failedTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-failed' },
    sourceNoteId: 'note-soul-failed',
  });
  const failedResult = await executeWorkerTask(failedTask.id);
  const failedSoulAction = getSoulActionByWorkerTaskId(failedTask.id);

  assert.equal(failedResult.status, 'failed');
  assert.ok(failedSoulAction);
  assert.equal(failedSoulAction.governanceStatus, 'approved');
  assert.equal(failedSoulAction.executionStatus, 'failed');
  assert.match(failedSoulAction.error || '', /API error: 500 extract-tasks-upstream-failure/);
  assert.equal(failedSoulAction.resultSummary, null);
  assert.ok(failedSoulAction.finishedAt);

  shouldCancel = true;
  const cancelledTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-soul-cancelled' },
    sourceNoteId: 'note-soul-cancelled',
  });
  cancelTaskId = cancelledTask.id;

  const cancelledResult = await executeWorkerTask(cancelledTask.id);
  const cancelledSoulAction = getSoulActionByWorkerTaskId(cancelledTask.id);

  assert.equal(cancelledResult.status, 'cancelled');
  assert.ok(cancelledSoulAction);
  assert.equal(cancelledSoulAction.governanceStatus, 'approved');
  assert.equal(cancelledSoulAction.executionStatus, 'cancelled');
  assert.equal(cancelledSoulAction.error, '任务已取消');
  assert.equal(cancelledSoulAction.resultSummary, null);
  assert.ok(cancelledSoulAction.finishedAt);
});

test('createFeedbackReintegrationPayload carries linked soul action identity into outcome packets', async (t) => {
  const env = await createTestEnv('lifeos-feedback-reintegration-linked-soul-action-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-linked-soul-action', '/tmp/note-linked-soul-action.md', 'note-linked-soul-action.md', 'Linked SoulAction Note', 'note', 'growth', 'done', 'medium', 'private', '2026-03-24', NULL, '[]', 'auto', '2026-03-24T09:00:00.000Z', '2026-03-24T09:00:00.000Z', '需要更新 persona 并保留 source identity。', '2026-03-24T09:00:00.000Z', '2026-03-24T09:00:00.000Z'
    )
  `).run();

  const promotionSource = createOrReuseSoulAction({
    sourceNoteId: 'note-linked-soul-action',
    actionKind: 'update_persona_snapshot',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    governanceReason: 'seed linked source identity',
    now: '2026-03-24T09:01:00.000Z',
  });

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-linked-soul-action' },
    sourceNoteId: 'note-linked-soul-action',
  });

  assert.equal(getSoulActionByWorkerTaskId(task.id)?.id, promotionSource.id);

  const completed = await executeWorkerTask(task.id);
  assert.equal(completed.status, 'succeeded');

  const packet = createFeedbackReintegrationPayload(completed);
  assert.equal(packet.sourceSoulActionId, promotionSource.id);
  assert.equal(packet.sourceReintegrationId, null);

  const recordInput = createReintegrationRecordInput(completed);
  assert.equal(recordInput.soulActionId, promotionSource.id);
  assert.equal((recordInput.evidence as Record<string, unknown>).sourceSoulActionId, promotionSource.id);
  assert.equal((recordInput.evidence as Record<string, unknown>).sourceReintegrationId, null);
});

test('createFeedbackReintegrationPayload preserves linked reintegration identity for promotion soul actions', async (t) => {
  const env = await createTestEnv('lifeos-feedback-reintegration-linked-reint-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const promotionSource = createOrReuseSoulAction({
    sourceNoteId: 'note-linked-reintegration-source',
    sourceReintegrationId: 'reint:linked-promotion-source',
    actionKind: 'promote_event_node',
    governanceStatus: 'approved',
    executionStatus: 'not_dispatched',
    governanceReason: 'seed linked reintegration identity',
    now: '2026-03-24T09:11:00.000Z',
  });

  const task = buildTerminalTask('weekly_report', {
    id: 'task-linked-reintegration-source',
    sourceNoteId: 'note-linked-reintegration-source',
    sourceReintegrationId: 'reint:linked-promotion-source',
  });

  getDb().prepare(`
    INSERT INTO worker_tasks (
      id, task_type, input_json, status, worker, created_at, updated_at,
      started_at, finished_at, error, result_json, result_summary, source_note_id, source_reintegration_id, output_note_paths, schedule_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    task.taskType,
    JSON.stringify(task.input),
    task.status,
    task.worker,
    task.createdAt,
    task.updatedAt,
    task.startedAt,
    task.finishedAt,
    task.error,
    task.result ? JSON.stringify(task.result) : null,
    task.resultSummary,
    task.sourceNoteId,
    task.sourceReintegrationId,
    JSON.stringify(task.outputNotePaths),
    task.scheduleId,
  );
  getDb().prepare(`UPDATE soul_actions SET worker_task_id = ? WHERE id = ?`).run(task.id, promotionSource.id);

  const packet = createFeedbackReintegrationPayload(task);
  assert.equal(packet.sourceSoulActionId, promotionSource.id);
  assert.equal(packet.sourceReintegrationId, 'reint:linked-promotion-source');

  const recordInput = createReintegrationRecordInput(task);
  assert.equal(recordInput.soulActionId, promotionSource.id);
  assert.equal((recordInput.evidence as Record<string, unknown>).sourceSoulActionId, promotionSource.id);
  assert.equal((recordInput.evidence as Record<string, unknown>).sourceReintegrationId, 'reint:linked-promotion-source');
});

test('buildReintegrationEvidenceFromOutcomePacket matches the shared reintegration evidence contract shape', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-shared-evidence-contract',
    sourceNoteId: 'note-shared-evidence-contract',
    outputNotePaths: ['/tmp/extract-task-output.md'],
    outputNotes: [{
      id: 'task-note-1',
      title: '整理周报素材',
      filePath: '/tmp/extract-task-output.md',
      fileName: 'extract-task-output.md',
    }],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);
  const summary = buildReintegrationSummaryFromOutcomePacket(packet, continuity);
  const evidence = buildReintegrationEvidenceFromOutcomePacket(packet, summary, null);

  const sharedEvidence: ReintegrationEvidenceSummary = evidence;
  assert.deepEqual(sharedEvidence, {
    taskId: 'task-shared-evidence-contract',
    taskType: 'extract_tasks',
    sourceNoteId: 'note-shared-evidence-contract',
    sourceSoulActionId: null,
    sourceReintegrationId: null,
    resultSummary: 'extract_tasks summary',
    error: null,
    outputNotePaths: ['/tmp/extract-task-output.md'],
    extractTaskCreated: 1,
    extractTaskItems: [{
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: 'task-note-1',
    }],
    nextActionCandidate: {
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: 'task-note-1',
    },
    personaSnapshotId: null,
    personaSnapshotSummary: null,
    personaContentPreview: null,
  });
});

test('shared reintegration outcome summary centralizes signal-to-action mapping for reviewed records', () => {
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('summary_reintegration'), []);
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('classification_reintegration'), []);
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('openclaw_reintegration'), []);
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('task_extraction_reintegration'), ['create_event_node']);
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('persona_snapshot_reintegration'), ['promote_event_node', 'promote_continuity_record']);
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('daily_report_reintegration'), ['promote_event_node', 'promote_continuity_record']);
  assert.deepEqual(getSuggestedSoulActionKindsForReintegrationSignal('weekly_report_reintegration'), ['promote_event_node', 'promote_continuity_record']);

  assert.deepEqual(getReintegrationOutcomeSummary({
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
  }), {
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    suggestedActionKinds: ['promote_event_node', 'promote_continuity_record'],
  });
});

test('buildReintegrationSummaryFromOutcomePacket matches the shared reintegration summary contract shape', () => {
  const task = buildTerminalTask('daily_report', {
    id: 'task-shared-summary-contract',
    resultSummary: '日报总结',
  });
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);
  const summary = buildReintegrationSummaryFromOutcomePacket(packet, continuity);

  assert.deepEqual(summary, {
    signalKind: 'daily_report_reintegration',
    target: 'source_note',
    strength: 'medium',
    summary: '日报总结 Continuity target: source_note.',
    nextActionCandidate: null,
    suggestedActionKinds: ['promote_event_node', 'promote_continuity_record'],
  });
  assert.deepEqual(getReintegrationOutcomeSummary({
    signalKind: summary.signalKind,
    target: summary.target,
    strength: summary.strength,
  }), {
    signalKind: summary.signalKind,
    target: summary.target,
    strength: summary.strength,
    suggestedActionKinds: summary.suggestedActionKinds,
  });
  assert.deepEqual(Object.keys(summary).sort(), [
    'nextActionCandidate',
    'signalKind',
    'strength',
    'suggestedActionKinds',
    'summary',
    'target',
  ]);
});

test('getOutcomeTaskSignalKind resolves reintegration signal kinds directly from task types without constructing packets', () => {
  assert.equal(getOutcomeTaskSignalKind('summarize_note'), 'summary_reintegration');
  assert.equal(getOutcomeTaskSignalKind('classify_inbox'), 'classification_reintegration');
  assert.equal(getOutcomeTaskSignalKind('extract_tasks'), 'task_extraction_reintegration');
  assert.equal(getOutcomeTaskSignalKind('update_persona_snapshot'), 'persona_snapshot_reintegration');
  assert.equal(getOutcomeTaskSignalKind('daily_report'), 'daily_report_reintegration');
  assert.equal(getOutcomeTaskSignalKind('weekly_report'), 'weekly_report_reintegration');
  assert.equal(getOutcomeTaskSignalKind('openclaw_task'), 'openclaw_reintegration');
});

test('supported task types generate stable reintegration payloads', () => {
  for (const taskType of SUPPORTED_REINTEGRATION_TASK_TYPES) {
    const task = buildTerminalTask(taskType);
    const payload = createFeedbackReintegrationPayload(task);

    assert.deepEqual(Object.keys(payload), [
      'taskId',
      'taskType',
      'status',
      'resultSummary',
      'error',
      'sourceNoteId',
      'sourceSoulActionId',
      'sourceReintegrationId',
      'outputNotePaths',
      'extractTaskCreated',
      'extractTaskItems',
    ]);
    assert.equal(payload.taskId, task.id);
    assert.equal(payload.taskType, taskType);
    assert.equal(payload.status, 'succeeded');
    assert.equal(payload.resultSummary, `${taskType} summary`);
    assert.equal(payload.error, null);
    assert.equal(payload.sourceNoteId, task.sourceNoteId ?? null);
    assert.equal(payload.sourceSoulActionId, null);
    assert.equal(payload.sourceReintegrationId, null);
    assert.deepEqual(payload.outputNotePaths, task.outputNotePaths ?? []);
    assert.notEqual(payload.outputNotePaths, task.outputNotePaths);
    assert.equal(getReintegrationSignalKind(taskType), {
      summarize_note: 'summary_reintegration',
      classify_inbox: 'classification_reintegration',
      extract_tasks: 'task_extraction_reintegration',
      update_persona_snapshot: 'persona_snapshot_reintegration',
      daily_report: 'daily_report_reintegration',
      weekly_report: 'weekly_report_reintegration',
      openclaw_task: 'openclaw_reintegration',
    }[taskType]);
  }
});

test('buildReintegrationRecordInputFromOutcomePacket centralizes packet-to-record assembly including persona snapshot evidence', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-record-input-from-outcome-packet',
    sourceNoteId: 'note-record-input-from-outcome-packet',
    outputNotePaths: ['/tmp/extract-task-output.md'],
    outputNotes: [{
      id: 'task-note-1',
      title: '整理周报素材',
      filePath: '/tmp/extract-task-output.md',
      fileName: 'extract-task-output.md',
    }],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);
  const personaSnapshot = {
    id: 'persona-snapshot-record-builder',
    sourceNoteId: 'note-record-input-from-outcome-packet',
    summary: '更稳定推进',
    snapshot: {
      contentPreview: '保持节奏，推进周报整理',
    },
  } as PersonaSnapshot;

  assert.deepEqual(buildReintegrationRecordInputFromOutcomePacket(packet, continuity, {
    soulActionId: 'soul-action-reintegration-record-builder',
    personaSnapshot,
  }), {
    workerTaskId: 'task-record-input-from-outcome-packet',
    sourceNoteId: 'note-record-input-from-outcome-packet',
    soulActionId: 'soul-action-reintegration-record-builder',
    taskType: 'extract_tasks',
    terminalStatus: 'succeeded',
    signalKind: 'task_extraction_reintegration',
    target: 'task_record',
    strength: 'medium',
    summary: 'extract_tasks summary Continuity target: task_record.',
    evidence: {
      taskId: 'task-record-input-from-outcome-packet',
      taskType: 'extract_tasks',
      sourceNoteId: 'note-record-input-from-outcome-packet',
      sourceSoulActionId: null,
      sourceReintegrationId: null,
      resultSummary: 'extract_tasks summary',
      error: null,
      outputNotePaths: ['/tmp/extract-task-output.md'],
      extractTaskCreated: 1,
      extractTaskItems: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
        outputNoteId: 'task-note-1',
      }],
      nextActionCandidate: {
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
        outputNoteId: 'task-note-1',
      },
      personaSnapshotId: 'persona-snapshot-record-builder',
      personaSnapshotSummary: '更稳定推进',
      personaContentPreview: '保持节奏，推进周报整理',
    },
  });
});

test('buildOutcomePacketExtractTaskEvidence centralizes packet extract-task evidence assembly from worker task outputs', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-packet-extract-evidence-context',
    outputNotePaths: ['/tmp/high.md', '/tmp/medium.md'],
    outputNotes: [
      { id: 'task-note-high', title: '高优先任务', filePath: '/tmp/high.md', fileName: 'high.md' },
      { id: 'task-note-medium', title: '中优先任务', filePath: '/tmp/medium.md', fileName: 'medium.md' },
    ],
    result: {
      title: '行动项提取',
      summary: '已提取 2 个行动项',
      created: 2,
      sourceNoteTitle: '源笔记',
      items: [
        { title: '高优先任务', dimension: 'career', priority: 'high', due: '2026-03-23', filePath: '/tmp/high.md' },
        { title: '中优先任务', dimension: 'life', priority: 'medium', due: '2026-03-22', filePath: '/tmp/medium.md' },
      ],
    },
  });

  assert.deepEqual(buildOutcomePacketExtractTaskEvidence(task), {
    extractTaskCreated: 2,
    extractTaskItems: [
      {
        title: '高优先任务',
        dimension: 'career',
        priority: 'high',
        due: '2026-03-23',
        filePath: '/tmp/high.md',
        outputNoteId: 'task-note-high',
      },
      {
        title: '中优先任务',
        dimension: 'life',
        priority: 'medium',
        due: '2026-03-22',
        filePath: '/tmp/medium.md',
        outputNoteId: 'task-note-medium',
      },
    ],
  });
});

test('buildReintegrationEvidenceFromOutcomePacket centralizes evidence assembly for packet context and persona snapshot', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-reintegration-evidence-context',
    sourceNoteId: 'note-evidence-context',
    outputNotePaths: ['/tmp/extract-task-output.md'],
    outputNotes: [{
      id: 'task-note-1',
      title: '整理周报素材',
      filePath: '/tmp/extract-task-output.md',
      fileName: 'extract-task-output.md',
    }],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);
  const summary = buildReintegrationSummaryFromOutcomePacket(packet, continuity);
  const personaSnapshot = {
    id: 'persona-snapshot-1',
    sourceNoteId: 'note-evidence-context',
    summary: '更稳定推进',
    snapshot: {
      contentPreview: '保持节奏，推进周报整理',
    },
  } as PersonaSnapshot;

  assert.deepEqual(buildReintegrationEvidenceFromOutcomePacket(packet, summary, personaSnapshot), {
    taskId: 'task-reintegration-evidence-context',
    taskType: 'extract_tasks',
    sourceNoteId: 'note-evidence-context',
    sourceSoulActionId: null,
    sourceReintegrationId: null,
    resultSummary: 'extract_tasks summary',
    error: null,
    outputNotePaths: ['/tmp/extract-task-output.md'],
    extractTaskCreated: 1,
    extractTaskItems: [{
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: 'task-note-1',
    }],
    nextActionCandidate: {
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: 'task-note-1',
    },
    personaSnapshotId: 'persona-snapshot-1',
    personaSnapshotSummary: '更稳定推进',
    personaContentPreview: '保持节奏，推进周报整理',
  });
});

test('buildReintegrationSummaryFromOutcomePacket centralizes signal kind, continuity summary, and next action candidate from packet context', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-reintegration-summary-context',
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: [],
    outputNotes: [],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(task);
  const continuity = integrateContinuity(packet);

  assert.deepEqual(buildReintegrationSummaryFromOutcomePacket(packet, continuity), {
    signalKind: 'task_extraction_reintegration',
    target: 'task_record',
    strength: 'medium',
    summary: 'extract_tasks completed with 0 output note(s). Continuity target: task_record.',
    nextActionCandidate: {
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: null,
    },
    suggestedActionKinds: ['create_event_node'],
  });
  assert.deepEqual(getReintegrationOutcomeSummary({
    signalKind: 'task_extraction_reintegration',
    target: 'task_record',
    strength: 'medium',
  }).suggestedActionKinds, ['create_event_node']);
});

test('outcome packet next-action candidate picks the highest-priority earliest-due task instead of preserving item order', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-outcome-packet-priority-order',
    resultSummary: null,
    outputNotePaths: ['/tmp/medium.md', '/tmp/high.md', '/tmp/low.md'],
    outputNotes: [
      { id: 'task-note-medium', title: '中优先任务', filePath: '/tmp/medium.md', fileName: 'medium.md' },
      { id: 'task-note-high', title: '高优先任务', filePath: '/tmp/high.md', fileName: 'high.md' },
      { id: 'task-note-low', title: '低优先任务', filePath: '/tmp/low.md', fileName: 'low.md' },
    ],
    result: {
      title: '行动项提取',
      summary: '已提取 3 个行动项',
      created: 3,
      sourceNoteTitle: '源笔记',
      items: [
        { title: '中优先任务', dimension: 'life', priority: 'medium', due: '2026-03-22', filePath: '/tmp/medium.md' },
        { title: '高优先任务', dimension: 'career', priority: 'high', due: '2026-03-23', filePath: '/tmp/high.md' },
        { title: '低优先任务', dimension: 'growth', priority: 'low', due: null, filePath: '/tmp/low.md' },
      ],
    },
  });
  const packet = createFeedbackReintegrationPayload(task);

  assert.deepEqual(getOutcomePacketNextActionCandidate(packet), {
    title: '高优先任务',
    dimension: 'career',
    priority: 'high',
    due: '2026-03-23',
    filePath: '/tmp/high.md',
    outputNoteId: 'task-note-high',
  });
  assert.deepEqual(createReintegrationRecordInput(task).evidence.nextActionCandidate, {
    title: '高优先任务',
    dimension: 'career',
    priority: 'high',
    due: '2026-03-23',
    filePath: '/tmp/high.md',
    outputNoteId: 'task-note-high',
  });
});

test('outcome packet keeps next-action evidence visible but blocks suggested actions on failed extract_tasks', () => {
  const extractTask = buildTerminalTask('extract_tasks', {
    status: 'failed',
    resultSummary: null,
    error: 'worker failed after extraction',
    sourceNoteId: null,
    outputNotePaths: [],
    outputNotes: [],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(extractTask);

  assert.equal(hasReintegrationSignalFromOutcomePacket(packet), true);
  assert.deepEqual(generateSoulActionsFromOutcomePacket(packet), {
    nextActionCandidate: {
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: null,
    },
    suggestedActionKinds: [],
  });
  assert.deepEqual(integrateContinuity(packet), {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'extract_tasks ended as failed; continuity remains observational only (worker failed after extraction).',
  });
});

test('outcome packet keeps next-action evidence visible but blocks suggested actions on cancelled extract_tasks', () => {
  const extractTask = buildTerminalTask('extract_tasks', {
    status: 'cancelled',
    resultSummary: null,
    error: '任务已取消',
    sourceNoteId: null,
    outputNotePaths: [],
    outputNotes: [],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(extractTask);

  assert.equal(hasReintegrationSignalFromOutcomePacket(packet), true);
  assert.deepEqual(generateSoulActionsFromOutcomePacket(packet), {
    nextActionCandidate: {
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: null,
    },
    suggestedActionKinds: [],
  });
  assert.deepEqual(integrateContinuity(packet), {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'extract_tasks ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('continuity integrator treats extract-task next-action evidence as a reintegration signal even without summary or outputs', () => {
  const extractTask = buildTerminalTask('extract_tasks', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: [],
    outputNotes: [],
    result: {
      title: '行动项提取',
      summary: '已提取 1 个行动项',
      created: 1,
      sourceNoteTitle: '源笔记',
      items: [{
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/tmp/extract-task-output.md',
      }],
    },
  });
  const packet = createFeedbackReintegrationPayload(extractTask);

  assert.equal(hasReintegrationSignalFromOutcomePacket(packet), true);
  assert.deepEqual(generateSoulActionsFromOutcomePacket(packet), {
    nextActionCandidate: {
      title: '整理周报素材',
      dimension: 'growth',
      priority: 'high',
      due: '2026-03-22',
      filePath: '/tmp/extract-task-output.md',
      outputNoteId: null,
    },
    suggestedActionKinds: ['create_event_node'],
  });
  assert.deepEqual(integrateContinuity(packet), {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'task_record',
    strength: 'medium',
    summary: 'extract_tasks completed with 0 output note(s). Continuity target: task_record.',
  });
});

test('outcome packet reintegration signal stays false when succeeded work has no summary outputs or next action evidence', () => {
  const summarizeTask = buildTerminalTask('summarize_note', {
    resultSummary: null,
    outputNotePaths: [],
    outputNotes: [],
  });
  const packet = createFeedbackReintegrationPayload(summarizeTask);

  assert.equal(hasReintegrationSignalFromOutcomePacket(packet), false);
  assert.deepEqual(generateSoulActionsFromOutcomePacket(packet), {
    nextActionCandidate: null,
    suggestedActionKinds: [],
  });
  assert.deepEqual(integrateContinuity(packet), {
    taskId: 'task-summarize_note',
    taskType: 'summarize_note',
    status: 'succeeded',
    shouldReintegrate: false,
    target: 'source_note',
    strength: 'medium',
    summary: 'summarize_note ended as succeeded; no reintegration candidate was produced.',
  });
});

test('continuity integrator returns stable, predictable results', () => {
  const sourceTask = buildTerminalTask('summarize_note');
  const sourcePacket = createFeedbackReintegrationPayload(sourceTask);
  const sourceResult = integrateContinuity(sourcePacket);

  assert.deepEqual(sourceResult, {
    taskId: 'task-summarize_note',
    taskType: 'summarize_note',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'summarize_note summary Continuity target: source_note.',
  });

  const extractTask = buildTerminalTask('extract_tasks');
  const extractPacket = createFeedbackReintegrationPayload(extractTask);
  const extractResult = integrateContinuity(extractPacket);

  assert.deepEqual(extractResult, {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'task_record',
    strength: 'medium',
    summary: 'extract_tasks summary Continuity target: task_record.',
  });

  const personaTask = buildTerminalTask('update_persona_snapshot');
  const personaPacket = createFeedbackReintegrationPayload(personaTask);
  const personaResult = integrateContinuity(personaPacket);

  assert.deepEqual(personaResult, {
    taskId: 'task-update_persona_snapshot',
    taskType: 'update_persona_snapshot',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'update_persona_snapshot summary Continuity target: source_note.',
  });

  const classifyTask = buildTerminalTask('classify_inbox', {
    sourceNoteId: null,
  });
  const classifyPacket = createFeedbackReintegrationPayload(classifyTask);
  const classifyResult = integrateContinuity(classifyPacket);

  assert.deepEqual(classifyResult, {
    taskId: 'task-classify_inbox',
    taskType: 'classify_inbox',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'classify_inbox summary Continuity target: derived_outputs.',
  });

  const dailyTask = buildTerminalTask('daily_report', {
    sourceNoteId: null,
  });
  const dailyPacket = createFeedbackReintegrationPayload(dailyTask);
  const dailyResult = integrateContinuity(dailyPacket);

  assert.deepEqual(dailyResult, {
    taskId: 'task-daily_report',
    taskType: 'daily_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily_report summary Continuity target: derived_outputs.',
  });

  const weeklyTask = buildTerminalTask('weekly_report', {
    sourceNoteId: null,
  });
  const weeklyPacket = createFeedbackReintegrationPayload(weeklyTask);
  const weeklyResult = integrateContinuity(weeklyPacket);

  assert.deepEqual(weeklyResult, {
    taskId: 'task-weekly_report',
    taskType: 'weekly_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly_report summary Continuity target: derived_outputs.',
  });

  const failedTask = buildTerminalTask('openclaw_task', {
    status: 'failed',
    resultSummary: null,
    error: 'provider unavailable',
    outputNotePaths: [],
    outputNotes: [],
  });
  const failedPacket = createFeedbackReintegrationPayload(failedTask);
  const failedResult = integrateContinuity(failedPacket);

  assert.deepEqual(failedResult, {
    taskId: 'task-openclaw_task',
    taskType: 'openclaw_task',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'openclaw_task ended as failed; continuity remains observational only (provider unavailable).',
  });
});

test('continuity integrator reports no reintegration candidate when terminal tasks have no error and no outputs', () => {
  const failedTask = buildTerminalTask('openclaw_task', {
    status: 'failed',
    resultSummary: null,
    error: null,
    outputNotePaths: [],
    outputNotes: [],
  });
  const failedResult = integrateContinuity(createFeedbackReintegrationPayload(failedTask));

  assert.deepEqual(failedResult, {
    taskId: 'task-openclaw_task',
    taskType: 'openclaw_task',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'openclaw_task ended as failed; no reintegration candidate was produced.',
  });

  const cancelledTask = buildTerminalTask('openclaw_task', {
    status: 'cancelled',
    resultSummary: null,
    error: null,
    outputNotePaths: [],
    outputNotes: [],
  });
  const cancelledResult = integrateContinuity(createFeedbackReintegrationPayload(cancelledTask));

  assert.deepEqual(cancelledResult, {
    taskId: 'task-openclaw_task',
    taskType: 'openclaw_task',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: 'openclaw_task ended as cancelled; no reintegration candidate was produced.',
  });
});

test('continuity integrator falls back to output-count summary for succeeded tasks without resultSummary', () => {
  const extractTask = buildTerminalTask('extract_tasks', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: ['/tmp/out-1.md', '/tmp/out-2.md'],
    outputNotes: [
      { id: 'out-1', title: 'out-1', filePath: '/tmp/out-1.md', fileName: 'out-1.md' },
      { id: 'out-2', title: 'out-2', filePath: '/tmp/out-2.md', fileName: 'out-2.md' },
    ],
  });
  const extractResult = integrateContinuity(createFeedbackReintegrationPayload(extractTask));

  assert.deepEqual(extractResult, {
    taskId: 'task-extract_tasks',
    taskType: 'extract_tasks',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'task_record',
    strength: 'medium',
    summary: 'extract_tasks completed with 2 output note(s). Continuity target: task_record.',
  });

  const summarizeTask = buildTerminalTask('summarize_note', {
    resultSummary: null,
    outputNotePaths: ['/tmp/summarize-out-1.md'],
    outputNotes: [
      { id: 'summarize-out-1', title: 'summarize-out-1', filePath: '/tmp/summarize-out-1.md', fileName: 'summarize-out-1.md' },
    ],
  });
  const summarizeResult = integrateContinuity(createFeedbackReintegrationPayload(summarizeTask));

  assert.deepEqual(summarizeResult, {
    taskId: 'task-summarize_note',
    taskType: 'summarize_note',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'source_note',
    strength: 'medium',
    summary: 'summarize_note completed with 1 output note(s). Continuity target: source_note.',
  });

  const dailyTask = buildTerminalTask('daily_report', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: ['/tmp/daily-out-1.md'],
    outputNotes: [
      { id: 'daily-out-1', title: 'daily-out-1', filePath: '/tmp/daily-out-1.md', fileName: 'daily-out-1.md' },
    ],
  });
  const dailyResult = integrateContinuity(createFeedbackReintegrationPayload(dailyTask));

  assert.deepEqual(dailyResult, {
    taskId: 'task-daily_report',
    taskType: 'daily_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily_report completed with 1 output note(s). Continuity target: derived_outputs.',
  });

  const weeklyTask = buildTerminalTask('weekly_report', {
    resultSummary: null,
    sourceNoteId: null,
    outputNotePaths: ['/tmp/weekly-out-1.md', '/tmp/weekly-out-2.md'],
    outputNotes: [
      { id: 'weekly-out-1', title: 'weekly-out-1', filePath: '/tmp/weekly-out-1.md', fileName: 'weekly-out-1.md' },
      { id: 'weekly-out-2', title: 'weekly-out-2', filePath: '/tmp/weekly-out-2.md', fileName: 'weekly-out-2.md' },
    ],
  });
  const weeklyResult = integrateContinuity(createFeedbackReintegrationPayload(weeklyTask));

  assert.deepEqual(weeklyResult, {
    taskId: 'task-weekly_report',
    taskType: 'weekly_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly_report completed with 2 output note(s). Continuity target: derived_outputs.',
  });
});

test('update_persona_snapshot execution syncs SoulAction lifecycle and upserts persona snapshot', { concurrency: false }, async (t) => {
  const env = await createTestEnv('lifeos-persona-snapshot-success-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-success-pr5', '/tmp/note-persona-success-pr5.md', 'note-persona-success-pr5.md', 'Persona 成功测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更专注长期主义、系统化推进与稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-success-pr5' },
    sourceNoteId: 'note-persona-success-pr5',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-success-pr5');
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);

  assert.equal(result.status, 'succeeded');
  assert.ok(soulAction);
  assert.equal(soulAction?.status, 'succeeded');
  assert.match(result.resultSummary || '', /已更新人格快照/);
  assert.ok(snapshot);
  assert.equal(snapshot?.workerTaskId, task.id);
  assert.equal(snapshot?.soulActionId, soulAction?.id ?? null);
  assert.equal(snapshot?.sourceNoteId, 'note-persona-success-pr5');
  assert.match(snapshot?.summary || '', /已更新人格快照/);
  assert.equal(snapshot?.snapshot.sourceNoteTitle, 'Persona 成功测试笔记');
  assert.match(snapshot?.snapshot.contentPreview || '', /长期主义/);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'persona_snapshot_reintegration');
  assert.equal(reintegrationRecord?.sourceNoteId, 'note-persona-success-pr5');
  assert.equal(reintegrationRecord?.soulActionId, soulAction?.id ?? null);
  assert.equal(reintegrationRecord?.reviewStatus, 'pending_review');
  assert.deepEqual(result.outputNotePaths, []);
});

test('update_persona_snapshot terminal failure and cancellation also sync SoulAction lifecycle', async (t) => {
  const env = await createTestEnv('lifeos-persona-soul-action-sync-terminal-');
  let cancelTaskId = '';

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-cancelled', '/tmp/note-persona-cancelled.md', 'note-persona-cancelled.md', 'Persona 取消测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我想继续稳定推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const failedTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-missing-sync' },
    sourceNoteId: 'note-persona-missing-sync',
  });
  const failedResult = await executeWorkerTask(failedTask.id);
  const failedSoulAction = getSoulActionByWorkerTaskId(failedTask.id);

  assert.equal(failedResult.status, 'failed');
  assert.ok(failedSoulAction);
  assert.equal(failedSoulAction.governanceStatus, 'approved');
  assert.equal(failedSoulAction.executionStatus, 'failed');
  assert.match(failedSoulAction.error || '', /笔记不存在/);
  assert.equal(failedSoulAction.resultSummary, null);

  const cancelledTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-cancelled' },
    sourceNoteId: 'note-persona-cancelled',
  });
  cancelTaskId = cancelledTask.id;
  cancelWorkerTask(cancelTaskId);
  const cancelledResult = await executeWorkerTask(cancelledTask.id);
  const cancelledSoulAction = getSoulActionByWorkerTaskId(cancelledTask.id);

  assert.equal(cancelledResult.status, 'cancelled');
  assert.ok(cancelledSoulAction);
  assert.equal(cancelledSoulAction.governanceStatus, 'approved');
  assert.equal(cancelledSoulAction.executionStatus, 'cancelled');
  assert.equal(cancelledSoulAction.error, '任务已取消');
  assert.equal(cancelledSoulAction.resultSummary, null);
});

test('update_persona_snapshot missing note fails without creating persona snapshot', async (t) => {
  const env = await createTestEnv('lifeos-persona-snapshot-failed-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-persona-missing' },
    sourceNoteId: 'note-persona-missing',
  });

  const result = await executeWorkerTask(task.id);
  const soulAction = getSoulActionByWorkerTaskId(task.id);
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-missing');

  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /笔记不存在/);
  assert.ok(soulAction);
  assert.equal(soulAction?.status, 'failed');
  assert.equal(snapshot, null);
});

test('post-index queue creates pending_review soul action for new growth note', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-create-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-自动触发.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '我最近更重视长期主义与系统化迭代。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);

  const soulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  const workerTaskCount = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(workerTaskCount.total, 0);
  assert.equal(snapshot, null);
});

test('post-index queue reuses pending_review soul action when growth note content changes', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-append-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-正文变化.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '第一版内容。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);
  const firstSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  assert.ok(firstSoulAction);

  await rewriteMarkdownContent(filePath, (content) => `${content}\n\n补充：现在我更强调稳态推进与节奏感。`);
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const updatedSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  assert.ok(updatedSoulAction);
  assert.equal(updatedSoulAction?.id, firstSoulAction?.id);
  assert.equal(updatedSoulAction?.governanceStatus, 'pending_review');
  assert.equal(updatedSoulAction?.executionStatus, 'not_dispatched');
});

test('post-index queue ignores frontmatter-only updates for growth note', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-frontmatter-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-前言更新.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '正文保持不变。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);
  const beforeSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  assert.ok(beforeSoulAction);
  const beforeTasks = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  await updateFrontmatter(filePath, { priority: 'high', status: 'done' });
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const afterSoulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const afterTasks = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?").get(note!.id) as { total: number };

  assert.ok(afterSoulAction);
  assert.equal(afterSoulAction?.updatedAt, beforeSoulAction?.updatedAt);
  assert.equal(afterTasks.total, beforeTasks.total);
});

test('post-index queue ignores non-target notes for persona snapshot trigger', async (t) => {
  const env = await createTestEnv('lifeos-persona-post-index-filter-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const learningFilePath = path.join(env.vaultPath, '学习', '2026-03-20-非成长.md');
  const taskFilePath = path.join(env.vaultPath, '成长', '2026-03-20-任务.md');
  const emptyFilePath = path.join(env.vaultPath, '成长', '2026-03-20-空正文.md');

  await createFile(learningFilePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'learning',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '这是一条学习笔记。'));
  await createFile(taskFilePath, buildNoteMarkdown({
    type: 'task',
    dimension: 'growth',
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '这是一条任务。'));
  await createFile(emptyFilePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'pending',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '   '));

  queue.enqueue(learningFilePath, 'upsert');
  queue.enqueue(taskFilePath, 'upsert');
  queue.enqueue(emptyFilePath, 'upsert');
  await waitForQueueToDrain(queue);

  const taskCount = getDb().prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot'").get() as { total: number };
  assert.equal(taskCount.total, 0);
});

test('post-index PR3 baseline queues reviewable soul action instead of auto-dispatching', async (t) => {
  const env = await createTestEnv('lifeos-persona-pr3-queue-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const queue = new IndexQueue(() => {});
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-pr3-queue.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '我最近更强调长期主义、稳态推进与节奏感。'));

  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);

  const soulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  const workerTaskCount = getDb()
    .prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?")
    .get(note!.id) as { total: number };

  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(workerTaskCount.total, 0);
  assert.equal(snapshot, null);
});

test('generator gate queues PR3 reviewable update_persona_snapshot action', { concurrency: false }, async (t) => {
  const env = await createTestEnv('lifeos-persona-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-dispatch', '/tmp/note-persona-dispatch.md', 'note-persona-dispatch.md', 'Persona 派发测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我希望继续以系统化、简洁、稳态的方式推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const candidate = generateSoulActionCandidate({
    sourceNoteId: 'note-persona-dispatch',
    noteId: 'note-persona-dispatch',
    noteContent: '我希望继续以系统化、简洁、稳态的方式推进。',
  });
  assert.deepEqual(candidate, {
    sourceNoteId: 'note-persona-dispatch',
    actionKind: 'update_persona_snapshot',
    noteId: 'note-persona-dispatch',
    trigger: 'post_index_growth_note',
    confidence: 0.6,
    analysisReason: 'legacy generator path',
  });

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'queue_for_review',
    reason: 'update_persona_snapshot 候选，置信度 60%，legacy generator path，需要人工审批',
    confidence: 0.6,
  });

  const dispatchResult = await dispatchSoulActionCandidate(candidate!, gateDecision);
  assert.equal(dispatchResult.dispatched, false);
  assert.equal(dispatchResult.workerTaskId, null);
  assert.ok(dispatchResult.soulActionId);

  const soulAction = getSoulActionBySourceNoteIdAndKind('note-persona-dispatch', 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId('note-persona-dispatch');
  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(snapshot, null);
});

test('generator gate queues and dispatches review-backed extract_tasks closure', { concurrency: false }, async (t) => {
  const env = await createTestEnv('lifeos-extract-dispatch-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{
      type: 'text',
      text: JSON.stringify({ tasks: [] }),
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-extract-closure', '/tmp/note-extract-closure.md', 'note-extract-closure.md', 'Extract Closure 测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请帮我整理任务。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const candidate = generateSoulActionCandidate({
    sourceNoteId: 'note-extract-closure',
    noteId: 'note-extract-closure',
    noteContent: '请帮我整理任务。',
    preferredActionKind: 'extract_tasks',
  });
  assert.deepEqual(candidate, {
    sourceNoteId: 'note-extract-closure',
    actionKind: 'extract_tasks',
    noteId: 'note-extract-closure',
    trigger: 'manual_extract_tasks_request',
    confidence: 0.6,
    analysisReason: 'legacy generator path',
  });

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'queue_for_review',
    reason: '手动提取任务请求，置信度 60%，legacy generator path，需要人工审批',
    confidence: 0.6,
  });

  const queued = await dispatchSoulActionCandidate(candidate!, gateDecision);
  assert.equal(queued.dispatched, false);
  assert.ok(queued.soulActionId);
  assert.equal(queued.workerTaskId, null);

  const queuedSoulAction = getSoulActionBySourceNoteIdAndKind('note-extract-closure', 'extract_tasks');
  assert.ok(queuedSoulAction);
  assert.equal(queuedSoulAction?.governanceStatus, 'pending_review');
  assert.equal(queuedSoulAction?.executionStatus, 'not_dispatched');

  const approved = approveSoulAction(queuedSoulAction!.id, 'approve extract closure');
  assert.ok(approved);
  assert.equal(approved?.governanceStatus, 'approved');

  const { dispatchApprovedSoulAction } = await import('../src/soul/soulActionDispatcher.js');
  const dispatched = await dispatchApprovedSoulAction(queuedSoulAction!.id);
  assert.equal(dispatched.dispatched, true);
  assert.ok(dispatched.workerTaskId);

  const task = getSoulActionByWorkerTaskId(dispatched.workerTaskId!);
  assert.ok(task);
  assert.equal(task?.executionStatus, 'succeeded');
  assert.equal(task?.governanceStatus, 'approved');
});

test('generator and gate stay observational when source context is missing', () => {
  const candidate = generateSoulActionCandidate({
    sourceNoteId: null,
    noteId: 'note-persona-observe',
    noteContent: '仍有内容，但没有 source note 上下文。',
  });
  assert.equal(candidate, null);

  const gateDecision = evaluateInterventionGate(candidate);
  assert.deepEqual(gateDecision, {
    decision: 'observe_only',
    reason: 'missing source note context for governance queue',
    confidence: 0,
  });
});

test('post-index PR3 baseline returns explicit trigger result and creates reviewable soul action', async (t) => {
  const env = await createTestEnv('lifeos-persona-pr2-baseline-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const filePath = path.join(env.vaultPath, '成长', '2026-03-20-pr2-baseline.md');
  await createFile(filePath, buildNoteMarkdown({
    type: 'note',
    dimension: 'growth',
    status: 'done',
    priority: 'medium',
    privacy: 'private',
    date: '2026-03-20',
    source: 'desktop',
    created: '2026-03-20T09:00:00.000Z',
    updated: '2026-03-20T09:00:00.000Z',
  }, '我想继续以稳态、节奏感和系统化方式推进。'));

  const queue = new IndexQueue(() => {});
  queue.enqueue(filePath, 'upsert');
  await waitForQueueToDrain(queue);

  const note = getDb().prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: string } | undefined;
  assert.ok(note);

  const previousNote = getIndexedNoteTriggerSnapshot(filePath);
  const result = await triggerPersonaSnapshotAfterIndex({
    filePath,
    previousNote,
  });

  assert.equal(result.triggered, false);
  assert.match(result.reason, /current note does not match PR3 persona snapshot review baseline/);

  const soulAction = getSoulActionBySourceNoteIdAndKind(note!.id, 'update_persona_snapshot');
  const snapshot = getPersonaSnapshotBySourceNoteId(note!.id);
  const workerTaskCount = getDb()
    .prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?")
    .get(note!.id) as { total: number };

  assert.ok(soulAction);
  assert.equal(soulAction?.governanceStatus, 'pending_review');
  assert.equal(soulAction?.executionStatus, 'not_dispatched');
  assert.equal(workerTaskCount.total, 0);
  assert.equal(snapshot, null);
});

test('dispatcher reuses stable PR3 soul action id across repeated queueing', async (t) => {
  const env = await createTestEnv('lifeos-persona-pr2-repeat-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-persona-repeat', '/tmp/note-persona-repeat.md', 'note-persona-repeat.md', 'Persona 重复派发测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更强调长期主义和系统化推进。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const firstCandidate = generateSoulActionCandidate({
    sourceNoteId: 'note-persona-repeat',
    noteId: 'note-persona-repeat',
    noteContent: '我最近更强调长期主义和系统化推进。',
  });
  const firstDispatch = await dispatchSoulActionCandidate(firstCandidate!, evaluateInterventionGate(firstCandidate));
  const firstSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-repeat', 'update_persona_snapshot');

  assert.ok(firstDispatch.soulActionId);
  assert.ok(firstSoulAction);

  getDb().prepare(`UPDATE notes SET content = ?, updated = ? WHERE id = ?`).run(
    '我最近更强调长期主义、系统化推进和节奏感。',
    '2026-03-20T10:00:00.000Z',
    'note-persona-repeat',
  );

  const secondCandidate = generateSoulActionCandidate({
    sourceNoteId: 'note-persona-repeat',
    noteId: 'note-persona-repeat',
    noteContent: '我最近更强调长期主义、系统化推进和节奏感。',
  });
  const secondDispatch = await dispatchSoulActionCandidate(secondCandidate!, evaluateInterventionGate(secondCandidate));
  const secondSoulAction = getSoulActionBySourceNoteIdAndKind('note-persona-repeat', 'update_persona_snapshot');
  const workerTaskCount = getDb()
    .prepare("SELECT COUNT(*) as total FROM worker_tasks WHERE task_type = 'update_persona_snapshot' AND source_note_id = ?")
    .get('note-persona-repeat') as { total: number };

  assert.equal(secondDispatch.soulActionId, firstDispatch.soulActionId);
  assert.equal(secondSoulAction?.id, firstSoulAction?.id);
  assert.equal(secondDispatch.workerTaskId, null);
  assert.equal(workerTaskCount.total, 0);
  assert.equal(secondSoulAction?.governanceStatus, 'pending_review');
  assert.equal(secondSoulAction?.executionStatus, 'not_dispatched');
});

test('executeWorkerTask hits reintegration wiring on classify_inbox success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-classify-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'classify_inbox',
    input: { dryRun: false },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /_Inbox 目录为空或不存在|_Inbox 中没有待分类文件|已分类 \d+ 个文件/);
  assert.ok(Array.isArray(result.outputNotePaths));
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));
  assert.equal(integrateContinuity(createFeedbackReintegrationPayload(result)).taskType, 'classify_inbox');
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'classification_reintegration');
});

test('executeWorkerTask hits reintegration wiring on extract_tasks success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-extract-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          tasks: [],
        }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-extract', '/tmp/note-extract.md', 'note-extract.md', '提取测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '请完成任务 A。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();
  const task = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-extract' },
    sourceNoteId: 'note-extract',
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /未发现可创建的行动项|已创建 \d+ 个行动项/);
  assert.ok(Array.isArray(result.outputNotePaths));
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));
  assert.equal(integrateContinuity(createFeedbackReintegrationPayload(result)).taskType, 'extract_tasks');
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'task_extraction_reintegration');
});

test('executeWorkerTask keeps reintegration persona evidence scoped to the worker task that produced the snapshot', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-persona-scope-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: '更稳定地围绕长期主义推进。',
            contentPreview: '长期主义、节奏感、系统化推进',
          }),
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({ tasks: [] }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-reintegration-persona-scope', '/tmp/note-reintegration-persona-scope.md', 'note-reintegration-persona-scope.md', 'Persona 作用域测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更强调长期主义与稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const personaTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-reintegration-persona-scope' },
    sourceNoteId: 'note-reintegration-persona-scope',
  });
  const personaResult = await executeWorkerTask(personaTask.id);
  assert.equal(personaResult.status, 'succeeded');

  const personaSnapshot = getPersonaSnapshotBySourceNoteId('note-reintegration-persona-scope');
  const personaRecord = getReintegrationRecordByWorkerTaskId(personaTask.id);
  assert.ok(personaSnapshot);
  assert.ok(personaRecord);
  assert.equal(personaRecord?.evidence.personaSnapshotId, personaSnapshot?.id);
  assert.equal(personaRecord?.evidence.personaSnapshotSummary, personaSnapshot?.summary);

  const extractTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-reintegration-persona-scope' },
    sourceNoteId: 'note-reintegration-persona-scope',
  });
  const extractResult = await executeWorkerTask(extractTask.id);
  assert.equal(extractResult.status, 'succeeded');

  const extractRecord = getReintegrationRecordByWorkerTaskId(extractTask.id);
  assert.ok(extractRecord);
  assert.equal(extractRecord?.signalKind, 'task_extraction_reintegration');
  assert.equal(extractRecord?.evidence.personaSnapshotId, null);
  assert.equal(extractRecord?.evidence.personaSnapshotSummary, null);
  assert.equal(extractRecord?.evidence.personaContentPreview, null);
});

test('executeWorkerTask does not reuse older persona snapshot evidence for later non-persona tasks on the same note', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-persona-followup-scope-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: '先建立稳定节奏。',
            contentPreview: '稳定节奏、长期推进',
          }),
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({ tasks: [] }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-reintegration-persona-followup', '/tmp/note-reintegration-persona-followup.md', 'note-reintegration-persona-followup.md', 'Persona 后续作用域测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我想保持稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const personaTask = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-reintegration-persona-followup' },
    sourceNoteId: 'note-reintegration-persona-followup',
  });
  const personaResult = await executeWorkerTask(personaTask.id);
  assert.equal(personaResult.status, 'succeeded');

  const currentSnapshot = getPersonaSnapshotBySourceNoteId('note-reintegration-persona-followup');
  assert.ok(currentSnapshot);
  assert.equal(currentSnapshot?.workerTaskId, personaTask.id);

  const followupTask = createWorkerTask({
    taskType: 'extract_tasks',
    input: { noteId: 'note-reintegration-persona-followup' },
    sourceNoteId: 'note-reintegration-persona-followup',
  });
  const followupResult = await executeWorkerTask(followupTask.id);
  assert.equal(followupResult.status, 'succeeded');

  const followupRecord = getReintegrationRecordByWorkerTaskId(followupTask.id);
  assert.ok(followupRecord);
  assert.equal(followupRecord?.signalKind, 'task_extraction_reintegration');
  assert.equal(followupRecord?.evidence.personaSnapshotId, null);
  assert.equal(followupRecord?.evidence.personaSnapshotSummary, null);
  assert.equal(followupRecord?.evidence.personaContentPreview, null);
});

test('executeWorkerTask hits reintegration wiring on supported success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-wire-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: '示例摘要',
          summary: '这是稳定摘要',
          keyPoints: ['k1', 'k2'],
        }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-1', '/tmp/note-1.md', 'note-1.md', '测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '这是测试内容。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();
  const task = createWorkerTask({
    taskType: 'summarize_note',
    input: { noteId: 'note-1', language: 'zh', maxLength: 200 },
    sourceNoteId: 'note-1',
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /已生成摘要/);
  assert.ok((result.outputNotePaths?.length || 0) > 0);
  assert.equal(result.sourceNoteId, 'note-1');
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));
  assert.equal(integrateContinuity(createFeedbackReintegrationPayload(result)).shouldReintegrate, true);
});

test('executeWorkerTask hits reintegration wiring on daily_report success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-daily-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这是日报摘要',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /日报已生成/);
  assert.ok((result.outputNotePaths?.length || 0) > 0);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'daily_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: `${result.resultSummary} Continuity target: derived_outputs.`,
  });
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'daily_report_reintegration');
});

test('executeWorkerTask hits reintegration wiring on daily_report failed path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-daily-failed-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('daily-report-upstream-failure', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.resultSummary, null);
  assert.match(result.error || '', /API error: 500 daily-report-upstream-failure/);
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'daily_report',
    status: 'failed',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: `daily_report ended as failed; continuity remains observational only (${result.error}).`,
  });
});

test('executeWorkerTask hits reintegration wiring on daily_report cancelled path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-daily-cancelled-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;
  let taskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (taskId) {
      cancelWorkerTask(taskId);
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这条日报会在返回前触发取消',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'daily_report',
    input: { date: '2026-03-20' },
  });
  taskId = task.id;

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.resultSummary, null);
  assert.equal(result.error, '任务已取消');
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'daily_report',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: 'daily_report ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('executeWorkerTask hits reintegration wiring on weekly_report success path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-weekly-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这是周报摘要',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'weekly_report',
    input: { weekStart: '2026-03-16' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'succeeded');
  assert.match(result.resultSummary || '', /周报已生成/);
  assert.ok((result.outputNotePaths?.length || 0) > 0);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'weekly_report',
    status: 'succeeded',
    shouldReintegrate: true,
    target: 'derived_outputs',
    strength: 'medium',
    summary: `${result.resultSummary} Continuity target: derived_outputs.`,
  });
  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.signalKind, 'weekly_report_reintegration');
});

test('executeWorkerTask hits reintegration wiring on weekly_report failed path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-weekly-failed-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response('weekly-report-upstream-failure', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'weekly_report',
    input: { weekStart: '2026-03-16' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.resultSummary, null);
  assert.match(result.error || '', /API error: 500 weekly-report-upstream-failure/);
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'weekly_report',
    status: 'failed',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: `weekly_report ended as failed; continuity remains observational only (${result.error}).`,
  });
});

test('executeWorkerTask hits reintegration wiring on failed supported path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-failed-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'openclaw_task',
    input: { instruction: 'test failed path', outputDimension: 'learning' },
  });

  const result = await executeWorkerTask(task.id);

  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /OpenClaw 未配置/);
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'openclaw_task',
    status: 'failed',
    shouldReintegrate: false,
    target: 'task_record',
    strength: 'low',
    summary: `openclaw_task ended as failed; continuity remains observational only (${result.error}).`,
  });
});

test('executeWorkerTask hits reintegration wiring on weekly_report cancelled path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-weekly-cancelled-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;
  let taskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (taskId) {
      cancelWorkerTask(taskId);
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: '这条周报会在返回前触发取消',
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({
    taskType: 'weekly_report',
    input: { weekStart: '2026-03-16' },
  });
  taskId = task.id;

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.resultSummary, null);
  assert.equal(result.error, '任务已取消');
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'weekly_report',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'derived_outputs',
    strength: 'low',
    summary: 'weekly_report ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('executeWorkerTask hits reintegration wiring on cancelled supported path', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-cancelled-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  let fetchCalls = 0;
  let taskId = '';

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (taskId) {
      cancelWorkerTask(taskId);
    }

    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: '取消中的摘要',
          summary: '这条摘要会在返回前触发取消',
          keyPoints: ['k1'],
        }),
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-cancelled', '/tmp/note-cancelled.md', 'note-cancelled.md', '取消测试笔记', 'note', 'learning', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '这是取消测试内容。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();
  const task = createWorkerTask({
    taskType: 'summarize_note',
    input: { noteId: 'note-cancelled', language: 'zh', maxLength: 200 },
    sourceNoteId: 'note-cancelled',
  });
  taskId = task.id;

  const result = await executeWorkerTask(task.id);

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.error, '任务已取消');
  assert.deepEqual(result.outputNotePaths, []);
  assert.doesNotThrow(() => createFeedbackReintegrationPayload(result));

  const continuity = integrateContinuity(createFeedbackReintegrationPayload(result));
  assert.deepEqual(continuity, {
    taskId: result.id,
    taskType: 'summarize_note',
    status: 'cancelled',
    shouldReintegrate: false,
    target: 'source_note',
    strength: 'low',
    summary: 'summarize_note ended as cancelled; continuity remains observational only (任务已取消).',
  });
});

test('upsertReintegrationRecord preserves accepted review metadata across outcome refreshes', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-upsert-preserve-accepted-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const reviewedAt = '2026-03-22T12:11:00.000Z';

  upsertReintegrationRecord({
    workerTaskId: 'manual-task-reintegration-preserve-accepted',
    sourceNoteId: 'note-reintegration-preserve-accepted',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'accepted before refresh',
    evidence: { source: 'test-initial' },
    reviewReason: 'accepted before refresh',
    reviewedAt,
    now: '2026-03-22T12:12:00.000Z',
  });

  const refreshed = upsertReintegrationRecord({
    workerTaskId: 'manual-task-reintegration-preserve-accepted',
    sourceNoteId: 'note-reintegration-preserve-accepted',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'accepted after refresh',
    evidence: { source: 'test-refresh' },
    now: '2026-03-22T12:13:00.000Z',
  });

  assert.equal(refreshed.reviewStatus, 'accepted');
  assert.equal(refreshed.reviewReason, 'accepted before refresh');
  assert.equal(refreshed.reviewedAt, reviewedAt);
  assert.equal(refreshed.summary, 'accepted after refresh');
  assert.deepEqual(refreshed.evidence, { source: 'test-refresh' });
});

test('upsertReintegrationRecord preserves rejected review metadata across outcome refreshes', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-upsert-preserve-rejected-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  const reviewedAt = '2026-03-22T13:11:00.000Z';

  upsertReintegrationRecord({
    workerTaskId: 'manual-task-reintegration-preserve-rejected',
    sourceNoteId: 'note-reintegration-preserve-rejected',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'failed',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'rejected',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'rejected before refresh',
    evidence: { source: 'test-initial' },
    reviewReason: 'rejected before refresh',
    reviewedAt,
    now: '2026-03-22T13:12:00.000Z',
  });

  const refreshed = upsertReintegrationRecord({
    workerTaskId: 'manual-task-reintegration-preserve-rejected',
    sourceNoteId: 'note-reintegration-preserve-rejected',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'failed',
    signalKind: 'daily_report_reintegration',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'rejected after refresh',
    evidence: { source: 'test-refresh' },
    now: '2026-03-22T13:13:00.000Z',
  });

  assert.equal(refreshed.reviewStatus, 'rejected');
  assert.equal(refreshed.reviewReason, 'rejected before refresh');
  assert.equal(refreshed.reviewedAt, reviewedAt);
  assert.equal(refreshed.summary, 'rejected after refresh');
  assert.deepEqual(refreshed.evidence, { source: 'test-refresh' });
});

test('approved create_event_node action reuses PR6 event promotion executor', async (t) => {
  const env = await createTestEnv('lifeos-pr2-create-event-node-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO reintegration_records (
      id, worker_task_id, source_note_id, soul_action_id, task_type, terminal_status,
      signal_kind, review_status, target, strength, summary, evidence_json,
      review_reason, created_at, updated_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'reint:create-event-node',
    'task-create-event-node',
    'note-create-event-node',
    'soul:update_persona_snapshot:note-create-event-node',
    'update_persona_snapshot',
    'succeeded',
    'persona_snapshot_reintegration',
    'accepted',
    'source_note',
    'medium',
    '稳定人格变化信号，值得沉淀为 event node。',
    JSON.stringify({ source: 'test' }),
    'accepted for create_event_node coverage',
    '2026-03-20T09:00:00.000Z',
    '2026-03-20T09:00:00.000Z',
    '2026-03-20T09:00:00.000Z',
  );

  const soulAction = approveSoulAction(
    'soul:create_event_node:reint:create-event-node',
    'approve create_event_node coverage',
    '2026-03-20T09:01:00.000Z',
  ) ?? getSoulActionBySourceReintegrationIdAndKind('reint:create-event-node', 'create_event_node');

  if (!soulAction) {
    getDb().prepare(`
      INSERT INTO soul_actions (
        id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
        created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'soul:create_event_node:reint:create-event-node',
      'reint:create-event-node',
      'reint:create-event-node',
      'create_event_node',
      'approved',
      'not_dispatched',
      'approve create_event_node coverage',
      null,
      '2026-03-20T09:00:00.000Z',
      '2026-03-20T09:01:00.000Z',
      '2026-03-20T09:01:00.000Z',
      null,
      null,
      null,
      null,
      null,
      null,
    );
  }

  const dispatchResult = await dispatchApprovedSoulAction('soul:create_event_node:reint:create-event-node');
  const eventNodes = listEventNodes();
  const createdAction = getSoulActionBySourceReintegrationIdAndKind('reint:create-event-node', 'create_event_node');

  assert.equal(dispatchResult.dispatched, true);
  assert.match(dispatchResult.reason, /已创建 event node|已更新 event node/);
  assert.ok(createdAction);
  assert.equal(createdAction?.executionStatus, 'succeeded');
  assert.equal(eventNodes.length, 1);
  assert.equal(eventNodes[0]?.sourceReintegrationId, 'reint:create-event-node');
});

test('acceptReintegrationRecordAndPlanPromotions auto-plans PR6 actions on acceptance', async (t) => {
  const env = await createTestEnv('lifeos-pr6-accept-plan-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-accept-plan',
    sourceNoteId: 'note-pr6-accept-plan',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly accept-plan summary',
    evidence: { source: 'test' },
    now: '2026-03-21T08:30:00.000Z',
  });

  const reintegrationRecord = getReintegrationRecordByWorkerTaskId('manual-task-pr6-accept-plan');
  assert.ok(reintegrationRecord);
  assert.equal(reintegrationRecord?.reviewStatus, 'pending_review');

  const acceptedResult = acceptReintegrationRecordAndPlanPromotions(reintegrationRecord!.id, 'accept and auto-plan PR6 promotions');
  assert.ok(acceptedResult);
  assert.equal(acceptedResult?.reintegrationRecord.reviewStatus, 'accepted');
  assert.equal(acceptedResult?.soulActions.length, 2);
  assert.deepEqual(
    acceptedResult?.soulActions.map((action) => action.actionKind).sort(),
    ['promote_continuity_record', 'promote_event_node'],
  );
  assert.ok(acceptedResult?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-accept-plan'));
  assert.ok(acceptedResult?.soulActions.every((action) => action.sourceReintegrationId === reintegrationRecord!.id));

  const persistedEventAction = getSoulActionByIdentityAndKind({
    sourceNoteId: 'note-pr6-accept-plan',
    sourceReintegrationId: reintegrationRecord!.id,
    actionKind: 'promote_event_node',
  });
  const persistedContinuityAction = getSoulActionByIdentityAndKind({
    sourceNoteId: 'note-pr6-accept-plan',
    sourceReintegrationId: reintegrationRecord!.id,
    actionKind: 'promote_continuity_record',
  });
  assert.ok(persistedEventAction);
  assert.ok(persistedContinuityAction);
});

test('acceptReintegrationRecordAndPlanPromotions reuses existing PR6 promotion actions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-accept-plan-idempotent-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-auto-plan',
    sourceNoteId: 'note-pr6-auto-plan',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly auto-plan summary',
    evidence: { source: 'test' },
    now: '2026-03-21T09:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-pr6-auto-plan');
  assert.ok(record);

  const firstAcceptance = acceptReintegrationRecordAndPlanPromotions(record!.id, 'first accept');
  assert.ok(firstAcceptance);
  assert.equal(firstAcceptance?.soulActions.length, 2);
  assert.ok(firstAcceptance?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-auto-plan'));
  assert.ok(firstAcceptance?.soulActions.every((action) => action.sourceReintegrationId === record!.id));

  const secondPlanned = planPromotionSoulActions(firstAcceptance!.reintegrationRecord);
  assert.equal(secondPlanned.length, 2);
  assert.equal(secondPlanned[0]?.id, firstAcceptance?.soulActions[0]?.id);
  assert.equal(secondPlanned[1]?.id, firstAcceptance?.soulActions[1]?.id);

  const promotionActions = getDb().prepare(`
    SELECT COUNT(*) as total
    FROM soul_actions
    WHERE source_reintegration_id = ?
      AND action_kind IN ('promote_event_node', 'promote_continuity_record')
  `).get(record!.id) as { total: number };
  assert.equal(promotionActions.total, 2);
});

test('acceptReintegrationRecordAndPlanPromotions turns accepted extract-task reintegration into a review-backed create_event_node follow-up', async (t) => {
  const env = await createTestEnv('lifeos-task-extraction-followup-event-plan-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-task-extraction-followup',
    sourceNoteId: 'note-task-extraction-followup',
    soulActionId: null,
    taskType: 'extract_tasks',
    terminalStatus: 'succeeded',
    signalKind: 'task_extraction_reintegration',
    reviewStatus: 'pending_review',
    target: 'task_record',
    strength: 'medium',
    summary: 'extract-task follow-up summary',
    evidence: {
      source: 'test',
      extractTaskCreated: 2,
      nextActionCandidate: {
        title: '整理周报素材',
        priority: 'high',
        due: '2026-03-22',
        outputNoteId: 'task-note-1',
      },
    },
    now: '2026-03-21T10:15:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-task-extraction-followup');
  assert.ok(record);

  const accepted = acceptReintegrationRecordAndPlanPromotions(record!.id, 'accept extract-task follow-up planning');
  assert.ok(accepted);
  assert.equal(accepted?.reintegrationRecord.reviewStatus, 'accepted');
  assert.equal(accepted?.soulActions.length, 1);
  assert.equal(accepted?.soulActions[0]?.actionKind, 'create_event_node');
  assert.equal(accepted?.soulActions[0]?.sourceNoteId, 'note-task-extraction-followup');
  assert.equal(accepted?.soulActions[0]?.sourceReintegrationId, record!.id);
  assert.equal('nextActionSummary' in accepted!, false);

  const acceptedNextActionSummary = getSharedReintegrationNextActionSummary(accepted!.reintegrationRecord);
  assert.equal(acceptedNextActionSummary?.createdCount, 2);
  assert.equal(acceptedNextActionSummary?.candidateTitle, '整理周报素材');

  const planned = planPromotionSoulActions(accepted!.reintegrationRecord);
  assert.equal(planned.length, 1);
  assert.equal(planned[0]?.id, accepted?.soulActions[0]?.id);
});

test('buildEventNodePromotionInput uses extract-task evidence for task-extraction reintegration follow-up events', () => {
  const record = {
    id: 'reint:task-extraction-followup-event',
    workerTaskId: 'task-task-extraction-followup-event',
    sourceNoteId: 'note-task-extraction-followup-event',
    soulActionId: null,
    taskType: 'extract_tasks',
    terminalStatus: 'succeeded',
    signalKind: 'task_extraction_reintegration',
    reviewStatus: 'accepted',
    target: 'task_record',
    strength: 'medium',
    summary: 'extract-task follow-up summary',
    evidence: {
      extractTaskCreated: 2,
      nextActionCandidate: {
        title: '整理周报素材',
        priority: 'high',
        due: '2026-03-22',
        outputNoteId: 'task-note-1',
      },
    },
    reviewReason: 'accepted extract-task follow-up',
    createdAt: '2026-03-22T10:00:00.000Z',
    updatedAt: '2026-03-22T10:10:00.000Z',
    reviewedAt: '2026-03-22T10:11:00.000Z',
  } as const;

  assert.deepEqual(buildEventNodePromotionInput(record, 'soul-action-task-extraction-event'), {
    sourceReintegrationId: record.id,
    sourceNoteId: record.sourceNoteId,
    sourceSoulActionId: record.soulActionId,
    promotionSoulActionId: 'soul-action-task-extraction-event',
    eventKind: 'milestone_report',
    title: '整理周报素材',
    summary: 'extract-task follow-up summary',
    threshold: 'high',
    status: 'active',
    evidence: record.evidence,
    explanation: {
      whyHighThreshold: 'review-backed PR6 promotion',
      whyNow: '整理周报素材',
      reviewBacked: true,
    },
    occurredAt: record.updatedAt,
  });
});

test('acceptReintegrationRecordAndPlanPromotions keeps promotion actions distinct across multiple reintegration records for the same source note', async (t) => {
  const env = await createTestEnv('lifeos-pr6-multi-reintegration-same-note-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();

  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-same-note-a',
    sourceNoteId: 'note-pr6-shared-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'first reintegration for shared note',
    evidence: { source: 'test', run: 'a' },
    now: '2026-03-22T01:00:00.000Z',
  });
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-same-note-b',
    sourceNoteId: 'note-pr6-shared-source',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'second reintegration for shared note',
    evidence: { source: 'test', run: 'b' },
    now: '2026-03-22T02:00:00.000Z',
  });

  const recordA = getReintegrationRecordByWorkerTaskId('manual-task-pr6-same-note-a');
  const recordB = getReintegrationRecordByWorkerTaskId('manual-task-pr6-same-note-b');
  assert.ok(recordA);
  assert.ok(recordB);
  assert.notEqual(recordA?.id, recordB?.id);

  const acceptedA = acceptReintegrationRecordAndPlanPromotions(recordA!.id, 'accept first shared-note reintegration');
  const acceptedB = acceptReintegrationRecordAndPlanPromotions(recordB!.id, 'accept second shared-note reintegration');
  assert.ok(acceptedA);
  assert.ok(acceptedB);
  assert.equal(acceptedA?.soulActions.length, 2);
  assert.equal(acceptedB?.soulActions.length, 2);
  assert.ok(acceptedA?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-shared-source'));
  assert.ok(acceptedB?.soulActions.every((action) => action.sourceNoteId === 'note-pr6-shared-source'));
  assert.ok(acceptedA?.soulActions.every((action) => action.sourceReintegrationId === recordA!.id));
  assert.ok(acceptedB?.soulActions.every((action) => action.sourceReintegrationId === recordB!.id));

  const plannedActions = getDb().prepare(`
    SELECT id, source_note_id, source_reintegration_id, action_kind
    FROM soul_actions
    WHERE source_note_id = ?
      AND action_kind IN ('promote_event_node', 'promote_continuity_record')
    ORDER BY source_reintegration_id, action_kind
  `).all('note-pr6-shared-source') as Array<{
    id: string;
    source_note_id: string;
    source_reintegration_id: string;
    action_kind: string;
  }>;

  assert.equal(plannedActions.length, 4);
  assert.deepEqual(
    plannedActions.map((action) => `${action.source_reintegration_id}:${action.action_kind}`),
    [
      `${recordA!.id}:promote_continuity_record`,
      `${recordA!.id}:promote_event_node`,
      `${recordB!.id}:promote_continuity_record`,
      `${recordB!.id}:promote_event_node`,
    ],
  );
});

test('accepted persona reintegration can plan and dispatch PR6 event and continuity promotions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-persona-promotion-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  getDb().prepare(`
    INSERT INTO notes (
      id, file_path, file_name, title, type, dimension, status, priority, privacy, date, due, tags, source, created, updated, content, indexed_at, file_modified_at
    ) VALUES (
      'note-pr6-persona', '/tmp/note-pr6-persona.md', 'note-pr6-persona.md', 'PR6 Persona 测试笔记', 'note', 'growth', 'done', 'medium', 'private', '2026-03-20', NULL, '[]', 'auto', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z', '我最近更专注长期主义、系统化推进与稳定节奏。', '2026-03-20T09:00:00.000Z', '2026-03-20T09:00:00.000Z'
    )
  `).run();

  const task = createWorkerTask({
    taskType: 'update_persona_snapshot',
    input: { noteId: 'note-pr6-persona' },
    sourceNoteId: 'note-pr6-persona',
  });
  const result = await executeWorkerTask(task.id);
  assert.equal(result.status, 'succeeded');

  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);

  const accepted = acceptReintegrationRecord(reintegrationRecord!.id, 'accept for PR6 promotion');
  assert.ok(accepted);
  assert.equal(accepted?.reviewStatus, 'accepted');

  const planned = planPromotionSoulActions(accepted!);
  assert.equal(planned.length, 2);
  assert.ok(planned.some((action) => action.actionKind === 'promote_event_node'));
  assert.ok(planned.some((action) => action.actionKind === 'promote_continuity_record'));

  const eventAction = planned.find((action) => action.actionKind === 'promote_event_node');
  const continuityAction = planned.find((action) => action.actionKind === 'promote_continuity_record');
  assert.ok(eventAction);
  assert.ok(continuityAction);

  getDb().prepare(`UPDATE soul_actions SET governance_status = 'approved', approved_at = updated_at WHERE id = ?`).run(eventAction!.id);
  getDb().prepare(`UPDATE soul_actions SET governance_status = 'approved', approved_at = updated_at WHERE id = ?`).run(continuityAction!.id);

  const { dispatchApprovedSoulAction } = await import('../src/soul/soulActionDispatcher.js');
  const eventDispatch = await dispatchApprovedSoulAction(eventAction!.id);
  const continuityDispatch = await dispatchApprovedSoulAction(continuityAction!.id);

  assert.equal(eventDispatch.dispatched, true);
  assert.equal(continuityDispatch.dispatched, true);

  const eventNodes = listEventNodes();
  const continuityRecords = listContinuityRecords();
  assert.equal(eventNodes.length, 1);
  assert.equal(continuityRecords.length, 1);
  assert.equal(eventNodes[0]?.sourceReintegrationId, reintegrationRecord!.id);
  assert.equal(continuityRecords[0]?.sourceReintegrationId, reintegrationRecord!.id);
});

test('generateSoulActionsFromOutcomePacket aligns worker outcome context with accepted reintegration outcome context for extract_tasks', () => {
  const task = buildTerminalTask('extract_tasks', {
    id: 'task-outcome-packet-extract',
    resultSummary: '已提取行动项',
    result: {
      title: '行动项提取',
      summary: '已提取 2 个行动项',
      created: 2,
      sourceNoteTitle: '源笔记',
      items: [
        {
          title: '整理周报素材',
          dimension: 'growth',
          priority: 'high',
          due: '2026-03-22',
          filePath: '/vault/growth/2026-03-22-整理周报素材.md',
        },
        {
          title: '补充复盘提纲',
          dimension: 'growth',
          priority: 'medium',
          due: null,
          filePath: '/vault/growth/2026-03-22-补充复盘提纲.md',
        },
      ],
    },
    outputNotes: [
      { id: 'task-note-1', title: '整理周报素材', filePath: '/vault/growth/2026-03-22-整理周报素材.md', fileName: '2026-03-22-整理周报素材.md' },
      { id: 'task-note-2', title: '补充复盘提纲', filePath: '/vault/growth/2026-03-22-补充复盘提纲.md', fileName: '2026-03-22-补充复盘提纲.md' },
    ],
    outputNotePaths: [
      '/vault/growth/2026-03-22-整理周报素材.md',
      '/vault/growth/2026-03-22-补充复盘提纲.md',
    ],
  });

  const packet = createFeedbackReintegrationPayload(task);
  const packetOutcome = generateSoulActionsFromOutcomePacket(packet);
  const recordInput = createReintegrationRecordInput(task);
  const record = {
    id: 'reint:task-outcome-packet-extract',
    workerTaskId: recordInput.workerTaskId,
    sourceNoteId: recordInput.sourceNoteId,
    soulActionId: recordInput.soulActionId,
    taskType: recordInput.taskType,
    terminalStatus: recordInput.terminalStatus,
    signalKind: recordInput.signalKind,
    reviewStatus: 'accepted',
    target: recordInput.target,
    strength: recordInput.strength,
    summary: recordInput.summary,
    evidence: recordInput.evidence,
    reviewReason: 'accepted extract-task packet alignment',
    createdAt: '2026-03-22T12:10:00.000Z',
    updatedAt: '2026-03-22T12:10:00.000Z',
    reviewedAt: '2026-03-22T12:11:00.000Z',
  } as const;
  const recordOutcome = describeReintegrationOutcome(record);

  assert.deepEqual(packetOutcome, recordOutcome);
});

test('describeReintegrationOutcome exposes next-action candidate and suggested action kinds from accepted extract-task evidence', async (t) => {
  const env = await createTestEnv('lifeos-reintegration-outcome-context-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-reintegration-outcome-context',
    sourceNoteId: 'note-reintegration-outcome-context',
    soulActionId: null,
    taskType: 'extract_tasks',
    terminalStatus: 'succeeded',
    signalKind: 'task_extraction_reintegration',
    reviewStatus: 'accepted',
    target: 'task_record',
    strength: 'medium',
    summary: 'reintegration outcome context summary',
    evidence: {
      extractTaskCreated: 1,
      nextActionCandidate: {
        title: '整理周报素材',
        dimension: 'growth',
        priority: 'high',
        due: '2026-03-22',
        filePath: '/vault/growth/2026-03-22-整理周报素材.md',
        outputNoteId: 'task-note-1',
      },
    },
    reviewReason: 'accepted reintegration outcome context',
    now: '2026-03-22T12:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-reintegration-outcome-context');
  assert.ok(record);

  const outcome = describeReintegrationOutcome(record!);
  assert.deepEqual(outcome.suggestedActionKinds, ['create_event_node']);
  assert.deepEqual(outcome.nextActionCandidate, {
    title: '整理周报素材',
    dimension: 'growth',
    priority: 'high',
    due: '2026-03-22',
    filePath: '/vault/growth/2026-03-22-整理周报素材.md',
    outputNoteId: 'task-note-1',
  });
});

test('generateSoulActionsFromOutcome creates the same accepted follow-up actions as planPromotionSoulActions for extract-task reintegration', async (t) => {
  const env = await createTestEnv('lifeos-outcome-generator-extract-task-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-outcome-generator-extract',
    sourceNoteId: 'note-outcome-generator-extract',
    soulActionId: null,
    taskType: 'extract_tasks',
    terminalStatus: 'succeeded',
    signalKind: 'task_extraction_reintegration',
    reviewStatus: 'accepted',
    target: 'task_record',
    strength: 'medium',
    summary: 'outcome generator extract-task summary',
    evidence: {
      extractTaskCreated: 1,
      nextActionCandidate: {
        title: '整理周报素材',
        priority: 'high',
        due: '2026-03-22',
        outputNoteId: 'task-note-1',
      },
    },
    reviewReason: 'accepted extract-task outcome generator test',
    now: '2026-03-22T11:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-outcome-generator-extract');
  assert.ok(record);

  const generated = generatePlannedSoulActions(record!);
  const planned = planPromotionSoulActions(record!);

  assert.equal(generated.length, 1);
  assert.equal(generated[0]?.actionKind, 'create_event_node');
  assert.deepEqual(
    generated.map((action) => action.id),
    planned.map((action) => action.id),
  );
});

test('accepted daily report reintegration plans PR6 event and continuity promotions', async (t) => {
  const env = await createTestEnv('lifeos-pr6-daily-promotion-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: '这是日报摘要' }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({ taskType: 'daily_report', input: { date: '2026-03-20' } });
  const result = await executeWorkerTask(task.id);
  assert.equal(result.status, 'succeeded');

  const reintegrationRecord = getReintegrationRecordByWorkerTaskId(task.id);
  assert.ok(reintegrationRecord);
  const accepted = acceptReintegrationRecord(reintegrationRecord!.id, 'accept daily report event and continuity');
  const planned = generatePlannedSoulActions(accepted!);
  assert.equal(planned.length, 2);
  assert.deepEqual(
    getPromotionActionKindsForReintegration(accepted!).sort(),
    ['promote_continuity_record', 'promote_event_node'],
  );
  assert.ok(planned.some((action) => action.actionKind === 'promote_event_node'));
  assert.ok(planned.some((action) => action.actionKind === 'promote_continuity_record'));
  assert.deepEqual(
    planned.map((action) => action.id).sort(),
    planPromotionSoulActions(accepted!).map((action) => action.id).sort(),
  );
});

test('acceptReintegrationRecord rejects repeated review state changes once a reintegration is already accepted', async (t) => {
  const env = await createTestEnv('lifeos-pr6-accept-review-finality-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-accept-review-finality',
    sourceNoteId: 'note-pr6-accept-review-finality',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'weekly accept finality summary',
    evidence: { source: 'test' },
    now: '2026-03-23T09:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-pr6-accept-review-finality');
  assert.ok(record);

  const accepted = acceptReintegrationRecord(record!.id, 'first accept finality');
  assert.ok(accepted);
  assert.equal(accepted?.reviewStatus, 'accepted');
  assert.equal(accepted?.reviewReason, 'first accept finality');

  assert.throws(
    () => rejectReintegrationRecord(record!.id, 'should not override accepted review'),
    /Only pending_review reintegration records can be marked as rejected/,
  );

  const persisted = getReintegrationRecord(record!.id);
  assert.equal(persisted?.reviewStatus, 'accepted');
  assert.equal(persisted?.reviewReason, 'first accept finality');
  assert.equal(persisted?.reviewedAt, accepted?.reviewedAt ?? null);
});

test('rejectReintegrationRecord rejects repeated review state changes once a reintegration is already rejected', async (t) => {
  const env = await createTestEnv('lifeos-pr6-reject-review-finality-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-reject-review-finality',
    sourceNoteId: 'note-pr6-reject-review-finality',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'failed',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily reject finality summary',
    evidence: { source: 'test' },
    now: '2026-03-23T09:10:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-pr6-reject-review-finality');
  assert.ok(record);

  const rejected = rejectReintegrationRecord(record!.id, 'first reject finality');
  assert.ok(rejected);
  assert.equal(rejected?.reviewStatus, 'rejected');
  assert.equal(rejected?.reviewReason, 'first reject finality');

  assert.throws(
    () => acceptReintegrationRecordAndPlanPromotions(record!.id, 'should not override rejected review'),
    /Only pending_review reintegration records can be marked as accepted/,
  );

  const persisted = getReintegrationRecord(record!.id);
  assert.equal(persisted?.reviewStatus, 'rejected');
  assert.equal(persisted?.reviewReason, 'first reject finality');
  assert.equal(persisted?.reviewedAt, rejected?.reviewedAt ?? null);
});

test('unaccepted reintegration cannot plan PR6 promotions', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-unaccepted-plan-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6',
    sourceNoteId: null,
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'manual summary',
    evidence: {},
    now: '2026-03-20T09:00:00.000Z',
  });

  const record = getReintegrationRecordByWorkerTaskId('manual-task-pr6');
  assert.ok(record);
  assert.throws(() => planPromotionSoulActions(record!), /accepted/);
});

test('dispatch blocks PR6 promotion when reintegration review is still pending', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-pending-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-pending-dispatch',
    sourceNoteId: 'note-pr6-pending-dispatch',
    soulActionId: null,
    taskType: 'weekly_report',
    terminalStatus: 'succeeded',
    signalKind: 'weekly_report_reintegration',
    reviewStatus: 'pending_review',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'pending review summary',
    evidence: { source: 'test' },
    now: '2026-03-20T09:30:00.000Z',
  });

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'soul:promote_event_node:reint:manual-task-pr6-pending-dispatch',
    'reint:manual-task-pr6-pending-dispatch',
    'reint:manual-task-pr6-pending-dispatch',
    'promote_event_node',
    'approved',
    'not_dispatched',
    'manually approved in test',
    null,
    '2026-03-20T09:30:00.000Z',
    '2026-03-20T09:30:00.000Z',
    '2026-03-20T09:30:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
  );

  await assert.rejects(
    () => dispatchApprovedSoulAction('soul:promote_event_node:reint:manual-task-pr6-pending-dispatch'),
    /accepted reintegration review/,
  );
  assert.equal(listEventNodes().length, 0);
});

test('accepted daily report continuity promotion dispatch creates daily_rhythm continuity record', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-daily-continuity-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-daily-continuity-dispatch',
    sourceNoteId: 'note-pr6-daily-continuity-dispatch',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'accepted',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'daily summary worth continuity promotion',
    evidence: { source: 'test', cadence: 'daily' },
    reviewReason: 'daily continuity accepted',
    now: '2026-03-20T10:30:00.000Z',
  });

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'soul:promote_continuity_record:reint:manual-task-pr6-daily-continuity-dispatch',
    'reint:manual-task-pr6-daily-continuity-dispatch',
    'reint:manual-task-pr6-daily-continuity-dispatch',
    'promote_continuity_record',
    'approved',
    'not_dispatched',
    'manually approved in test',
    null,
    '2026-03-20T10:30:00.000Z',
    '2026-03-20T10:30:00.000Z',
    '2026-03-20T10:30:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
  );

  const dispatchResult = await dispatchApprovedSoulAction('soul:promote_continuity_record:reint:manual-task-pr6-daily-continuity-dispatch');
  const continuityRecords = listContinuityRecords();

  assert.equal(dispatchResult.dispatched, true);
  assert.match(dispatchResult.reason, /已创建 continuity record|已更新 continuity record/);
  assert.equal(continuityRecords.length, 1);
  assert.equal(continuityRecords[0]?.continuityKind, 'daily_rhythm');
  assert.equal(continuityRecords[0]?.target, 'derived_outputs');
  assert.equal(continuityRecords[0]?.continuity.scope, 'daily');
});

test('dispatch blocks daily-report PR6 continuity promotion when reintegration review was rejected', async (t) => {
  closeDb();
  const env = await createTestEnv('lifeos-pr6-daily-rejected-dispatch-');

  t.after(async () => {
    await env.cleanup();
  });

  initDatabase();
  upsertReintegrationRecord({
    workerTaskId: 'manual-task-pr6-daily-rejected-dispatch',
    sourceNoteId: 'note-pr6-daily-rejected-dispatch',
    soulActionId: null,
    taskType: 'daily_report',
    terminalStatus: 'succeeded',
    signalKind: 'daily_report_reintegration',
    reviewStatus: 'rejected',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'rejected daily continuity summary',
    evidence: { source: 'test', cadence: 'daily' },
    reviewReason: 'not enough continuity evidence',
    now: '2026-03-20T11:00:00.000Z',
  });

  getDb().prepare(`
    INSERT INTO soul_actions (
      id, source_note_id, source_reintegration_id, action_kind, governance_status, execution_status, governance_reason, worker_task_id,
      created_at, updated_at, approved_at, deferred_at, discarded_at, started_at, finished_at, error, result_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'soul:promote_continuity_record:reint:manual-task-pr6-daily-rejected-dispatch',
    'reint:manual-task-pr6-daily-rejected-dispatch',
    'reint:manual-task-pr6-daily-rejected-dispatch',
    'promote_continuity_record',
    'approved',
    'not_dispatched',
    'manually approved in test',
    null,
    '2026-03-20T11:00:00.000Z',
    '2026-03-20T11:00:00.000Z',
    '2026-03-20T11:00:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
  );

  await assert.rejects(
    () => dispatchApprovedSoulAction('soul:promote_continuity_record:reint:manual-task-pr6-daily-rejected-dispatch'),
    /accepted reintegration review/,
  );
  assert.equal(listContinuityRecords().length, 0);
});


test('terminal hook does not directly create PR6 event or continuity objects', async (t) => {
  const env = await createTestEnv('lifeos-pr6-no-direct-promotion-');
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: '这是周报摘要' }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    await env.cleanup();
  });

  initDatabase();
  const task = createWorkerTask({ taskType: 'weekly_report', input: { weekStart: '2026-03-16' } });
  const result = await executeWorkerTask(task.id);
  assert.equal(result.status, 'succeeded');
  assert.equal(listEventNodes().length, 0);
  assert.equal(listContinuityRecords().length, 0);
});

test('feedback reintegration rejects unsupported or non-terminal tasks', () => {
  const unsupportedTask = {
    ...buildTerminalTask('summarize_note'),
    id: 'task-unsupported',
    taskType: 'unsupported_task',
  } as unknown as WorkerTask;
  assert.throws(() => createFeedbackReintegrationPayload(unsupportedTask), /Unsupported reintegration task type/);

  const runningTask = buildTerminalTask('daily_report', {
    status: 'running',
    finishedAt: null,
  });
  assert.throws(() => createFeedbackReintegrationPayload(runningTask), /requires a terminal WorkerTask/);
});
