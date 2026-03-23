import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import {
  getProjectionContinuitySummary,
  getProjectionExplanationSummary,
  getReintegrationNextActionSummary,
  getReintegrationOutcomeDisplaySummary,
  type AcceptReintegrationRecordResponse,
  type DispatchSoulActionResponse,
  type ListReintegrationRecordsResponse,
  type RejectReintegrationRecordResponse,
  type ListSoulActionsResponse,
  type PlanReintegrationPromotionsResponse,
  type SoulActionResponse,
  type WorkerTask,
  type WsEvent,
} from '@lifeos/shared';
import { createTestEnv } from './helpers/testEnv.js';
import { startServer, stopServer } from '../src/index.js';
import { initDatabase } from '../src/db/client.js';
import { upsertReintegrationRecord } from '../src/soul/reintegrationRecords.js';
import { upsertEventNode } from '../src/soul/eventNodes.js';
import { upsertContinuityRecord } from '../src/soul/continuityRecords.js';
import { createOrReuseSoulAction } from '../src/soul/soulActions.js';

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for condition');
}

async function api<T>(baseUrl: string, pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data as T;
}

async function openWebSocket(url: string, timeoutMs = 10000): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      cleanup();
      socket.close();
      reject(new Error('Timed out connecting to WebSocket server'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener('open', onOpen);
      socket.removeListener('error', onError);
    }

    function onOpen() {
      cleanup();
      resolve(socket);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    socket.once('open', onOpen);
    socket.once('error', onError);
  });
}

type SoulActionWsEvent = Extract<WsEvent, { type: 'soul-action-updated' }>;
type ReintegrationRecordWsEvent = Extract<WsEvent, { type: 'reintegration-record-updated' }>;
type WorkerTaskWsEvent = Extract<WsEvent, { type: 'worker-task-updated' }>;
type NoteWorkerTasksUpdatedWsEvent = Extract<WsEvent, { type: 'note-worker-tasks-updated' }>;

async function waitForWebSocketEvent<T>(socket: WebSocket, predicate: (payload: T) => boolean, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for websocket event'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener('message', onMessage);
      socket.removeListener('error', onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onMessage(raw: string | Buffer | ArrayBuffer | Buffer[]) {
      try {
        const text = Array.isArray(raw)
          ? Buffer.concat(raw).toString()
          : Buffer.isBuffer(raw)
            ? raw.toString()
            : raw instanceof ArrayBuffer
              ? Buffer.from(raw).toString()
              : raw;
        const payload = JSON.parse(text) as T;
        if (!predicate(payload)) {
          return;
        }
        cleanup();
        resolve(payload);
      } catch {
        // Ignore non-JSON frames.
      }
    }

    socket.on('message', onMessage);
    socket.once('error', onError);
  });
}

test('reintegration list API supports source-note scoping for main-path projection reads', async () => {
  const env = await createTestEnv('lifeos-reintegration-source-note-filter-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-filter-note-1',
      sourceNoteId: 'note-filter-1',
      soulActionId: null,
      taskType: 'extract_tasks',
      terminalStatus: 'succeeded',
      signalKind: 'task_extraction_reintegration',
      reviewStatus: 'accepted',
      target: 'task_record',
      strength: 'medium',
      summary: 'first scoped reintegration record',
      evidence: { source: 'api-test-filter-1' },
      reviewReason: null,
      now: '2026-03-22T12:00:00.000Z',
    });
    upsertReintegrationRecord({
      workerTaskId: 'api-filter-note-2',
      sourceNoteId: 'note-filter-2',
      soulActionId: null,
      taskType: 'extract_tasks',
      terminalStatus: 'succeeded',
      signalKind: 'task_extraction_reintegration',
      reviewStatus: 'pending_review',
      target: 'task_record',
      strength: 'medium',
      summary: 'second scoped reintegration record',
      evidence: { source: 'api-test-filter-2' },
      reviewReason: null,
      now: '2026-03-22T12:01:00.000Z',
    });

    const scoped = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?sourceNoteId=note-filter-1',
    );
    assert.deepEqual(scoped.filters, { sourceNoteId: 'note-filter-1' });
    assert.equal(scoped.reintegrationRecords.length, 1);
    assert.equal(scoped.reintegrationRecords[0]?.workerTaskId, 'api-filter-note-1');
    assert.equal(scoped.reintegrationRecords[0]?.sourceNoteId, 'note-filter-1');
    assert.equal(scoped.reintegrationRecords[0]?.displaySummary?.plannedActionCount, 0);
    assert.equal(scoped.reintegrationRecords[0]?.displaySummary?.nextActionCreatedCount, null);
    assert.deepEqual(
      scoped.reintegrationRecords[0]?.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: [],
        nextActionSummary: scoped.reintegrationRecords[0]?.nextActionSummary ?? null,
      }, scoped.reintegrationRecords[0]!),
    );

    const acceptedScoped = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=accepted&sourceNoteId=note-filter-1',
    );
    assert.deepEqual(acceptedScoped.filters, { reviewStatus: 'accepted', sourceNoteId: 'note-filter-1' });
    assert.equal(acceptedScoped.reintegrationRecords.length, 1);
    assert.equal(acceptedScoped.reintegrationRecords[0]?.workerTaskId, 'api-filter-note-1');
    assert.deepEqual(
      acceptedScoped.reintegrationRecords[0]?.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: [],
        nextActionSummary: acceptedScoped.reintegrationRecords[0]?.nextActionSummary ?? null,
      }, acceptedScoped.reintegrationRecords[0]!),
    );
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('rejected reintegration record does not leak persisted event or continuity projections through follow-up lists', async () => {
  const env = await createTestEnv('lifeos-reintegration-rejected-projection-visibility-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    const record = upsertReintegrationRecord({
      workerTaskId: 'api-pr6-rejected-projection-visibility',
      sourceNoteId: 'note-api-pr6-rejected-projection-visibility',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'rejected',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'rejected reintegration should hide stale projections',
      evidence: { source: 'api-rejected-projection-visibility-test' },
      reviewReason: 'rejected for projection visibility coverage',
      reviewedAt: '2026-03-22T14:10:00.000Z',
      now: '2026-03-22T14:10:00.000Z',
    });

    upsertEventNode({
      sourceReintegrationId: record.id,
      sourceNoteId: record.sourceNoteId,
      sourceSoulActionId: null,
      promotionSoulActionId: 'soul:promote_event_node:reint:api-pr6-rejected-projection-visibility',
      eventKind: 'milestone_report',
      title: 'stale rejected event node',
      summary: 'should not leak through rejected record follow-up queries',
      threshold: 'high',
      status: 'active',
      evidence: { source: 'api-rejected-projection-visibility-test' },
      explanation: { why: 'stale projection artifact' },
      occurredAt: '2026-03-22T14:11:00.000Z',
      now: '2026-03-22T14:11:00.000Z',
    });

    upsertContinuityRecord({
      sourceReintegrationId: record.id,
      sourceNoteId: record.sourceNoteId,
      sourceSoulActionId: null,
      promotionSoulActionId: 'soul:promote_continuity_record:reint:api-pr6-rejected-projection-visibility',
      continuityKind: 'daily_rhythm',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'stale rejected continuity record',
      continuity: { scope: 'daily', claim: 'stale' },
      evidence: { source: 'api-rejected-projection-visibility-test' },
      explanation: { why: 'stale projection artifact' },
      recordedAt: '2026-03-22T14:12:00.000Z',
      now: '2026-03-22T14:12:00.000Z',
    });

    const rejectedRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=rejected',
    );
    const rejected = rejectedRecords.reintegrationRecords.find((item) => item.id === record.id);
    assert.ok(rejected);
    assert.equal(rejected?.reviewStatus, 'rejected');

    const eventNodes = await api<ListEventNodesResponse>(
      baseUrl,
      `/api/event-nodes?sourceReintegrationIds=${encodeURIComponent(record.id)}`,
    );
    const continuityRecords = await api<ListContinuityRecordsResponse>(
      baseUrl,
      `/api/continuity-records?sourceReintegrationIds=${encodeURIComponent(record.id)}`,
    );

    assert.deepEqual(eventNodes.filters.sourceReintegrationIds, [record.id]);
    assert.deepEqual(continuityRecords.filters.sourceReintegrationIds, [record.id]);
    assert.equal(eventNodes.eventNodes.length, 0);
    assert.equal(continuityRecords.continuityRecords.length, 0);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('accepted reintegration record still exposes persisted event and continuity projections through follow-up lists', async () => {
  const env = await createTestEnv('lifeos-reintegration-accepted-projection-visibility-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    const record = upsertReintegrationRecord({
      workerTaskId: 'api-pr6-accepted-projection-visibility',
      sourceNoteId: 'note-api-pr6-accepted-projection-visibility',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'accepted',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'accepted reintegration should expose persisted projections',
      evidence: { source: 'api-accepted-projection-visibility-test' },
      reviewReason: 'accepted for projection visibility coverage',
      reviewedAt: '2026-03-22T15:10:00.000Z',
      now: '2026-03-22T15:10:00.000Z',
    });

    const eventNode = upsertEventNode({
      sourceReintegrationId: record.id,
      sourceNoteId: record.sourceNoteId,
      sourceSoulActionId: null,
      promotionSoulActionId: 'soul:promote_event_node:reint:api-pr6-accepted-projection-visibility',
      eventKind: 'weekly_reflection',
      title: 'accepted projection event node',
      summary: 'should stay visible through accepted follow-up queries',
      threshold: 'high',
      status: 'active',
      evidence: { source: 'api-accepted-projection-visibility-test' },
      explanation: { why: 'accepted projection artifact' },
      occurredAt: '2026-03-22T15:11:00.000Z',
      now: '2026-03-22T15:11:00.000Z',
    });

    const continuityRecord = upsertContinuityRecord({
      sourceReintegrationId: record.id,
      sourceNoteId: record.sourceNoteId,
      sourceSoulActionId: null,
      promotionSoulActionId: 'soul:promote_continuity_record:reint:api-pr6-accepted-projection-visibility',
      continuityKind: 'weekly_theme',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'accepted projection continuity record',
      continuity: { scope: 'weekly', claim: 'accepted' },
      evidence: { source: 'api-accepted-projection-visibility-test' },
      explanation: { why: 'accepted projection artifact' },
      recordedAt: '2026-03-22T15:12:00.000Z',
      now: '2026-03-22T15:12:00.000Z',
    });

    const eventNodes = await api<ListEventNodesResponse>(
      baseUrl,
      `/api/event-nodes?sourceReintegrationIds=${encodeURIComponent(record.id)}`,
    );
    const continuityRecords = await api<ListContinuityRecordsResponse>(
      baseUrl,
      `/api/continuity-records?sourceReintegrationIds=${encodeURIComponent(record.id)}`,
    );

    assert.equal(eventNodes.eventNodes.length, 1);
    assert.equal(continuityRecords.continuityRecords.length, 1);
    assert.equal(eventNodes.eventNodes[0]?.id, eventNode.id);
    assert.equal(continuityRecords.continuityRecords[0]?.id, continuityRecord.id);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action defer and discard APIs keep governance detail and list views aligned', async () => {
  const env = await createTestEnv('lifeos-soul-action-defer-discard-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-soul-action-defer-discard',
      sourceNoteId: 'note-api-soul-action-defer-discard',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'accepted',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'defer discard review path',
      evidence: { source: 'api-test-defer-discard' },
      reviewReason: 'ready for governance api test',
      now: '2026-03-21T12:00:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records?reviewStatus=accepted');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-soul-action-defer-discard');
    assert.ok(record);

    const planned = await api<PlanReintegrationPromotionsResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/plan-promotions`,
      { method: 'POST' },
    );
    assert.equal(planned.soulActions.length, 2);

    const targetAction = planned.soulActions.find((action) => action.actionKind === 'promote_continuity_record') ?? planned.soulActions[0]!;

    const approved = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(targetAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve before defer' }),
      },
    );
    assert.equal(approved.soulAction.governanceStatus, 'approved');

    const deferred = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(targetAction.id)}/defer`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'defer for later review window' }),
      },
    );
    assert.equal(deferred.soulAction.id, targetAction.id);
    assert.equal(deferred.soulAction.governanceStatus, 'deferred');
    assert.equal(deferred.soulAction.governanceReason, 'defer for later review window');
    assert.ok(deferred.soulAction.deferredAt);
    assert.equal(deferred.soulAction.executionStatus, 'not_dispatched');

    const deferredDetail = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(targetAction.id)}`,
    );
    assert.equal(deferredDetail.soulAction.id, targetAction.id);
    assert.equal(deferredDetail.soulAction.governanceStatus, deferred.soulAction.governanceStatus);
    assert.equal(deferredDetail.soulAction.governanceReason, deferred.soulAction.governanceReason);
    assert.equal(deferredDetail.soulAction.deferredAt, deferred.soulAction.deferredAt);

    const deferredList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=deferred`,
    );
    assert.equal(deferredList.filters.sourceReintegrationId, record!.id);
    assert.equal(deferredList.soulActions.length, 1);
    assert.equal(deferredList.soulActions[0]?.id, targetAction.id);
    assert.equal(deferredList.soulActions[0]?.sourceNoteId, 'note-api-soul-action-defer-discard');
    assert.equal(deferredList.soulActions[0]?.sourceReintegrationId, record!.id);
    assert.equal(deferredList.soulActions[0]?.governanceStatus, 'deferred');

    const discarded = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(targetAction.id)}/discard`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'discard after defer review' }),
      },
    );
    assert.equal(discarded.soulAction.id, targetAction.id);
    assert.equal(discarded.soulAction.governanceStatus, 'discarded');
    assert.equal(discarded.soulAction.governanceReason, 'discard after defer review');
    assert.ok(discarded.soulAction.discardedAt);
    assert.equal(discarded.soulAction.executionStatus, 'not_dispatched');

    const discardedDetail = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(targetAction.id)}`,
    );
    assert.equal(discardedDetail.soulAction.id, targetAction.id);
    assert.equal(discardedDetail.soulAction.governanceStatus, discarded.soulAction.governanceStatus);
    assert.equal(discardedDetail.soulAction.governanceReason, discarded.soulAction.governanceReason);
    assert.equal(discardedDetail.soulAction.discardedAt, discarded.soulAction.discardedAt);

    const discardedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=discarded`,
    );
    assert.equal(discardedList.filters.sourceReintegrationId, record!.id);
    assert.equal(discardedList.soulActions.length, 1);
    assert.equal(discardedList.soulActions[0]?.id, targetAction.id);
    assert.equal(discardedList.soulActions[0]?.sourceNoteId, 'note-api-soul-action-defer-discard');
    assert.equal(discardedList.soulActions[0]?.sourceReintegrationId, record!.id);
    assert.equal(discardedList.soulActions[0]?.governanceStatus, 'discarded');
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action defer and discard websocket events stay aligned with detail and list views', async () => {
  const env = await createTestEnv('lifeos-soul-action-defer-discard-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-soul-action-defer-discard-ws',
      sourceNoteId: 'note-api-soul-action-defer-discard-ws',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'accepted',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'defer discard websocket path',
      evidence: { source: 'api-test-defer-discard-ws' },
      reviewReason: 'ready for websocket governance api test',
      now: '2026-03-22T09:00:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records?reviewStatus=accepted');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-soul-action-defer-discard-ws');
    assert.ok(record);

    const planned = await api<PlanReintegrationPromotionsResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/plan-promotions`,
      { method: 'POST' },
    );
    assert.equal(planned.soulActions.length, 2);

    const targetAction = planned.soulActions.find((action) => action.actionKind === 'promote_continuity_record') ?? planned.soulActions[0]!;

    const approved = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(targetAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve before defer websocket test' }),
      },
    );
    assert.equal(approved.soulAction.governanceStatus, 'approved');

    const socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    try {
      const deferredWsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => event.type === 'soul-action-updated' && event.data.id === targetAction.id && event.data.governanceStatus === 'deferred',
      );
      const deferred = await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(targetAction.id)}/defer`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'defer for websocket review window' }),
        },
      );
      const deferredWsEvent = await deferredWsEventPromise;
      assert.equal(deferredWsEvent.data.id, deferred.soulAction.id);
      assert.equal(deferredWsEvent.data.sourceNoteId, deferred.soulAction.sourceNoteId);
      assert.equal(deferredWsEvent.data.sourceReintegrationId, deferred.soulAction.sourceReintegrationId);
      assert.equal(deferredWsEvent.data.governanceStatus, deferred.soulAction.governanceStatus);
      assert.equal(deferredWsEvent.data.executionStatus, deferred.soulAction.executionStatus);
      assert.equal(deferredWsEvent.data.deferredAt, deferred.soulAction.deferredAt);
      assert.equal(deferredWsEvent.data.discardedAt, deferred.soulAction.discardedAt);

      const deferredDetail = await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(targetAction.id)}`,
      );
      const deferredList = await api<ListSoulActionsResponse>(
        baseUrl,
        `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=deferred`,
      );
      assert.equal(deferredDetail.soulAction.governanceStatus, deferred.soulAction.governanceStatus);
      assert.equal(deferredDetail.soulAction.deferredAt, deferred.soulAction.deferredAt);
      assert.equal(deferredList.soulActions.length, 1);
      assert.equal(deferredList.soulActions[0]?.id, deferred.soulAction.id);
      assert.equal(deferredList.soulActions[0]?.deferredAt, deferred.soulAction.deferredAt);
      assert.equal(deferredList.soulActions[0]?.discardedAt, deferred.soulAction.discardedAt);

      const discardedWsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => event.type === 'soul-action-updated' && event.data.id === targetAction.id && event.data.governanceStatus === 'discarded',
      );
      const discarded = await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(targetAction.id)}/discard`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'discard after websocket defer review' }),
        },
      );
      const discardedWsEvent = await discardedWsEventPromise;
      assert.equal(discardedWsEvent.data.id, discarded.soulAction.id);
      assert.equal(discardedWsEvent.data.sourceNoteId, discarded.soulAction.sourceNoteId);
      assert.equal(discardedWsEvent.data.sourceReintegrationId, discarded.soulAction.sourceReintegrationId);
      assert.equal(discardedWsEvent.data.governanceStatus, discarded.soulAction.governanceStatus);
      assert.equal(discardedWsEvent.data.executionStatus, discarded.soulAction.executionStatus);
      assert.equal(discardedWsEvent.data.deferredAt, discarded.soulAction.deferredAt);
      assert.equal(discardedWsEvent.data.discardedAt, discarded.soulAction.discardedAt);

      const discardedDetail = await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(targetAction.id)}`,
      );
      const discardedList = await api<ListSoulActionsResponse>(
        baseUrl,
        `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=discarded`,
      );
      assert.equal(discardedDetail.soulAction.governanceStatus, discarded.soulAction.governanceStatus);
      assert.equal(discardedDetail.soulAction.discardedAt, discarded.soulAction.discardedAt);
      assert.equal(discardedList.soulActions.length, 1);
      assert.equal(discardedList.soulActions[0]?.id, discarded.soulAction.id);
      assert.equal(discardedList.soulActions[0]?.deferredAt, discarded.soulAction.deferredAt);
      assert.equal(discardedList.soulActions[0]?.discardedAt, discarded.soulAction.discardedAt);
    } finally {
      socket.close();
    }
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action list API supports sourceReintegrationId filtering independently from sourceNoteId', async () => {
  const env = await createTestEnv('lifeos-soul-action-source-reintegration-filter-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();

    const firstAction = createOrReuseSoulAction({
      sourceNoteId: 'note-source-reintegration-filter-a',
      sourceReintegrationId: 'reint:source-filter-target',
      actionKind: 'promote_event_node',
      governanceReason: 'source reintegration filter target a',
    });
    const secondAction = createOrReuseSoulAction({
      sourceNoteId: 'note-source-reintegration-filter-b',
      sourceReintegrationId: 'reint:source-filter-target',
      actionKind: 'promote_continuity_record',
      governanceReason: 'source reintegration filter target b',
    });
    createOrReuseSoulAction({
      sourceNoteId: 'note-source-reintegration-filter-c',
      sourceReintegrationId: 'reint:source-filter-other',
      actionKind: 'promote_event_node',
      governanceReason: 'source reintegration filter other',
    });

    const filtered = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent('reint:source-filter-target')}`,
    );

    assert.deepEqual(
      filtered.soulActions.map((action) => action.id).sort(),
      [firstAction.id, secondAction.id].sort(),
    );
    assert.ok(filtered.soulActions.every((action) => action.sourceReintegrationId === 'reint:source-filter-target'));
    assert.deepEqual(
      filtered.soulActions.map((action) => action.sourceNoteId).sort(),
      ['note-source-reintegration-filter-a', 'note-source-reintegration-filter-b'],
    );
    assert.equal(filtered.filters.sourceReintegrationId, 'reint:source-filter-target');
    assert.equal(filtered.filters.sourceNoteId, undefined);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action list API normalizes legacy reintegration note filters to sourceReintegrationId', async () => {
  const env = await createTestEnv('lifeos-soul-action-legacy-reint-note-filter-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();

    const legacyAction = createOrReuseSoulAction({
      sourceNoteId: 'reint:legacy-filter-target',
      sourceReintegrationId: null,
      actionKind: 'create_event_node',
      governanceReason: 'legacy reintegration note filter target',
    });
    createOrReuseSoulAction({
      sourceNoteId: 'note-plain-target',
      sourceReintegrationId: null,
      actionKind: 'extract_tasks',
      governanceReason: 'plain note filter control',
    });

    const filtered = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent('reint:legacy-filter-target')}`,
    );

    assert.deepEqual(filtered.soulActions.map((action) => action.id), [legacyAction.id]);
    assert.equal(filtered.soulActions[0]?.sourceNoteId, 'reint:legacy-filter-target');
    assert.equal(filtered.soulActions[0]?.sourceReintegrationId, 'reint:legacy-filter-target');
    assert.equal(filtered.filters.sourceNoteId, undefined);
    assert.equal(filtered.filters.sourceReintegrationId, 'reint:legacy-filter-target');
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration accept API returns reviewed record and planned soul actions', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-accept-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-accept',
      sourceNoteId: 'note-api-pr6',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api accept summary',
      evidence: {
        source: 'api-test',
        extractTaskCreated: 2,
        nextActionCandidate: {
          title: '整理周报素材',
          priority: 'high',
          due: '2026-03-22',
          outputNoteId: 'task-note-1',
        },
      },
      now: '2026-03-21T10:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-accept');
    assert.ok(record);
    assert.equal(record?.reviewStatus, 'pending_review');
    assert.deepEqual(record?.nextActionSummary, getReintegrationNextActionSummary(record!));

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept from api test' }),
      },
    );

    assert.equal(accepted.reintegrationRecord.id, record!.id);
    assert.equal(accepted.reintegrationRecord.reviewStatus, 'accepted');
    assert.deepEqual(accepted.nextActionSummary, getReintegrationNextActionSummary(accepted.reintegrationRecord));
    assert.deepEqual(accepted.displaySummary, getReintegrationOutcomeDisplaySummary(accepted, accepted.reintegrationRecord));
    assert.equal(accepted.displaySummary.plannedActionCount, 2);
    assert.equal(accepted.displaySummary.nextActionCreatedCount, 2);
    assert.equal(accepted.displaySummary.nextActionText, '整理周报素材（high · due 2026-03-22）');
    assert.equal(accepted.displaySummary.hasNextActionEvidence, true);
    assert.equal(accepted.nextActionSummary?.createdCount, 2);
    assert.equal(accepted.nextActionSummary?.candidateTitle, '整理周报素材');
    assert.equal(accepted.nextActionSummary?.candidatePriority, 'high');
    assert.equal(accepted.nextActionSummary?.candidateDue, '2026-03-22');
    assert.equal(accepted.nextActionSummary?.candidateOutputNoteId, 'task-note-1');
    assert.equal(accepted.soulActions.length, 2);
    assert.ok(accepted.soulActions.every((action) => action.promotionSummary?.sourceSummary === 'api accept summary'));
    assert.ok(accepted.soulActions.every((action) => action.promotionSummary?.primaryReason === 'accept from api test'));
    assert.ok(accepted.soulActions.every((action) => action.promotionSummary?.rationale));
    assert.ok(accepted.soulActions.every((action) => action.promotionSummary?.reviewBacked === true));
    assert.deepEqual(
      accepted.soulActions.map((action) => action.actionKind).sort(),
      ['promote_continuity_record', 'promote_event_node'],
    );
    assert.ok(accepted.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6'));
    assert.ok(accepted.soulActions.every((action) => action.sourceReintegrationId === record!.id));

    const listedByReintegration = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    assert.deepEqual(
      listedByReintegration.soulActions.map((action) => action.id).sort(),
      accepted.soulActions.map((action) => action.id).sort(),
    );
    assert.ok(listedByReintegration.soulActions.every((action) => action.promotionSummary?.sourceSummary === 'api accept summary'));
    assert.ok(listedByReintegration.soulActions.every((action) => action.promotionSummary?.primaryReason === 'accept from api test'));
    assert.ok(listedByReintegration.soulActions.every((action) => action.promotionSummary?.rationale));
    assert.equal(listedByReintegration.filters.sourceReintegrationId, record!.id);

    const acceptedRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=accepted',
    );
    const pendingRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=pending_review',
    );
    const acceptedFollowUp = acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id);
    const pendingFollowUp = pendingRecords.reintegrationRecords.find((item) => item.id === record!.id);

    assert.deepEqual(accepted.reintegrationRecord.nextActionSummary ?? null, getReintegrationNextActionSummary(accepted.reintegrationRecord));
    assert.deepEqual(accepted.nextActionSummary, accepted.reintegrationRecord.nextActionSummary);
    assert.deepEqual(accepted.displaySummary, accepted.reintegrationRecord.displaySummary);
    assert.deepEqual(
      accepted.reintegrationRecord.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: accepted.soulActions,
        nextActionSummary: accepted.reintegrationRecord.nextActionSummary ?? null,
      }, accepted.reintegrationRecord),
    );
    assert.ok(acceptedFollowUp);
    assert.equal(acceptedFollowUp?.id, accepted.reintegrationRecord.id);
    assert.equal(acceptedFollowUp?.reviewStatus, accepted.reintegrationRecord.reviewStatus);
    assert.equal(acceptedFollowUp?.reviewedAt, accepted.reintegrationRecord.reviewedAt);
    assert.deepEqual(
      acceptedFollowUp?.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: accepted.soulActions,
        nextActionSummary: acceptedFollowUp?.nextActionSummary ?? null,
      }, acceptedFollowUp!),
    );
    assert.equal(pendingFollowUp, undefined);

    const planned = await api<PlanReintegrationPromotionsResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/plan-promotions`,
      { method: 'POST' },
    );
    assert.deepEqual(planned.reintegrationRecord.nextActionSummary ?? null, getReintegrationNextActionSummary(planned.reintegrationRecord));
    assert.deepEqual(planned.nextActionSummary, planned.reintegrationRecord.nextActionSummary);
    assert.deepEqual(planned.displaySummary, planned.reintegrationRecord.displaySummary);
    assert.deepEqual(
      planned.reintegrationRecord.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: planned.soulActions,
        nextActionSummary: planned.reintegrationRecord.nextActionSummary ?? null,
      }, planned.reintegrationRecord),
    );
    assert.deepEqual(planned.nextActionSummary, getReintegrationNextActionSummary(record!));
    assert.deepEqual(planned.displaySummary, getReintegrationOutcomeDisplaySummary(planned, record!));
    assert.equal(planned.displaySummary.plannedActionCount, 2);
    assert.equal(planned.displaySummary.nextActionCreatedCount, 2);
    assert.equal(planned.displaySummary.nextActionText, '整理周报素材（high · due 2026-03-22）');
    assert.equal(planned.displaySummary.hasNextActionEvidence, true);
    assert.equal(planned.nextActionSummary?.createdCount, 2);
    assert.equal(planned.nextActionSummary?.candidateTitle, '整理周报素材');
    assert.equal(planned.nextActionSummary?.candidatePriority, 'high');
    assert.equal(planned.nextActionSummary?.candidateDue, '2026-03-22');
    assert.equal(planned.nextActionSummary?.candidateOutputNoteId, 'task-note-1');
    assert.equal(planned.soulActions.length, 2);
    assert.deepEqual(
      planned.soulActions.map((action) => action.id).sort(),
      accepted.soulActions.map((action) => action.id).sort(),
    );
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration reject API returns reviewed record and filtered follow-up lists stay aligned', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-reject-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-reject',
      sourceNoteId: null,
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'failed',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api reject summary',
      evidence: { source: 'api-test-reject' },
      now: '2026-03-21T11:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-reject');
    assert.ok(record);
    assert.equal(record?.reviewStatus, 'pending_review');

    const rejected = await api<RejectReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'reject from api test' }),
      },
    );

    assert.equal(rejected.reintegrationRecord.id, record!.id);
    assert.equal(rejected.reintegrationRecord.reviewStatus, 'rejected');
    assert.equal(rejected.reintegrationRecord.reviewReason, 'reject from api test');
    assert.ok(rejected.reintegrationRecord.reviewedAt);
    assert.deepEqual(rejected.reintegrationRecord.nextActionSummary ?? null, getReintegrationNextActionSummary(rejected.reintegrationRecord));
    assert.deepEqual(
      rejected.reintegrationRecord.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: [],
        nextActionSummary: rejected.reintegrationRecord.nextActionSummary ?? null,
      }, rejected.reintegrationRecord),
    );

    const rejectedRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=rejected',
    );
    const pendingRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=pending_review',
    );
    const rejectedFollowUp = rejectedRecords.reintegrationRecords.find((item) => item.id === record!.id);
    const pendingFollowUp = pendingRecords.reintegrationRecords.find((item) => item.id === record!.id);

    assert.ok(rejectedFollowUp);
    assert.equal(rejectedFollowUp?.id, rejected.reintegrationRecord.id);
    assert.equal(rejectedFollowUp?.reviewStatus, rejected.reintegrationRecord.reviewStatus);
    assert.equal(rejectedFollowUp?.reviewReason, rejected.reintegrationRecord.reviewReason);
    assert.equal(rejectedFollowUp?.reviewedAt, rejected.reintegrationRecord.reviewedAt);
    assert.deepEqual(
      rejectedFollowUp?.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: [],
        nextActionSummary: rejectedFollowUp?.nextActionSummary ?? null,
      }, rejectedFollowUp!),
    );
    assert.equal(pendingFollowUp, undefined);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration review APIs keep terminal review decisions immutable once accepted or rejected', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-review-finality-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-review-finality-accepted',
      sourceNoteId: 'note-api-pr6-review-finality-accepted',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api review finality accepted summary',
      evidence: { source: 'api-review-finality-test' },
      now: '2026-03-23T10:00:00.000Z',
    });
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-review-finality-rejected',
      sourceNoteId: 'note-api-pr6-review-finality-rejected',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'failed',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api review finality rejected summary',
      evidence: { source: 'api-review-finality-test' },
      now: '2026-03-23T10:05:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const acceptedRecord = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-review-finality-accepted');
    const rejectedRecord = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-review-finality-rejected');
    assert.ok(acceptedRecord);
    assert.ok(rejectedRecord);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(acceptedRecord!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept finality via api' }),
      },
    );
    assert.equal(accepted.reintegrationRecord.reviewStatus, 'accepted');
    assert.equal(accepted.reintegrationRecord.reviewReason, 'accept finality via api');

    await assert.rejects(
      api<RejectReintegrationRecordResponse>(
        baseUrl,
        `/api/reintegration-records/${encodeURIComponent(acceptedRecord!.id)}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'should fail after accept' }),
        },
      ),
      /Only pending_review reintegration records can be marked as rejected/,
    );

    const rejected = await api<RejectReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(rejectedRecord!.id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'reject finality via api' }),
      },
    );
    assert.equal(rejected.reintegrationRecord.reviewStatus, 'rejected');
    assert.equal(rejected.reintegrationRecord.reviewReason, 'reject finality via api');

    await assert.rejects(
      api<AcceptReintegrationRecordResponse>(
        baseUrl,
        `/api/reintegration-records/${encodeURIComponent(rejectedRecord!.id)}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'should fail after reject' }),
        },
      ),
      /Only pending_review reintegration records can be marked as accepted/,
    );

    const acceptedSnapshot = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records?reviewStatus=accepted');
    const rejectedSnapshot = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records?reviewStatus=rejected');
    const persistedAccepted = acceptedSnapshot.reintegrationRecords.find((item) => item.id === acceptedRecord!.id);
    const persistedRejected = rejectedSnapshot.reintegrationRecords.find((item) => item.id === rejectedRecord!.id);
    assert.equal(persistedAccepted?.reviewReason, 'accept finality via api');
    assert.equal(persistedAccepted?.reviewedAt, accepted.reintegrationRecord.reviewedAt);
    assert.equal(persistedRejected?.reviewReason, 'reject finality via api');
    assert.equal(persistedRejected?.reviewedAt, rejected.reintegrationRecord.reviewedAt);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration reject emits reintegration-record-updated websocket event aligned with follow-up lists', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-reject-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-reject-ws-refresh',
      sourceNoteId: null,
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'failed',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api reject websocket summary',
      evidence: { source: 'api-reject-ws-test' },
      now: '2026-03-22T01:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-reject-ws-refresh');
    assert.ok(record);

    const wsEventPromise = waitForWebSocketEvent<ReintegrationRecordWsEvent>(
      socket,
      (event) => event.type === 'reintegration-record-updated' && event.data.id === record!.id,
    );

    const rejected = await api<RejectReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'reject for websocket refresh test' }),
      },
    );

    const wsEvent = await wsEventPromise;
    assert.equal(wsEvent.data.id, rejected.reintegrationRecord.id);
    assert.equal(wsEvent.data.reviewStatus, 'rejected');
    assert.equal(wsEvent.data.reviewReason, rejected.reintegrationRecord.reviewReason);
    assert.equal(wsEvent.data.reviewedAt, rejected.reintegrationRecord.reviewedAt);
    assert.deepEqual(wsEvent.data.nextActionSummary ?? null, getReintegrationNextActionSummary(wsEvent.data));
    assert.deepEqual(
      wsEvent.data.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: [],
        nextActionSummary: wsEvent.data.nextActionSummary ?? null,
      }, wsEvent.data),
    );

    const rejectedRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=rejected',
    );
    const pendingRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=pending_review',
    );

    assert.equal(
      rejectedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.id,
      rejected.reintegrationRecord.id,
    );
    assert.equal(
      rejectedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.reviewedAt,
      wsEvent.data.reviewedAt,
    );
    assert.equal(
      pendingRecords.reintegrationRecords.find((item) => item.id === record!.id),
      undefined,
    );
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action list API keeps filters stable with multiple promotion actions and mixed governance states', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-filters-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-filter-a',
      sourceNoteId: 'note-api-pr6-filter-a',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api filter summary a',
      evidence: { source: 'api-filter-a' },
      now: '2026-03-21T13:00:00.000Z',
    });
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-filter-b',
      sourceNoteId: 'note-api-pr6-filter-b',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api filter summary b',
      evidence: { source: 'api-filter-b' },
      now: '2026-03-21T13:05:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const recordA = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-filter-a');
    const recordB = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-filter-b');
    assert.ok(recordA);
    assert.ok(recordB);

    const acceptedA = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordA!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept filter record a' }),
      },
    );
    const acceptedB = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordB!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept filter record b' }),
      },
    );
    assert.equal(acceptedA.soulActions.length, 2);
    assert.equal(acceptedB.soulActions.length, 2);

    const approvedAction = acceptedA.soulActions[0]!;
    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(approvedAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve one filter action' }),
      },
    );

    const pendingForA = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(recordA!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    assert.equal(pendingForA.filters.sourceReintegrationId, recordA!.id);
    assert.equal(pendingForA.filters.governanceStatus, 'pending_review');
    assert.equal(pendingForA.filters.executionStatus, 'not_dispatched');
    assert.equal(pendingForA.soulActions.length, 1);
    assert.ok(pendingForA.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-filter-a'));
    assert.ok(pendingForA.soulActions.every((action) => action.sourceReintegrationId === recordA!.id));
    assert.ok(pendingForA.soulActions.every((action) => action.governanceStatus === 'pending_review'));
    assert.ok(pendingForA.soulActions.every((action) => action.executionStatus === 'not_dispatched'));

    const approvedForA = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(recordA!.id)}&governanceStatus=approved`,
    );
    assert.equal(approvedForA.filters.sourceReintegrationId, recordA!.id);
    assert.equal(approvedForA.soulActions.length, 1);
    assert.equal(approvedForA.soulActions[0]?.id, approvedAction.id);
    assert.ok(approvedForA.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-filter-a'));
    assert.ok(approvedForA.soulActions.every((action) => action.sourceReintegrationId === recordA!.id));
    assert.ok(approvedForA.soulActions.every((action) => action.governanceStatus === 'approved'));

    const pendingForB = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(recordB!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    assert.equal(pendingForB.filters.sourceReintegrationId, recordB!.id);
    assert.equal(pendingForB.soulActions.length, 2);
    assert.ok(pendingForB.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-filter-b'));
    assert.ok(pendingForB.soulActions.every((action) => action.sourceReintegrationId === recordB!.id));
    assert.ok(pendingForB.soulActions.every((action) => action.governanceStatus === 'pending_review'));
    assert.ok(pendingForB.soulActions.every((action) => action.executionStatus === 'not_dispatched'));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action sourceNoteId stays aligned with reintegration ids for grouped settings view', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-grouping-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-grouping-a',
      sourceNoteId: 'note-api-pr6-grouping-a',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api grouping summary a',
      evidence: { source: 'api-grouping-a' },
      now: '2026-03-21T14:00:00.000Z',
    });
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-grouping-b',
      sourceNoteId: 'note-api-pr6-grouping-b',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api grouping summary b',
      evidence: { source: 'api-grouping-b' },
      now: '2026-03-21T14:05:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const recordA = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-grouping-a');
    const recordB = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-grouping-b');
    assert.ok(recordA);
    assert.ok(recordB);

    const acceptedA = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordA!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept grouping record a' }),
      },
    );
    const acceptedB = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordB!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept grouping record b' }),
      },
    );

    assert.equal(acceptedA.soulActions.length, 2);
    assert.equal(acceptedB.soulActions.length, 2);
    assert.ok(acceptedA.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-grouping-a'));
    assert.ok(acceptedA.soulActions.every((action) => action.sourceReintegrationId === recordA!.id));
    assert.ok(acceptedB.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-grouping-b'));
    assert.ok(acceptedB.soulActions.every((action) => action.sourceReintegrationId === recordB!.id));

    const allSoulActions = await api<ListSoulActionsResponse>(baseUrl, '/api/soul-actions');
    const groupedIds = new Map<string, Set<string>>();
    for (const action of allSoulActions.soulActions.filter((item) => item.sourceReintegrationId === recordA!.id || item.sourceReintegrationId === recordB!.id)) {
      const groupKey = action.sourceReintegrationId!;
      if (!groupedIds.has(groupKey)) {
        groupedIds.set(groupKey, new Set());
      }
      groupedIds.get(groupKey)!.add(action.id);
    }

    assert.deepEqual(
      [...groupedIds.keys()].sort(),
      [recordA!.id, recordB!.id].sort(),
    );
    assert.deepEqual(
      [...(groupedIds.get(recordA!.id) ?? new Set())].sort(),
      acceptedA.soulActions.map((action) => action.id).sort(),
    );
    assert.deepEqual(
      [...(groupedIds.get(recordB!.id) ?? new Set())].sort(),
      acceptedB.soulActions.map((action) => action.id).sort(),
    );
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action API preserves group-level pending and dispatch-ready semantics for settings view', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-group-semantics-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-group-semantics-a',
      sourceNoteId: 'note-api-pr6-group-semantics-a',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api group semantics summary a',
      evidence: { source: 'api-group-semantics-a' },
      now: '2026-03-21T15:00:00.000Z',
    });
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-group-semantics-b',
      sourceNoteId: 'note-api-pr6-group-semantics-b',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api group semantics summary b',
      evidence: { source: 'api-group-semantics-b' },
      now: '2026-03-21T15:05:00.000Z',
    });
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-group-semantics-c',
      sourceNoteId: 'note-api-pr6-group-semantics-c',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api group semantics summary c',
      evidence: { source: 'api-group-semantics-c' },
      now: '2026-03-21T15:10:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const recordA = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-group-semantics-a');
    const recordB = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-group-semantics-b');
    const recordC = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-group-semantics-c');
    assert.ok(recordA);
    assert.ok(recordB);
    assert.ok(recordC);

    const acceptedA = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordA!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept group semantics record a' }),
      },
    );
    const acceptedB = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordB!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept group semantics record b' }),
      },
    );
    const acceptedC = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(recordC!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept group semantics record c' }),
      },
    );

    for (const action of acceptedA.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve full dispatch-ready group a' }),
        },
      );
    }

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(acceptedB.soulActions[0]!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve partial group b' }),
      },
    );

    for (const action of acceptedC.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve and dispatch group c' }),
        },
      );
      await api<DispatchSoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/dispatch`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    }

    const allSoulActions = await api<ListSoulActionsResponse>(baseUrl, '/api/soul-actions');
    const groups = new Map<string, { totalCount: number; pendingCount: number; dispatchReadyCount: number }>();
    for (const action of allSoulActions.soulActions.filter((item) => item.sourceReintegrationId === recordA!.id || item.sourceReintegrationId === recordB!.id || item.sourceReintegrationId === recordC!.id)) {
      const groupKey = action.sourceReintegrationId!;
      const current = groups.get(groupKey) ?? { totalCount: 0, pendingCount: 0, dispatchReadyCount: 0 };
      current.totalCount += 1;
      if (action.governanceStatus === 'pending_review') {
        current.pendingCount += 1;
      }
      if (action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched') {
        current.dispatchReadyCount += 1;
      }
      groups.set(groupKey, current);
    }

    assert.ok(acceptedA.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-group-semantics-a'));
    assert.ok(acceptedA.soulActions.every((action) => action.sourceReintegrationId === recordA!.id));
    assert.ok(acceptedB.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-group-semantics-b'));
    assert.ok(acceptedB.soulActions.every((action) => action.sourceReintegrationId === recordB!.id));
    assert.ok(acceptedC.soulActions.every((action) => action.sourceNoteId === 'note-api-pr6-group-semantics-c'));
    assert.ok(acceptedC.soulActions.every((action) => action.sourceReintegrationId === recordC!.id));

    assert.deepEqual(groups.get(recordA!.id), {
      totalCount: acceptedA.soulActions.length,
      pendingCount: 0,
      dispatchReadyCount: acceptedA.soulActions.length,
    });
    assert.deepEqual(groups.get(recordB!.id), {
      totalCount: acceptedB.soulActions.length,
      pendingCount: acceptedB.soulActions.length - 1,
      dispatchReadyCount: 1,
    });
    assert.deepEqual(groups.get(recordC!.id), {
      totalCount: acceptedC.soulActions.length,
      pendingCount: 0,
      dispatchReadyCount: 0,
    });
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration accept websocket updates stay aligned with follow-up pending filters for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-accept-ws-filter-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-accept-ws-filter-followup',
      sourceNoteId: 'note-api-pr6-accept-ws-filter-followup',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api accept websocket filter follow-up summary',
      evidence: { source: 'api-accept-ws-filter-followup-test' },
      now: '2026-03-22T00:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-accept-ws-filter-followup');
    assert.ok(record);

    const seenActionIds = new Set<string>();
    const wsEventsPromise = Promise.all([
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 2;
        },
      ),
    ]);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for websocket filter follow-up accept test' }),
      },
    );

    const wsEvents = await wsEventsPromise;
    assert.equal(accepted.soulActions.length, 2);
    assert.deepEqual(
      [...seenActionIds].sort(),
      accepted.soulActions.map((action) => action.id).sort(),
    );
    assert.ok(wsEvents.every((event) => event.data.governanceStatus === 'pending_review'));
    assert.ok(wsEvents.every((event) => event.data.executionStatus === 'not_dispatched'));

    const fullAfterAccept = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterAccept = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );

    assert.equal(fullAfterAccept.soulActions.length, accepted.soulActions.length);
    assert.equal(pendingAfterAccept.soulActions.length, accepted.soulActions.length);
    assert.deepEqual(
      pendingAfterAccept.soulActions.map((action) => action.id).sort(),
      accepted.soulActions.map((action) => action.id).sort(),
    );
    assert.deepEqual(
      pendingAfterAccept.soulActions.map((action) => action.id).sort(),
      wsEvents.map((event) => event.data.id).sort(),
    );
    assert.ok(fullAfterAccept.soulActions.every((action) => action.governanceStatus === 'pending_review'));
    assert.ok(fullAfterAccept.soulActions.every((action) => action.executionStatus === 'not_dispatched'));
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration accept emits reintegration-record-updated websocket event aligned with follow-up lists', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-accept-record-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-accept-record-ws-refresh',
      sourceNoteId: 'note-api-pr6-accept-record-ws-refresh',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api accept reintegration-record websocket summary',
      evidence: { source: 'api-accept-record-ws-test' },
      now: '2026-03-22T01:30:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-accept-record-ws-refresh');
    assert.ok(record);

    const recordEventPromise = waitForWebSocketEvent<ReintegrationRecordWsEvent>(
      socket,
      (event) => event.type === 'reintegration-record-updated' && event.data.id === record!.id,
    );
    const seenActionIds = new Set<string>();
    const actionEventsPromise = Promise.all([
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 2;
        },
      ),
    ]);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for reintegration-record websocket test' }),
      },
    );

    const recordEvent = await recordEventPromise;
    const actionEvents = await actionEventsPromise;
    assert.equal(recordEvent.data.id, accepted.reintegrationRecord.id);
    assert.equal(recordEvent.data.reviewStatus, accepted.reintegrationRecord.reviewStatus);
    assert.equal(recordEvent.data.reviewReason, accepted.reintegrationRecord.reviewReason);
    assert.equal(recordEvent.data.reviewedAt, accepted.reintegrationRecord.reviewedAt);
    assert.deepEqual(recordEvent.data.nextActionSummary ?? null, getReintegrationNextActionSummary(recordEvent.data));
    assert.deepEqual(recordEvent.data.nextActionSummary, accepted.nextActionSummary);
    assert.deepEqual(recordEvent.data.displaySummary, accepted.displaySummary);
    assert.deepEqual(recordEvent.data.nextActionSummary, accepted.reintegrationRecord.nextActionSummary);
    assert.deepEqual(recordEvent.data.displaySummary, accepted.reintegrationRecord.displaySummary);
    assert.deepEqual(
      recordEvent.data.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: accepted.soulActions,
        nextActionSummary: recordEvent.data.nextActionSummary ?? null,
      }, recordEvent.data),
    );
    assert.equal(accepted.soulActions.length, 2);
    assert.deepEqual(
      [...seenActionIds].sort(),
      accepted.soulActions.map((action) => action.id).sort(),
    );
    assert.ok(actionEvents.every((event) => event.data.sourceReintegrationId === record!.id));

    const acceptedRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=accepted',
    );
    const pendingRecords = await api<ListReintegrationRecordsResponse>(
      baseUrl,
      '/api/reintegration-records?reviewStatus=pending_review',
    );

    assert.equal(
      acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.id,
      accepted.reintegrationRecord.id,
    );
    assert.deepEqual(
      acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.nextActionSummary,
      accepted.reintegrationRecord.nextActionSummary,
    );
    assert.equal(
      acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.reviewedAt,
      recordEvent.data.reviewedAt,
    );
    assert.deepEqual(
      acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: accepted.soulActions,
        nextActionSummary: acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id)?.nextActionSummary ?? null,
      }, acceptedRecords.reintegrationRecords.find((item) => item.id === record!.id)!),
    );
    assert.equal(
      pendingRecords.reintegrationRecords.find((item) => item.id === record!.id),
      undefined,
    );
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration manual planning emits reintegration-record-updated websocket event aligned with follow-up lists', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-plan-record-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-plan-record-ws-refresh',
      sourceNoteId: 'note-api-pr6-plan-record-ws-refresh',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'accepted',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api manual planning reintegration-record websocket summary',
      evidence: { source: 'api-plan-record-ws-test' },
      now: '2026-03-22T01:55:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-plan-record-ws-refresh');
    assert.ok(record);

    const recordEventPromise = waitForWebSocketEvent<ReintegrationRecordWsEvent>(
      socket,
      (event) => event.type === 'reintegration-record-updated' && event.data.id === record!.id,
    );
    const seenActionIds = new Set<string>();
    const actionEventsPromise = Promise.all([
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 2;
        },
      ),
    ]);

    const planned = await api<PlanReintegrationPromotionsResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/plan-promotions`,
      { method: 'POST' },
    );

    const recordEvent = await recordEventPromise;
    const actionEvents = await actionEventsPromise;
    assert.equal(planned.soulActions.length, 2);
    assert.equal(recordEvent.data.id, record!.id);
    assert.equal(recordEvent.data.reviewStatus, record!.reviewStatus);
    assert.equal(recordEvent.data.reviewReason, record!.reviewReason);
    assert.equal(recordEvent.data.reviewedAt, record!.reviewedAt);
    assert.deepEqual(recordEvent.data.nextActionSummary ?? null, getReintegrationNextActionSummary(recordEvent.data));
    assert.deepEqual(recordEvent.data.nextActionSummary, planned.nextActionSummary);
    assert.deepEqual(recordEvent.data.displaySummary, planned.displaySummary);
    assert.deepEqual(recordEvent.data.nextActionSummary, planned.reintegrationRecord.nextActionSummary);
    assert.deepEqual(recordEvent.data.displaySummary, planned.reintegrationRecord.displaySummary);
    assert.deepEqual(
      recordEvent.data.displaySummary,
      getReintegrationOutcomeDisplaySummary({
        soulActions: planned.soulActions,
        nextActionSummary: recordEvent.data.nextActionSummary ?? null,
      }, recordEvent.data),
    );
    assert.deepEqual(
      [...seenActionIds].sort(),
      planned.soulActions.map((action) => action.id).sort(),
    );
    assert.ok(actionEvents.every((event) => event.data.sourceReintegrationId === record!.id));

    const fullAfterPlan = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterPlan = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );

    assert.equal(fullAfterPlan.soulActions.length, planned.soulActions.length);
    assert.equal(pendingAfterPlan.soulActions.length, planned.soulActions.length);
    assert.deepEqual(
      pendingAfterPlan.soulActions.map((action) => action.id).sort(),
      planned.soulActions.map((action) => action.id).sort(),
    );
    assert.ok(fullAfterPlan.soulActions.every((action) => action.governanceStatus === 'pending_review'));
    assert.ok(fullAfterPlan.soulActions.every((action) => action.executionStatus === 'not_dispatched'));
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('reintegration accept emits soul-action-updated websocket events for planned settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-accept-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-accept-ws-refresh',
      sourceNoteId: 'note-api-pr6-accept-ws-refresh',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api accept websocket summary',
      evidence: { source: 'api-accept-ws-test' },
      now: '2026-03-21T17:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-accept-ws-refresh');
    assert.ok(record);

    const seenActionIds = new Set<string>();
    const wsEventsPromise = Promise.all([
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceReintegrationId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 2;
        },
      ),
    ]);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for websocket plan api test' }),
      },
    );

    const wsEvents = await wsEventsPromise;
    assert.equal(accepted.reintegrationRecord.id, record!.id);
    assert.equal(accepted.soulActions.length, 2);
    assert.deepEqual(
      [...seenActionIds].sort(),
      accepted.soulActions.map((action) => action.id).sort(),
    );
    assert.deepEqual(
      wsEvents.map((event) => event.data.sourceNoteId),
      ['note-api-pr6-accept-ws-refresh', 'note-api-pr6-accept-ws-refresh'],
    );
    assert.deepEqual(
      wsEvents.map((event) => event.data.sourceReintegrationId),
      [record!.id, record!.id],
    );
    assert.ok(wsEvents.every((event) => event.data.governanceStatus === 'pending_review'));
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('dispatch response worker task stays aligned with websocket and follow-up worker task list for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-dispatch-task-ws-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    const sourceNoteId = '2025-02-01.md';
    const firstAction = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'extract_tasks',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T01:00:00.000Z',
      governanceReason: 'approved for dispatch task websocket follow-up test',
    });
    const secondAction = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'update_persona_snapshot',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T01:01:00.000Z',
      governanceReason: 'approved for dispatch task websocket follow-up test',
    });

    const firstTaskEventPromise = waitForWebSocketEvent<WorkerTaskWsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated' && event.data.sourceNoteId === sourceNoteId && event.data.taskType === 'extract_tasks',
    );
    const firstNoteTaskEventPromise = waitForWebSocketEvent<NoteWorkerTasksUpdatedWsEvent>(
      socket,
      (event) => event.type === 'note-worker-tasks-updated' && event.data.sourceNoteId === sourceNoteId && event.data.task.taskType === 'extract_tasks',
    );

    const firstDispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(firstDispatched.soulAction?.id, firstAction.id);
    assert.equal(firstDispatched.soulAction?.sourceNoteId, sourceNoteId);
    assert.ok(firstDispatched.result.workerTaskId);
    assert.ok(firstDispatched.task);
    assert.equal(firstDispatched.task?.id, firstDispatched.result.workerTaskId);
    assert.equal(firstDispatched.task?.sourceNoteId, sourceNoteId);
    assert.equal(firstDispatched.task?.taskType, 'extract_tasks');
    assert.equal(firstDispatched.task?.worker, 'lifeos');
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(firstDispatched.task!.status));
    assert.equal(firstDispatched.result.executionSummary?.objectType, 'worker_task');
    assert.equal(firstDispatched.result.executionSummary?.objectId, firstDispatched.task?.id ?? null);
    assert.equal(firstDispatched.result.reason, firstDispatched.soulAction?.resultSummary ?? firstDispatched.task?.error ?? 'approved soul action dispatched through worker host');

    const firstTaskEvent = await firstTaskEventPromise;
    const firstNoteTaskEvent = await firstNoteTaskEventPromise;
    assert.equal(firstTaskEvent.data.id, firstDispatched.task?.id);
    assert.equal(firstTaskEvent.data.sourceNoteId, firstDispatched.task?.sourceNoteId);
    assert.equal(firstTaskEvent.data.taskType, firstDispatched.task?.taskType);
    assert.equal(firstTaskEvent.data.worker, firstDispatched.task?.worker);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(firstTaskEvent.data.status));
    assert.equal(firstNoteTaskEvent.data.sourceNoteId, firstDispatched.task?.sourceNoteId);
    assert.equal(firstNoteTaskEvent.data.task.id, firstDispatched.task?.id);
    assert.equal(firstNoteTaskEvent.data.task.taskType, firstDispatched.task?.taskType);
    assert.equal(firstNoteTaskEvent.data.task.worker, firstDispatched.task?.worker);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(firstNoteTaskEvent.data.task.status));
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(firstDispatched.task!.status));

    const secondTaskEventPromise = waitForWebSocketEvent<WorkerTaskWsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated' && event.data.sourceNoteId === sourceNoteId && event.data.taskType === 'update_persona_snapshot',
    );
    const secondNoteTaskEventPromise = waitForWebSocketEvent<NoteWorkerTasksUpdatedWsEvent>(
      socket,
      (event) => event.type === 'note-worker-tasks-updated' && event.data.sourceNoteId === sourceNoteId && event.data.task.taskType === 'update_persona_snapshot',
    );

    const secondDispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(secondDispatched.soulAction?.id, secondAction.id);
    assert.equal(secondDispatched.soulAction?.sourceNoteId, sourceNoteId);
    assert.ok(secondDispatched.result.workerTaskId);
    assert.ok(secondDispatched.task);
    assert.equal(secondDispatched.task?.id, secondDispatched.result.workerTaskId);
    assert.equal(secondDispatched.task?.sourceNoteId, sourceNoteId);
    assert.equal(secondDispatched.task?.taskType, 'update_persona_snapshot');
    assert.equal(secondDispatched.task?.worker, 'lifeos');
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(secondDispatched.task!.status));
    assert.equal(secondDispatched.result.executionSummary?.objectType, 'worker_task');
    assert.equal(secondDispatched.result.executionSummary?.objectId, secondDispatched.task?.id ?? null);
    assert.equal(secondDispatched.result.reason, secondDispatched.soulAction?.resultSummary ?? secondDispatched.task?.error ?? 'approved soul action dispatched through worker host');

    const secondTaskEvent = await secondTaskEventPromise;
    const secondNoteTaskEvent = await secondNoteTaskEventPromise;
    assert.equal(secondTaskEvent.data.id, secondDispatched.task?.id);
    assert.equal(secondTaskEvent.data.sourceNoteId, secondDispatched.task?.sourceNoteId);
    assert.equal(secondTaskEvent.data.taskType, secondDispatched.task?.taskType);
    assert.equal(secondTaskEvent.data.worker, secondDispatched.task?.worker);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(secondTaskEvent.data.status));
    assert.equal(secondNoteTaskEvent.data.sourceNoteId, secondDispatched.task?.sourceNoteId);
    assert.equal(secondNoteTaskEvent.data.task.id, secondDispatched.task?.id);
    assert.equal(secondNoteTaskEvent.data.task.taskType, secondDispatched.task?.taskType);
    assert.equal(secondNoteTaskEvent.data.task.worker, secondDispatched.task?.worker);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(secondNoteTaskEvent.data.task.status));
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(secondDispatched.task!.status));

    const workerTasksAfterDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}`,
    );
    const extractTaskFilteredWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=extract_tasks`,
    );
    const personaTaskFilteredWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=update_persona_snapshot`,
    );
    const extractStatusFilteredWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=extract_tasks&status=${encodeURIComponent(firstDispatched.task!.status)}`,
    );
    const personaStatusFilteredWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=update_persona_snapshot&status=${encodeURIComponent(secondDispatched.task!.status)}`,
    );
    const statusFilteredWorkerTasksAfterFirstDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&status=${encodeURIComponent(firstDispatched.task!.status)}`,
    );
    const statusFilteredWorkerTasksAfterSecondDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&status=${encodeURIComponent(secondDispatched.task!.status)}`,
    );
    const extractWorkerStatusFilteredWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=extract_tasks&worker=lifeos&status=${encodeURIComponent(firstDispatched.task!.status)}`,
    );
    const personaWorkerStatusFilteredWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=update_persona_snapshot&worker=lifeos&status=${encodeURIComponent(secondDispatched.task!.status)}`,
    );
    const workerStatusFilteredWorkerTasksAfterFirstDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&worker=lifeos&status=${encodeURIComponent(firstDispatched.task!.status)}`,
    );
    const workerStatusFilteredWorkerTasksAfterSecondDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&worker=lifeos&status=${encodeURIComponent(secondDispatched.task!.status)}`,
    );
    const workerFilteredWorkerTasksAfterDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&worker=lifeos`,
    );

    const allTaskIds = workerTasksAfterDispatch.tasks.map((task) => task.id);
    const extractTask = extractTaskFilteredWorkerTasks.tasks.find((task) => task.id === firstDispatched.result.workerTaskId);
    const personaTask = personaTaskFilteredWorkerTasks.tasks.find((task) => task.id === secondDispatched.result.workerTaskId);
    const extractStatusFilteredTask = extractStatusFilteredWorkerTasks.tasks.find((task) => task.id === firstDispatched.result.workerTaskId);
    const personaStatusFilteredTask = personaStatusFilteredWorkerTasks.tasks.find((task) => task.id === secondDispatched.result.workerTaskId);
    const statusFilteredFirstTask = statusFilteredWorkerTasksAfterFirstDispatch.tasks.find((task) => task.id === firstDispatched.result.workerTaskId);
    const statusFilteredSecondTask = statusFilteredWorkerTasksAfterSecondDispatch.tasks.find((task) => task.id === secondDispatched.result.workerTaskId);
    const extractWorkerStatusFilteredTask = extractWorkerStatusFilteredWorkerTasks.tasks.find((task) => task.id === firstDispatched.result.workerTaskId);
    const personaWorkerStatusFilteredTask = personaWorkerStatusFilteredWorkerTasks.tasks.find((task) => task.id === secondDispatched.result.workerTaskId);
    const workerStatusFilteredFirstTask = workerStatusFilteredWorkerTasksAfterFirstDispatch.tasks.find((task) => task.id === firstDispatched.result.workerTaskId);
    const workerStatusFilteredSecondTask = workerStatusFilteredWorkerTasksAfterSecondDispatch.tasks.find((task) => task.id === secondDispatched.result.workerTaskId);
    const workerFilteredFirstTask = workerFilteredWorkerTasksAfterDispatch.tasks.find((task) => task.id === firstDispatched.result.workerTaskId);
    const workerFilteredSecondTask = workerFilteredWorkerTasksAfterDispatch.tasks.find((task) => task.id === secondDispatched.result.workerTaskId);

    assert.equal(workerTasksAfterDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(extractTaskFilteredWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(extractTaskFilteredWorkerTasks.filters.taskType, 'extract_tasks');
    assert.equal(personaTaskFilteredWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(personaTaskFilteredWorkerTasks.filters.taskType, 'update_persona_snapshot');
    assert.equal(extractStatusFilteredWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(extractStatusFilteredWorkerTasks.filters.taskType, 'extract_tasks');
    assert.equal(extractStatusFilteredWorkerTasks.filters.status, firstDispatched.task!.status);
    assert.equal(personaStatusFilteredWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(personaStatusFilteredWorkerTasks.filters.taskType, 'update_persona_snapshot');
    assert.equal(personaStatusFilteredWorkerTasks.filters.status, secondDispatched.task!.status);
    assert.equal(statusFilteredWorkerTasksAfterFirstDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(statusFilteredWorkerTasksAfterFirstDispatch.filters.status, firstDispatched.task!.status);
    assert.equal(statusFilteredWorkerTasksAfterSecondDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(statusFilteredWorkerTasksAfterSecondDispatch.filters.status, secondDispatched.task!.status);
    assert.equal(extractWorkerStatusFilteredWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(extractWorkerStatusFilteredWorkerTasks.filters.taskType, 'extract_tasks');
    assert.equal(extractWorkerStatusFilteredWorkerTasks.filters.worker, 'lifeos');
    assert.equal(extractWorkerStatusFilteredWorkerTasks.filters.status, firstDispatched.task!.status);
    assert.equal(personaWorkerStatusFilteredWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(personaWorkerStatusFilteredWorkerTasks.filters.taskType, 'update_persona_snapshot');
    assert.equal(personaWorkerStatusFilteredWorkerTasks.filters.worker, 'lifeos');
    assert.equal(personaWorkerStatusFilteredWorkerTasks.filters.status, secondDispatched.task!.status);
    assert.equal(workerStatusFilteredWorkerTasksAfterFirstDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(workerStatusFilteredWorkerTasksAfterFirstDispatch.filters.worker, 'lifeos');
    assert.equal(workerStatusFilteredWorkerTasksAfterFirstDispatch.filters.status, firstDispatched.task!.status);
    assert.equal(workerStatusFilteredWorkerTasksAfterSecondDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(workerStatusFilteredWorkerTasksAfterSecondDispatch.filters.worker, 'lifeos');
    assert.equal(workerStatusFilteredWorkerTasksAfterSecondDispatch.filters.status, secondDispatched.task!.status);
    assert.equal(workerFilteredWorkerTasksAfterDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(workerFilteredWorkerTasksAfterDispatch.filters.worker, 'lifeos');

    assert.ok(allTaskIds.includes(firstDispatched.result.workerTaskId!));
    assert.ok(allTaskIds.includes(secondDispatched.result.workerTaskId!));
    assert.ok(extractTask);
    assert.ok(personaTask);
    assert.ok(extractStatusFilteredTask);
    assert.ok(personaStatusFilteredTask);
    assert.equal(extractTask?.id, firstDispatched.task?.id);
    assert.equal(extractTask?.sourceNoteId, firstDispatched.task?.sourceNoteId);
    assert.equal(extractTask?.taskType, firstDispatched.task?.taskType);
    assert.equal(extractTask?.worker, firstDispatched.task?.worker);
    assert.equal(extractTask?.status, firstDispatched.task?.status);
    assert.equal(personaTask?.id, secondDispatched.task?.id);
    assert.equal(personaTask?.sourceNoteId, secondDispatched.task?.sourceNoteId);
    assert.equal(personaTask?.taskType, secondDispatched.task?.taskType);
    assert.equal(personaTask?.worker, secondDispatched.task?.worker);
    assert.equal(personaTask?.status, secondDispatched.task?.status);
    assert.equal(extractStatusFilteredTask?.id, firstDispatched.task?.id);
    assert.equal(extractStatusFilteredTask?.status, firstDispatched.task?.status);
    assert.equal(personaStatusFilteredTask?.id, secondDispatched.task?.id);
    assert.equal(personaStatusFilteredTask?.status, secondDispatched.task?.status);
    assert.equal(extractWorkerStatusFilteredTask?.id, firstDispatched.task?.id);
    assert.equal(extractWorkerStatusFilteredTask?.worker, firstDispatched.task?.worker);
    assert.equal(extractWorkerStatusFilteredTask?.status, firstDispatched.task?.status);
    assert.equal(personaWorkerStatusFilteredTask?.id, secondDispatched.task?.id);
    assert.equal(personaWorkerStatusFilteredTask?.worker, secondDispatched.task?.worker);
    assert.equal(personaWorkerStatusFilteredTask?.status, secondDispatched.task?.status);
    assert.equal(workerFilteredFirstTask?.id, firstDispatched.task?.id);
    assert.equal(workerFilteredFirstTask?.taskType, firstDispatched.task?.taskType);
    assert.equal(workerFilteredSecondTask?.id, secondDispatched.task?.id);
    assert.equal(workerFilteredSecondTask?.taskType, secondDispatched.task?.taskType);

    assert.ok(statusFilteredFirstTask);
    assert.ok(statusFilteredSecondTask);
    assert.ok(extractWorkerStatusFilteredTask);
    assert.ok(personaWorkerStatusFilteredTask);
    assert.ok(workerStatusFilteredFirstTask);
    assert.ok(workerStatusFilteredSecondTask);
    assert.ok(workerFilteredFirstTask);
    assert.ok(workerFilteredSecondTask);

    assert.equal(extractTask?.id, firstTaskEvent.data.id);
    assert.equal(extractTask?.sourceNoteId, firstTaskEvent.data.sourceNoteId);
    assert.equal(extractTask?.taskType, firstTaskEvent.data.taskType);
    assert.equal(extractTask?.worker, firstTaskEvent.data.worker);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(extractTask!.status));
    assert.equal(personaTask?.id, secondTaskEvent.data.id);
    assert.equal(personaTask?.sourceNoteId, secondTaskEvent.data.sourceNoteId);
    assert.equal(personaTask?.taskType, secondTaskEvent.data.taskType);
    assert.equal(personaTask?.worker, secondTaskEvent.data.worker);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(personaTask!.status));

    assert.equal(extractTask?.id, firstDispatched.task?.id);
    assert.equal(extractTask?.sourceNoteId, firstDispatched.task?.sourceNoteId);
    assert.equal(extractTask?.taskType, firstDispatched.task?.taskType);
    assert.equal(extractStatusFilteredTask?.id, firstDispatched.task?.id);
    assert.equal(extractStatusFilteredTask?.status, firstDispatched.task?.status);
    assert.equal(statusFilteredFirstTask?.id, firstDispatched.task?.id);
    assert.equal(statusFilteredFirstTask?.status, firstDispatched.task?.status);
    assert.equal(extractWorkerStatusFilteredTask?.id, firstDispatched.task?.id);
    assert.equal(extractWorkerStatusFilteredTask?.worker, firstDispatched.task?.worker);
    assert.equal(extractWorkerStatusFilteredTask?.status, firstDispatched.task?.status);
    assert.equal(workerStatusFilteredFirstTask?.id, firstDispatched.task?.id);
    assert.equal(workerStatusFilteredFirstTask?.worker, firstDispatched.task?.worker);
    assert.equal(workerStatusFilteredFirstTask?.status, firstDispatched.task?.status);
    assert.equal(personaTask?.id, secondDispatched.task?.id);
    assert.equal(personaTask?.sourceNoteId, secondDispatched.task?.sourceNoteId);
    assert.equal(personaTask?.taskType, secondDispatched.task?.taskType);
    assert.equal(personaStatusFilteredTask?.id, secondDispatched.task?.id);
    assert.equal(personaStatusFilteredTask?.status, secondDispatched.task?.status);
    assert.equal(statusFilteredSecondTask?.id, secondDispatched.task?.id);
    assert.equal(statusFilteredSecondTask?.status, secondDispatched.task?.status);
    assert.equal(personaWorkerStatusFilteredTask?.id, secondDispatched.task?.id);
    assert.equal(personaWorkerStatusFilteredTask?.worker, secondDispatched.task?.worker);
    assert.equal(personaWorkerStatusFilteredTask?.status, secondDispatched.task?.status);
    assert.equal(workerStatusFilteredSecondTask?.id, secondDispatched.task?.id);
    assert.equal(workerStatusFilteredSecondTask?.worker, secondDispatched.task?.worker);
    assert.equal(workerStatusFilteredSecondTask?.status, secondDispatched.task?.status);

    assert.equal(workerFilteredFirstTask?.worker, firstDispatched.task?.worker);
    assert.equal(workerFilteredSecondTask?.worker, secondDispatched.task?.worker);
    assert.equal(workerFilteredFirstTask?.sourceNoteId, sourceNoteId);
    assert.equal(workerFilteredSecondTask?.sourceNoteId, sourceNoteId);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(extractTask!.status));
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(personaTask!.status));
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('mixed worker-host dispatch response tasks stay aligned with follow-up worker-task filters', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-mixed-dispatch-task-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    const sourceNoteId = '2025-02-02.md';
    const firstAction = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'extract_tasks',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T03:00:00.000Z',
      governanceReason: 'approved for mixed dispatch task follow-up test',
    });
    const secondAction = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'update_persona_snapshot',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T03:01:00.000Z',
      governanceReason: 'approved for mixed dispatch task follow-up test',
    });

    const firstDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const mixedSoulActions = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(sourceNoteId)}`,
    );
    const mixedById = new Map(mixedSoulActions.soulActions.map((action) => [action.id, action]));
    const workerTasksAfterFirstDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=extract_tasks&worker=lifeos&status=${encodeURIComponent(firstDispatch.task!.status)}`,
    );
    const firstTask = workerTasksAfterFirstDispatch.tasks.find((task) => task.id === firstDispatch.task!.id);

    assert.ok(firstDispatch.task);
    assert.ok(firstDispatch.result.workerTaskId);
    assert.equal(firstDispatch.task.id, firstDispatch.result.workerTaskId);
    assert.equal(firstDispatch.task.sourceNoteId, sourceNoteId);
    assert.equal(firstDispatch.task.taskType, 'extract_tasks');
    assert.equal(firstDispatch.task.worker, 'lifeos');
    assert.ok(firstTask);
    assert.equal(firstTask?.id, firstDispatch.task.id);
    assert.equal(firstTask?.sourceNoteId, firstDispatch.task.sourceNoteId);
    assert.equal(firstTask?.taskType, firstDispatch.task.taskType);
    assert.equal(firstTask?.worker, firstDispatch.task.worker);
    assert.equal(workerTasksAfterFirstDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(workerTasksAfterFirstDispatch.filters.taskType, 'extract_tasks');
    assert.equal(workerTasksAfterFirstDispatch.filters.worker, 'lifeos');
    assert.equal(workerTasksAfterFirstDispatch.filters.status, firstDispatch.task.status);
    assert.equal(mixedById.get(firstAction.id)?.executionStatus, firstDispatch.soulAction!.executionStatus);
    assert.equal(mixedById.get(secondAction.id)?.executionStatus, 'not_dispatched');

    const secondDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const workerTasksAfterSecondDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=update_persona_snapshot&worker=lifeos&status=${encodeURIComponent(secondDispatch.task!.status)}`,
    );
    const secondTask = workerTasksAfterSecondDispatch.tasks.find((task) => task.id === secondDispatch.task!.id);

    assert.ok(secondDispatch.task);
    assert.ok(secondDispatch.result.workerTaskId);
    assert.equal(secondDispatch.task.id, secondDispatch.result.workerTaskId);
    assert.equal(secondDispatch.task.sourceNoteId, sourceNoteId);
    assert.equal(secondDispatch.task.taskType, 'update_persona_snapshot');
    assert.equal(secondDispatch.task.worker, 'lifeos');
    assert.ok(secondTask);
    assert.equal(secondTask?.id, secondDispatch.task.id);
    assert.equal(secondTask?.sourceNoteId, secondDispatch.task.sourceNoteId);
    assert.equal(secondTask?.taskType, secondDispatch.task.taskType);
    assert.equal(secondTask?.worker, secondDispatch.task.worker);
    assert.equal(workerTasksAfterSecondDispatch.filters.sourceNoteId, sourceNoteId);
    assert.equal(workerTasksAfterSecondDispatch.filters.taskType, 'update_persona_snapshot');
    assert.equal(workerTasksAfterSecondDispatch.filters.worker, 'lifeos');
    assert.equal(workerTasksAfterSecondDispatch.filters.status, secondDispatch.task.status);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('mixed worker-host dispatch response tasks stay aligned with websocket events and filtered follow-up worker-task lists', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-mixed-dispatch-task-ws-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    const sourceNoteId = '2025-02-03.md';
    const firstAction = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'extract_tasks',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T04:00:00.000Z',
      governanceReason: 'approved for mixed dispatch websocket follow-up test',
    });
    const secondAction = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'update_persona_snapshot',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T04:01:00.000Z',
      governanceReason: 'approved for mixed dispatch websocket follow-up test',
    });

    const firstTaskEventPromise = waitForWebSocketEvent<WorkerTaskWsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated' && event.data.sourceNoteId === sourceNoteId && event.data.taskType === 'extract_tasks',
    );
    const firstNoteTaskEventPromise = waitForWebSocketEvent<NoteWorkerTasksUpdatedWsEvent>(
      socket,
      (event) => event.type === 'note-worker-tasks-updated' && event.data.sourceNoteId === sourceNoteId && event.data.task.taskType === 'extract_tasks',
    );

    const firstDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    const firstTaskEvent = await firstTaskEventPromise;
    const firstNoteTaskEvent = await firstNoteTaskEventPromise;

    const firstWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=extract_tasks&worker=lifeos&status=${encodeURIComponent(firstDispatch.task!.status)}`,
    );
    const firstFilteredTask = firstWorkerTasks.tasks.find((task) => task.id === firstDispatch.task!.id);

    assert.ok(firstDispatch.task);
    assert.ok(firstDispatch.result.workerTaskId);
    assert.equal(firstDispatch.result.executionSummary?.objectType, 'worker_task');
    assert.equal(firstDispatch.result.executionSummary?.objectId, firstDispatch.task?.id ?? null);
    assert.equal(firstDispatch.result.reason, firstDispatch.soulAction?.resultSummary ?? firstDispatch.task?.error ?? 'approved soul action dispatched through worker host');
    assert.equal(firstDispatch.task.id, firstDispatch.result.workerTaskId);
    assert.equal(firstDispatch.task.id, firstTaskEvent.data.id);
    assert.equal(firstDispatch.task.sourceNoteId, firstTaskEvent.data.sourceNoteId);
    assert.equal(firstDispatch.task.taskType, firstTaskEvent.data.taskType);
    assert.equal(firstDispatch.task.worker, firstTaskEvent.data.worker);
    assert.equal(firstDispatch.task.id, firstNoteTaskEvent.data.task.id);
    assert.equal(firstDispatch.task.sourceNoteId, firstNoteTaskEvent.data.sourceNoteId);
    assert.equal(firstDispatch.task.taskType, firstNoteTaskEvent.data.task.taskType);
    assert.equal(firstDispatch.task.worker, firstNoteTaskEvent.data.task.worker);
    assert.equal(firstDispatch.task.id, firstFilteredTask?.id);
    assert.equal(firstDispatch.task.sourceNoteId, firstFilteredTask?.sourceNoteId);
    assert.equal(firstDispatch.task.taskType, firstFilteredTask?.taskType);
    assert.equal(firstDispatch.task.worker, firstFilteredTask?.worker);
    assert.equal(firstFilteredTask?.id, firstTaskEvent.data.id);
    assert.equal(firstFilteredTask?.sourceNoteId, firstTaskEvent.data.sourceNoteId);
    assert.equal(firstFilteredTask?.taskType, firstTaskEvent.data.taskType);
    assert.equal(firstFilteredTask?.worker, firstTaskEvent.data.worker);
    assert.equal(firstWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(firstWorkerTasks.filters.taskType, 'extract_tasks');
    assert.equal(firstWorkerTasks.filters.worker, 'lifeos');
    assert.equal(firstWorkerTasks.filters.status, firstDispatch.task.status);

    const mixedSoulActionsAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(sourceNoteId)}`,
    );
    const mixedByIdAfterFirstDispatch = new Map(mixedSoulActionsAfterFirstDispatch.soulActions.map((action) => [action.id, action]));
    assert.equal(mixedByIdAfterFirstDispatch.get(firstAction.id)?.executionStatus, firstDispatch.soulAction!.executionStatus);
    assert.equal(mixedByIdAfterFirstDispatch.get(secondAction.id)?.executionStatus, 'not_dispatched');

    const secondTaskEventPromise = waitForWebSocketEvent<WorkerTaskWsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated' && event.data.sourceNoteId === sourceNoteId && event.data.taskType === 'update_persona_snapshot',
    );
    const secondNoteTaskEventPromise = waitForWebSocketEvent<NoteWorkerTasksUpdatedWsEvent>(
      socket,
      (event) => event.type === 'note-worker-tasks-updated' && event.data.sourceNoteId === sourceNoteId && event.data.task.taskType === 'update_persona_snapshot',
    );

    const secondDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    const secondTaskEvent = await secondTaskEventPromise;
    const secondNoteTaskEvent = await secondNoteTaskEventPromise;

    const secondWorkerTasks = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(sourceNoteId)}&taskType=update_persona_snapshot&worker=lifeos&status=${encodeURIComponent(secondDispatch.task!.status)}`,
    );
    const secondFilteredTask = secondWorkerTasks.tasks.find((task) => task.id === secondDispatch.task!.id);

    assert.ok(secondDispatch.task);
    assert.ok(secondDispatch.result.workerTaskId);
    assert.equal(secondDispatch.result.executionSummary?.objectType, 'worker_task');
    assert.equal(secondDispatch.result.executionSummary?.objectId, secondDispatch.task?.id ?? null);
    assert.equal(secondDispatch.result.reason, secondDispatch.soulAction?.resultSummary ?? secondDispatch.task?.error ?? 'approved soul action dispatched through worker host');
    assert.equal(secondDispatch.task.id, secondDispatch.result.workerTaskId);
    assert.equal(secondDispatch.task.id, secondTaskEvent.data.id);
    assert.equal(secondDispatch.task.sourceNoteId, secondTaskEvent.data.sourceNoteId);
    assert.equal(secondDispatch.task.taskType, secondTaskEvent.data.taskType);
    assert.equal(secondDispatch.task.worker, secondTaskEvent.data.worker);
    assert.equal(secondDispatch.task.id, secondNoteTaskEvent.data.task.id);
    assert.equal(secondDispatch.task.sourceNoteId, secondNoteTaskEvent.data.sourceNoteId);
    assert.equal(secondDispatch.task.taskType, secondNoteTaskEvent.data.task.taskType);
    assert.equal(secondDispatch.task.worker, secondNoteTaskEvent.data.task.worker);
    assert.equal(secondDispatch.task.id, secondFilteredTask?.id);
    assert.equal(secondDispatch.task.sourceNoteId, secondFilteredTask?.sourceNoteId);
    assert.equal(secondDispatch.task.taskType, secondFilteredTask?.taskType);
    assert.equal(secondDispatch.task.worker, secondFilteredTask?.worker);
    assert.equal(secondFilteredTask?.id, secondTaskEvent.data.id);
    assert.equal(secondFilteredTask?.sourceNoteId, secondTaskEvent.data.sourceNoteId);
    assert.equal(secondFilteredTask?.taskType, secondTaskEvent.data.taskType);
    assert.equal(secondFilteredTask?.worker, secondTaskEvent.data.worker);
    assert.equal(secondWorkerTasks.filters.sourceNoteId, sourceNoteId);
    assert.equal(secondWorkerTasks.filters.taskType, 'update_persona_snapshot');
    assert.equal(secondWorkerTasks.filters.worker, 'lifeos');
    assert.equal(secondWorkerTasks.filters.status, secondDispatch.task.status);
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('task-extraction reintegration accept API returns a review-backed create_event_node follow-up and dispatches an event projection', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-task-extraction-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-task-extraction-followup',
      sourceNoteId: 'note-api-task-extraction-followup',
      soulActionId: null,
      taskType: 'extract_tasks',
      terminalStatus: 'succeeded',
      signalKind: 'task_extraction_reintegration',
      reviewStatus: 'pending_review',
      target: 'task_record',
      strength: 'medium',
      summary: 'extract-task follow-up summary',
      evidence: {
        source: 'api-task-extraction-followup-test',
        extractTaskCreated: 2,
        nextActionCandidate: {
          title: '整理周报素材',
          priority: 'high',
          due: '2026-03-22',
          outputNoteId: 'task-note-1',
        },
      },
      now: '2026-03-22T09:30:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-task-extraction-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept task-extraction follow-up event' }),
      },
    );

    assert.deepEqual(accepted.nextActionSummary, getReintegrationNextActionSummary(accepted.reintegrationRecord));
    assert.deepEqual(accepted.displaySummary, getReintegrationOutcomeDisplaySummary(accepted, accepted.reintegrationRecord));
    assert.equal(accepted.displaySummary.plannedActionCount, 1);
    assert.equal(accepted.displaySummary.nextActionCreatedCount, 2);
    assert.equal(accepted.displaySummary.nextActionText, '整理周报素材（high · due 2026-03-22）');
    assert.equal(accepted.displaySummary.hasNextActionEvidence, true);
    assert.equal(accepted.nextActionSummary?.createdCount, 2);
    assert.equal(accepted.nextActionSummary?.candidateTitle, '整理周报素材');
    assert.equal(accepted.soulActions.length, 1);
    assert.equal(accepted.soulActions[0]?.actionKind, 'create_event_node');
    assert.equal(accepted.soulActions[0]?.sourceReintegrationId, record!.id);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(accepted.soulActions[0]!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve task-extraction follow-up event' }),
      },
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(accepted.soulActions[0]!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(dispatched.result.dispatched, true);
    assert.equal(dispatched.soulAction?.actionKind, 'create_event_node');
    assert.equal(dispatched.soulAction?.resultSummary, dispatched.result.reason);
    assert.equal(dispatched.soulAction?.executionSummary?.objectType, 'event_node');
    assert.equal(dispatched.soulAction?.executionSummary?.operation, 'created');
    assert.equal(dispatched.soulAction?.executionSummary?.summary, dispatched.result.reason);
    assert.equal(dispatched.result.executionSummary?.objectType, 'event_node');
    assert.equal(dispatched.result.executionSummary?.operation, 'created');
    assert.equal(dispatched.result.executionSummary?.summary, dispatched.result.reason);

    const listedEventNodes = await api<{ eventNodes: Array<{
      sourceReintegrationId: string;
      promotionSoulActionId: string | null;
      eventKind: string;
      title: string;
      summary: string;
    }>; filters: { sourceReintegrationIds?: string[] } }>(
      baseUrl,
      `/api/event-nodes?sourceReintegrationIds=${encodeURIComponent(record!.id)}`,
    );
    const eventNode = listedEventNodes.eventNodes.find((item) => item.sourceReintegrationId === record!.id);

    assert.deepEqual(listedEventNodes.filters.sourceReintegrationIds, [record!.id]);
    assert.ok(eventNode);
    assert.equal(eventNode?.promotionSoulActionId, accepted.soulActions[0]!.id);
    assert.equal(eventNode?.eventKind, 'milestone_report');
    assert.equal(eventNode?.title, '整理周报素材');
    assert.equal(eventNode?.summary, record!.summary);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('event-node promotion dispatch writes follow-up event-node list aligned with soul-action source record', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-event-node-list-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-event-node-list-followup',
      sourceNoteId: 'note-api-pr6-event-node-list-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api event node list follow-up summary',
      evidence: { source: 'api-event-node-list-followup-test' },
      now: '2026-03-22T09:00:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-event-node-list-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for event-node list api test' }),
      },
    );

    const action = accepted.soulActions.find((item) => item.actionKind === 'promote_event_node') ?? accepted.soulActions.find((item) => item.actionKind === 'create_event_node');
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for event-node list api test' }),
      },
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const filteredSoulActions = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(dispatched.soulAction!.executionStatus)}`,
    );
    const filteredAction = filteredSoulActions.soulActions.find((item) => item.id === action!.id);
    const listedEventNodes = await api<{ eventNodes: Array<{
      id: string;
      sourceReintegrationId: string;
      sourceSoulActionId: string | null;
      promotionSoulActionId: string | null;
      eventKind: string;
      title: string;
      summary: string;
    }>; filters: { sourceReintegrationIds?: string[] } }>(
      baseUrl,
      `/api/event-nodes?sourceReintegrationIds=${encodeURIComponent(record!.id)}`,
    );
    const eventNode = listedEventNodes.eventNodes.find((item) => item.sourceReintegrationId === record!.id);

    assert.equal(filteredSoulActions.filters.sourceReintegrationId, record!.id);
    assert.deepEqual(listedEventNodes.filters.sourceReintegrationIds, [record!.id]);
    assert.equal(filteredSoulActions.filters.governanceStatus, 'approved');
    assert.equal(filteredSoulActions.filters.executionStatus, dispatched.soulAction!.executionStatus);
    assert.equal(filteredAction?.id, dispatched.soulAction?.id);
    assert.equal(filteredAction?.sourceNoteId, dispatched.soulAction?.sourceNoteId);
    assert.equal(filteredAction?.sourceReintegrationId, dispatched.soulAction?.sourceReintegrationId);
    assert.equal(filteredAction?.governanceStatus, dispatched.soulAction?.governanceStatus);
    assert.equal(filteredAction?.executionStatus, dispatched.soulAction?.executionStatus);
    assert.equal(filteredAction?.executionSummary?.objectType, 'event_node');
    assert.equal(filteredAction?.executionSummary?.operation, 'created');
    assert.equal(filteredAction?.executionSummary?.summary, dispatched.result.reason);
    assert.ok(eventNode);
    assert.equal(eventNode?.promotionSoulActionId, filteredAction?.id);
    assert.equal(eventNode?.sourceReintegrationId, record!.id);
    assert.equal(eventNode?.eventKind, 'weekly_reflection');
    assert.equal(eventNode?.title, '周回顾事件');
    assert.equal(eventNode?.summary, record!.summary);
    assert.equal(dispatched.soulAction?.resultSummary, dispatched.result.reason);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('continuity promotion dispatch writes follow-up continuity-record list aligned with soul-action source record', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-continuity-list-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-continuity-list-followup',
      sourceNoteId: 'note-api-pr6-continuity-list-followup',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api continuity list follow-up summary',
      evidence: { source: 'api-continuity-list-followup-test' },
      now: '2026-03-22T09:10:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-continuity-list-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for continuity list api test' }),
      },
    );

    const action = accepted.soulActions.find((item) => item.actionKind === 'promote_continuity_record');
    assert.ok(action);
    assert.equal(action?.sourceNoteId, 'note-api-pr6-continuity-list-followup');
    assert.equal(action?.sourceReintegrationId, record!.id);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for continuity list api test' }),
      },
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const filteredSoulActions = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(dispatched.soulAction!.executionStatus)}`,
    );
    const filteredAction = filteredSoulActions.soulActions.find((item) => item.id === action!.id);
    const listedContinuity = await api<{ continuityRecords: Array<{
      id: string;
      sourceReintegrationId: string;
      sourceSoulActionId: string | null;
      promotionSoulActionId: string | null;
      continuityKind: string;
      summary: string;
    }>; filters: { sourceReintegrationIds?: string[] } }>(
      baseUrl,
      `/api/continuity-records?sourceReintegrationIds=${encodeURIComponent(record!.id)}`,
    );
    const continuity = listedContinuity.continuityRecords.find((item) => item.sourceReintegrationId === record!.id);

    assert.equal(filteredSoulActions.filters.sourceReintegrationId, record!.id);
    assert.deepEqual(listedContinuity.filters.sourceReintegrationIds, [record!.id]);
    assert.equal(filteredSoulActions.filters.governanceStatus, 'approved');

    const dedupedContinuity = await api<{ continuityRecords: Array<{
      id: string;
      sourceReintegrationId: string;
    }>; filters: { sourceReintegrationIds?: string[] } }>(
      baseUrl,
      `/api/continuity-records?sourceReintegrationIds=${encodeURIComponent(`${record!.id}, ${record!.id}, `)}`,
    );
    assert.deepEqual(dedupedContinuity.filters.sourceReintegrationIds, [record!.id]);
    assert.ok(dedupedContinuity.continuityRecords.some((item) => item.sourceReintegrationId === record!.id));
    assert.equal(filteredSoulActions.filters.executionStatus, dispatched.soulAction!.executionStatus);
    assert.equal(filteredAction?.id, dispatched.soulAction?.id);
    assert.equal(filteredAction?.sourceNoteId, dispatched.soulAction?.sourceNoteId);
    assert.equal(filteredAction?.sourceReintegrationId, dispatched.soulAction?.sourceReintegrationId);
    assert.equal(filteredAction?.governanceStatus, dispatched.soulAction?.governanceStatus);
    assert.equal(filteredAction?.executionStatus, dispatched.soulAction?.executionStatus);
    assert.equal(filteredAction?.executionSummary?.objectType, 'continuity_record');
    assert.equal(filteredAction?.executionSummary?.operation, 'created');
    assert.equal(filteredAction?.executionSummary?.summary, dispatched.result.reason);
    assert.ok(continuity);
    assert.equal(continuity?.promotionSoulActionId, filteredAction?.id);
    assert.equal(continuity?.sourceReintegrationId, record!.id);
    assert.equal(continuity?.summary, record!.summary);
    assert.equal(dispatched.soulAction?.resultSummary, dispatched.result.reason);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('dispatch API response and follow-up list stay aligned for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-dispatch-list-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-dispatch-list-refresh',
      sourceNoteId: 'note-api-pr6-event-node-dispatch-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api dispatch list summary',
      evidence: { source: 'api-dispatch-list-test' },
      now: '2026-03-21T18:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-dispatch-list-refresh');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for dispatch list api test' }),
      },
    );
    const action = accepted.soulActions[0];
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for dispatch list api test' }),
      },
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(dispatched.soulAction?.id, action!.id);
    assert.ok(dispatched.soulAction);
    assert.ok(['pending', 'running', 'succeeded'].includes(dispatched.soulAction.executionStatus));
    assert.equal(dispatched.soulAction.sourceNoteId, 'note-api-pr6-event-node-dispatch-followup');
    assert.equal(dispatched.soulAction.sourceReintegrationId, record!.id);

    const listedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const refreshed = listedAfterDispatch.soulActions.find((item) => item.id === action!.id);
    assert.ok(refreshed);
    assert.equal(refreshed?.sourceNoteId, 'note-api-pr6-event-node-dispatch-followup');
    assert.equal(refreshed?.sourceReintegrationId, record!.id);
    assert.equal(refreshed?.governanceStatus, 'approved');
    assert.equal(refreshed?.executionStatus, dispatched.soulAction.executionStatus);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-promotion-dispatch-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-promotion-dispatch-followup',
      sourceNoteId: 'note-api-pr6-promotion-dispatch-followup',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api promotion dispatch follow-up summary',
      evidence: { source: 'api-promotion-dispatch-followup-test' },
      now: '2026-03-22T08:00:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-promotion-dispatch-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for promotion dispatch api test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    const action = accepted.soulActions.find((item) => item.actionKind === 'promote_continuity_record') ?? accepted.soulActions[0];
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for promotion dispatch api test' }),
      },
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(dispatched.result.dispatched, true);
    assert.equal(dispatched.soulAction?.id, action!.id);
    assert.equal(dispatched.soulAction?.sourceNoteId, 'note-api-pr6-promotion-dispatch-followup');
    assert.equal(dispatched.soulAction?.sourceReintegrationId, record!.id);
    assert.equal(dispatched.soulAction?.governanceStatus, 'approved');
    assert.equal(dispatched.soulAction?.executionStatus, 'succeeded');
    assert.equal(dispatched.result.workerTaskId, null);
    assert.equal(dispatched.task, null);
    assert.match(dispatched.result.reason, /continuity record/);
    assert.ok(dispatched.continuityRecord);
    assert.equal(dispatched.eventNode, null);
    assert.equal(dispatched.continuityRecord?.sourceReintegrationId, record!.id);
    assert.equal(dispatched.continuityRecord?.promotionSoulActionId, action!.id);
    assert.deepEqual(dispatched.continuityRecord?.continuitySummary, getProjectionContinuitySummary(dispatched.continuityRecord!));
    assert.deepEqual(dispatched.continuityRecord?.explanationSummary, getProjectionExplanationSummary(dispatched.continuityRecord!));
    assert.equal(dispatched.soulAction?.executionSummary?.objectType, 'continuity_record');
    assert.equal(dispatched.soulAction?.executionSummary?.operation, 'created');
    assert.equal(dispatched.soulAction?.executionSummary?.summary, dispatched.result.reason);

    const listedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(dispatched.soulAction!.executionStatus)}`,
    );
    const refreshed = listedAfterDispatch.soulActions.find((item) => item.id === action!.id);
    assert.equal(listedAfterDispatch.filters.sourceReintegrationId, record!.id);
    assert.equal(listedAfterDispatch.filters.governanceStatus, 'approved');
    assert.equal(listedAfterDispatch.filters.executionStatus, dispatched.soulAction!.executionStatus);
    assert.ok(refreshed);
    assert.equal(refreshed?.id, dispatched.soulAction?.id);
    assert.equal(refreshed?.sourceNoteId, dispatched.soulAction?.sourceNoteId);
    assert.equal(refreshed?.sourceReintegrationId, dispatched.soulAction?.sourceReintegrationId);
    assert.equal(refreshed?.governanceStatus, dispatched.soulAction?.governanceStatus);
    assert.equal(refreshed?.executionStatus, dispatched.soulAction?.executionStatus);
    assert.equal(refreshed?.workerTaskId, null);
    assert.equal(refreshed?.resultSummary, dispatched.result.reason);
    assert.equal(refreshed?.executionSummary?.objectType, 'continuity_record');
    assert.equal(refreshed?.executionSummary?.operation, 'created');
    assert.equal(refreshed?.executionSummary?.summary, dispatched.result.reason);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('event-node promotion dispatch response stays aligned with local-only execution results and follow-up soul-action list', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-event-node-dispatch-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-event-node-dispatch-followup',
      sourceNoteId: 'note-api-pr6-event-node-dispatch-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api event node dispatch follow-up summary',
      evidence: { source: 'api-event-node-dispatch-followup-test' },
      now: '2026-03-22T08:30:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-event-node-dispatch-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for event-node dispatch api test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    const action = accepted.soulActions.find((item) => item.actionKind === 'promote_event_node') ?? accepted.soulActions.find((item) => item.actionKind === 'create_event_node');
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for event-node dispatch api test' }),
      },
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(dispatched.result.dispatched, true);
    assert.equal(dispatched.soulAction?.id, action!.id);
    assert.equal(dispatched.soulAction?.sourceNoteId, 'note-api-pr6-event-node-dispatch-followup');
    assert.equal(dispatched.soulAction?.sourceReintegrationId, record!.id);
    assert.equal(dispatched.soulAction?.governanceStatus, 'approved');
    assert.equal(dispatched.soulAction?.executionStatus, 'succeeded');
    assert.equal(dispatched.result.workerTaskId, null);
    assert.equal(dispatched.task, null);
    assert.match(dispatched.result.reason, /event node/);
    assert.ok(dispatched.eventNode);
    assert.equal(dispatched.continuityRecord, null);
    assert.equal(dispatched.eventNode?.sourceReintegrationId, record!.id);
    assert.equal(dispatched.eventNode?.promotionSoulActionId, action!.id);
    assert.deepEqual(dispatched.eventNode?.explanationSummary, getProjectionExplanationSummary(dispatched.eventNode!));
    assert.equal(dispatched.soulAction?.executionSummary?.objectType, 'event_node');
    assert.equal(dispatched.soulAction?.executionSummary?.operation, 'created');
    assert.equal(dispatched.soulAction?.executionSummary?.summary, dispatched.result.reason);

    const listedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(dispatched.soulAction!.executionStatus)}`,
    );
    const refreshed = listedAfterDispatch.soulActions.find((item) => item.id === action!.id);
    assert.equal(listedAfterDispatch.filters.sourceReintegrationId, record!.id);
    assert.equal(listedAfterDispatch.filters.governanceStatus, 'approved');
    assert.equal(listedAfterDispatch.filters.executionStatus, dispatched.soulAction!.executionStatus);
    assert.ok(refreshed);
    assert.equal(refreshed?.id, dispatched.soulAction?.id);
    assert.equal(refreshed?.sourceNoteId, dispatched.soulAction?.sourceNoteId);
    assert.equal(refreshed?.sourceReintegrationId, dispatched.soulAction?.sourceReintegrationId);
    assert.equal(refreshed?.governanceStatus, dispatched.soulAction?.governanceStatus);
    assert.equal(refreshed?.executionStatus, dispatched.soulAction?.executionStatus);
    assert.equal(refreshed?.workerTaskId, null);
    assert.equal(refreshed?.resultSummary, dispatched.result.reason);
    assert.equal(refreshed?.executionSummary?.objectType, 'event_node');
    assert.equal(refreshed?.executionSummary?.operation, 'created');
    assert.equal(refreshed?.executionSummary?.summary, dispatched.result.reason);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('continuity promotion websocket event stays aligned with follow-up continuity-record list projection summaries', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-continuity-ws-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-continuity-ws-followup',
      sourceNoteId: 'note-api-pr6-continuity-ws-followup',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api continuity websocket follow-up summary',
      evidence: { source: 'api-continuity-ws-followup-test' },
      now: '2026-03-22T10:10:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-continuity-ws-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for continuity websocket api test' }),
      },
    );

    const action = accepted.soulActions.find((item) => item.actionKind === 'promote_continuity_record');
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for continuity websocket api test' }),
      },
    );

    const socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    try {
      const wsEventPromise = waitForWebSocketEvent<Extract<WsEvent, { type: 'continuity-record-updated' }>>(
        socket,
        (event) => event.type === 'continuity-record-updated' && event.data.continuityRecord.sourceReintegrationId === record!.id,
      );

      const dispatched = await api<DispatchSoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      const wsEvent = await wsEventPromise;
      const listedContinuity = await api<ListContinuityRecordsResponse>(
        baseUrl,
        `/api/continuity-records?sourceReintegrationIds=${encodeURIComponent(record!.id)}`,
      );
      const continuity = listedContinuity.continuityRecords.find((item) => item.sourceReintegrationId === record!.id);

      assert.ok(continuity);
      assert.equal(wsEvent.data.continuityRecord.sourceReintegrationId, record!.id);
      assert.equal(wsEvent.data.continuityRecord.promotionSoulActionId, action!.id);
      assert.deepEqual(dispatched.continuityRecord, wsEvent.data.continuityRecord);
      assert.deepEqual(dispatched.continuityRecord, continuity);
      assert.deepEqual(wsEvent.data.continuityRecord, continuity);
      assert.deepEqual(wsEvent.data.continuityRecord.continuitySummary, continuity?.continuitySummary);
      assert.deepEqual(wsEvent.data.continuityRecord.explanationSummary, continuity?.explanationSummary);
      assert.equal(dispatched.soulAction?.executionSummary?.objectType, 'continuity_record');
      assert.equal(dispatched.soulAction?.executionSummary?.objectId, continuity?.id ?? null);
    } finally {
      socket.close();
    }
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('event-node promotion websocket event stays aligned with follow-up event-node list projection summaries', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-event-ws-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-event-ws-followup',
      sourceNoteId: 'note-api-pr6-event-ws-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api event websocket follow-up summary',
      evidence: { source: 'api-event-ws-followup-test' },
      now: '2026-03-22T10:20:00.000Z',
    });

    const listedRecords = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listedRecords.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-event-ws-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for event websocket api test' }),
      },
    );

    const action = accepted.soulActions.find((item) => item.actionKind === 'promote_event_node') ?? accepted.soulActions.find((item) => item.actionKind === 'create_event_node');
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for event websocket api test' }),
      },
    );

    const socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    try {
      const wsEventPromise = waitForWebSocketEvent<Extract<WsEvent, { type: 'event-node-updated' }>>(
        socket,
        (event) => event.type === 'event-node-updated' && event.data.eventNode.sourceReintegrationId === record!.id,
      );

      const dispatched = await api<DispatchSoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      const wsEvent = await wsEventPromise;
      const listedEvents = await api<ListEventNodesResponse>(
        baseUrl,
        `/api/event-nodes?sourceReintegrationIds=${encodeURIComponent(record!.id)}`,
      );
      const eventNode = listedEvents.eventNodes.find((item) => item.sourceReintegrationId === record!.id);

      assert.ok(eventNode);
      assert.equal(wsEvent.data.eventNode.sourceReintegrationId, record!.id);
      assert.equal(wsEvent.data.eventNode.promotionSoulActionId, action!.id);
      assert.deepEqual(dispatched.eventNode, wsEvent.data.eventNode);
      assert.deepEqual(dispatched.eventNode, eventNode);
      assert.deepEqual(wsEvent.data.eventNode, eventNode);
      assert.deepEqual(wsEvent.data.eventNode.explanationSummary, eventNode?.explanationSummary);
      assert.equal(dispatched.soulAction?.executionSummary?.objectType, 'event_node');
      assert.equal(dispatched.soulAction?.executionSummary?.objectId, eventNode?.id ?? null);
    } finally {
      socket.close();
    }
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('grouped settings list converges after full accept-approve-dispatch chain', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-group-convergence-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-group-convergence',
      sourceNoteId: 'note-api-pr6-group-convergence',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api grouped convergence summary',
      evidence: { source: 'api-group-convergence-test' },
      now: '2026-03-21T18:30:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-group-convergence');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for grouped convergence api test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    for (const action of accepted.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve full grouped convergence chain' }),
        },
      );
    }

    const dispatchResults: DispatchSoulActionResponse[] = [];
    for (const action of accepted.soulActions) {
      dispatchResults.push(
        await api<DispatchSoulActionResponse>(
          baseUrl,
          `/api/soul-actions/${encodeURIComponent(action.id)}/dispatch`,
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        ),
      );
    }

    const listedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    assert.equal(listedAfterDispatch.soulActions.length, accepted.soulActions.length);

    const refreshedById = new Map(listedAfterDispatch.soulActions.map((action) => [action.id, action]));
    for (const dispatched of dispatchResults) {
      assert.ok(dispatched.soulAction);
      const refreshed = refreshedById.get(dispatched.soulAction!.id);
      assert.ok(refreshed);
      assert.equal(refreshed?.sourceNoteId, 'note-api-pr6-group-convergence');
      assert.equal(refreshed?.governanceStatus, 'approved');
      assert.equal(refreshed?.executionStatus, dispatched.soulAction!.executionStatus);
      assert.ok(['pending', 'running', 'succeeded'].includes(refreshed!.executionStatus));
    }

    const pendingReview = listedAfterDispatch.soulActions.filter((action) => action.governanceStatus === 'pending_review');
    const dispatchReady = listedAfterDispatch.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched');
    assert.equal(pendingReview.length, 0);
    assert.equal(dispatchReady.length, 0);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('grouped settings list stays coherent across staggered approve and dispatch updates', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-staggered-group-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-staggered-group-updates',
      sourceNoteId: 'note-api-pr6-staggered-grouped-settings-refresh',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api staggered group summary',
      evidence: { source: 'api-staggered-group-test' },
      now: '2026-03-21T19:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-staggered-group-updates');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for staggered grouped settings test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;

    const firstApproved = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve first staggered action' }),
      },
    );
    assert.equal(firstApproved.soulAction.id, firstAction.id);
    assert.equal(firstApproved.soulAction.governanceStatus, 'approved');

    const listedAfterFirstApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const firstApproveById = new Map(listedAfterFirstApprove.soulActions.map((action) => [action.id, action]));
    assert.equal(firstApproveById.get(firstAction.id)?.governanceStatus, 'approved');
    assert.equal(firstApproveById.get(firstAction.id)?.executionStatus, 'not_dispatched');
    assert.equal(firstApproveById.get(secondAction.id)?.governanceStatus, 'pending_review');
    assert.equal(firstApproveById.get(secondAction.id)?.executionStatus, 'not_dispatched');

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve second staggered action' }),
      },
    );

    const firstDispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(firstDispatched.soulAction);

    const listedAfterMixedUpdate = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const mixedById = new Map(listedAfterMixedUpdate.soulActions.map((action) => [action.id, action]));
    assert.equal(mixedById.get(firstAction.id)?.sourceNoteId, 'note-api-pr6-staggered-grouped-settings-refresh');
    assert.equal(mixedById.get(firstAction.id)?.sourceReintegrationId, record!.id);
    assert.equal(mixedById.get(firstAction.id)?.governanceStatus, 'approved');
    assert.equal(mixedById.get(firstAction.id)?.executionStatus, firstDispatched.soulAction!.executionStatus);
    assert.equal(mixedById.get(secondAction.id)?.sourceNoteId, 'note-api-pr6-staggered-grouped-settings-refresh');
    assert.equal(mixedById.get(secondAction.id)?.sourceReintegrationId, record!.id);
    assert.equal(mixedById.get(secondAction.id)?.governanceStatus, 'approved');
    assert.equal(mixedById.get(secondAction.id)?.executionStatus, 'not_dispatched');

    const pendingReview = listedAfterMixedUpdate.soulActions.filter((action) => action.governanceStatus === 'pending_review');
    const dispatchReady = listedAfterMixedUpdate.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched');
    const dispatched = listedAfterMixedUpdate.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus !== 'not_dispatched');
    assert.equal(pendingReview.length, 0);
    assert.equal(dispatchReady.length, 1);
    assert.equal(dispatchReady[0]?.id, secondAction.id);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0]?.id, firstAction.id);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('grouped settings list drops dispatch-ready count from one to zero across sequential dispatches', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-sequential-dispatch-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-sequential-dispatch-refresh',
      sourceNoteId: 'note-api-pr6-sequential-dispatch-refresh',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api sequential dispatch summary',
      evidence: { source: 'api-sequential-dispatch-test' },
      now: '2026-03-21T19:30:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-sequential-dispatch-refresh');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for sequential dispatch refresh test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    for (const action of accepted.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve for sequential dispatch refresh test' }),
        },
      );
    }

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;

    const firstDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(firstDispatch.soulAction);

    const listedAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const firstReady = listedAfterFirstDispatch.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched');
    const firstDispatched = listedAfterFirstDispatch.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus !== 'not_dispatched');
    assert.equal(firstReady.length, 1);
    assert.equal(firstReady[0]?.id, secondAction.id);
    assert.equal(firstDispatched.length, 1);
    assert.equal(firstDispatched[0]?.id, firstAction.id);

    const secondDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(secondDispatch.soulAction);

    const listedAfterSecondDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const secondReady = listedAfterSecondDispatch.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched');
    const secondDispatched = listedAfterSecondDispatch.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus !== 'not_dispatched');
    assert.equal(secondReady.length, 0);
    assert.equal(secondDispatched.length, accepted.soulActions.length);

    const finalById = new Map(listedAfterSecondDispatch.soulActions.map((action) => [action.id, action]));
    assert.equal(finalById.get(firstAction.id)?.executionStatus, firstDispatch.soulAction!.executionStatus);
    assert.equal(finalById.get(secondAction.id)?.executionStatus, secondDispatch.soulAction!.executionStatus);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('grouped status filters stay aligned with full-list semantics after sequential dispatch refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-filter-convergence-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-filter-convergence',
      sourceNoteId: 'note-api-pr6-filter-convergence',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api filter convergence summary',
      evidence: { source: 'api-filter-convergence-test' },
      now: '2026-03-21T20:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-filter-convergence');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for filter convergence test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    for (const action of accepted.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve for filter convergence test' }),
        },
      );
    }

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;

    const firstDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(firstDispatch.soulAction);

    const fullAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const readyAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const dispatchedAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(firstDispatch.soulAction!.executionStatus)}`,
    );
    assert.equal(fullAfterFirstDispatch.soulActions.length, accepted.soulActions.length);
    assert.equal(readyAfterFirstDispatch.soulActions.length, 1);
    assert.equal(readyAfterFirstDispatch.soulActions[0]?.id, secondAction.id);
    assert.equal(dispatchedAfterFirstDispatch.soulActions.length, 1);
    assert.equal(dispatchedAfterFirstDispatch.soulActions[0]?.id, firstAction.id);

    const secondDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(secondDispatch.soulAction);

    const fullAfterSecondDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const readyAfterSecondDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const secondDispatchedAfterSecondDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(secondDispatch.soulAction!.executionStatus)}`,
    );
    assert.equal(fullAfterSecondDispatch.soulActions.length, accepted.soulActions.length);
    assert.equal(readyAfterSecondDispatch.soulActions.length, 0);

    const fullyDispatched = fullAfterSecondDispatch.soulActions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus !== 'not_dispatched');
    assert.equal(fullyDispatched.length, accepted.soulActions.length);
    assert.ok(fullyDispatched.some((action) => action.id === firstAction.id));
    assert.ok(fullyDispatched.some((action) => action.id === secondAction.id));
    assert.ok(secondDispatchedAfterSecondDispatch.soulActions.some((action) => action.id === secondAction.id));
    assert.ok(secondDispatchedAfterSecondDispatch.soulActions.every((action) => action.executionStatus === secondDispatch.soulAction!.executionStatus));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action filters converge when governance and execution subsets are queried after mixed group progress', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-filter-subsets-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-filter-subset-convergence',
      sourceNoteId: 'note-api-pr6-filter-subset-convergence',
      soulActionId: null,
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api filter subset convergence summary',
      evidence: { source: 'api-filter-subset-convergence-test' },
      now: '2026-03-21T21:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-filter-subset-convergence');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for filter subset convergence test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve first for filter subset convergence test' }),
      },
    );
    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve second for filter subset convergence test' }),
      },
    );

    const firstDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(firstDispatch.soulAction);

    const fullList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const approvedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved`,
    );
    const readyList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const dispatchedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(firstDispatch.soulAction!.executionStatus)}`,
    );

    assert.equal(fullList.soulActions.length, 2);
    assert.equal(approvedList.soulActions.length, 2);
    assert.equal(readyList.soulActions.length, 1);
    assert.equal(dispatchedList.soulActions.length, 1);

    const approvedIds = approvedList.soulActions.map((action) => action.id).sort();
    const subsetIds = [
      ...readyList.soulActions.map((action) => action.id),
      ...dispatchedList.soulActions.map((action) => action.id),
    ].sort();
    assert.deepEqual(subsetIds, approvedIds);
    assert.equal(readyList.soulActions[0]?.id, secondAction.id);
    assert.equal(dispatchedList.soulActions[0]?.id, firstAction.id);
    assert.ok(approvedList.soulActions.every((action) => action.governanceStatus === 'approved'));
    assert.ok(readyList.soulActions.every((action) => action.executionStatus === 'not_dispatched'));
    assert.ok(dispatchedList.soulActions.every((action) => action.executionStatus === firstDispatch.soulAction!.executionStatus));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-action filters converge when governance and execution subsets are queried after same-status dispatches', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-same-status-filter-subsets-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-same-status-filter-subsets',
      sourceNoteId: 'note-api-pr6-same-status-filter-subsets',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api same-status filter subset convergence summary',
      evidence: { source: 'api-same-status-filter-subsets-test' },
      now: '2026-03-21T22:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-same-status-filter-subsets');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for same-status filter subset convergence test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    for (const action of accepted.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve for same-status filter subset convergence test' }),
        },
      );
    }

    const dispatchResults: DispatchSoulActionResponse[] = [];
    for (const action of accepted.soulActions) {
      dispatchResults.push(
        await api<DispatchSoulActionResponse>(
          baseUrl,
          `/api/soul-actions/${encodeURIComponent(action.id)}/dispatch`,
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        ),
      );
    }

    const terminalStatus = dispatchResults[0]!.soulAction!.executionStatus;
    assert.ok(dispatchResults.every((result) => result.soulAction?.executionStatus === terminalStatus));

    const fullList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const approvedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved`,
    );
    const readyList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const sameStatusList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(terminalStatus)}`,
    );

    assert.equal(fullList.soulActions.length, accepted.soulActions.length);
    assert.equal(approvedList.soulActions.length, accepted.soulActions.length);
    assert.equal(readyList.soulActions.length, 0);
    assert.equal(sameStatusList.soulActions.length, accepted.soulActions.length);

    const approvedIds = approvedList.soulActions.map((action) => action.id).sort();
    const sameStatusIds = sameStatusList.soulActions.map((action) => action.id).sort();
    assert.deepEqual(sameStatusIds, approvedIds);
    assert.ok(approvedList.soulActions.every((action) => action.governanceStatus === 'approved'));
    assert.ok(sameStatusList.soulActions.every((action) => action.executionStatus === terminalStatus));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('approve websocket updates stay aligned with follow-up filtered lists for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-approve-ws-filter-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-approve-ws-filter-followup',
      sourceNoteId: 'note-api-pr6-approve-ws-filter-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api approve websocket filter follow-up summary',
      evidence: { source: 'api-approve-ws-filter-followup-test' },
      now: '2026-03-22T00:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-approve-ws-filter-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for approve websocket filter follow-up test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;
    const wsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceReintegrationId === record!.id && event.data.id === firstAction.id,
    );

    const firstApprove = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for websocket filter follow-up test' }),
      },
    );

    const wsEvent = await wsEventPromise;
    assert.equal(wsEvent.type, 'soul-action-updated');
    assert.equal(wsEvent.data.id, firstAction.id);
    assert.equal(wsEvent.data.sourceNoteId, 'note-api-pr6-approve-ws-filter-followup');
    assert.equal(wsEvent.data.sourceReintegrationId, record!.id);
    assert.equal(wsEvent.data.governanceStatus, firstApprove.soulAction.governanceStatus);
    assert.equal(wsEvent.data.governanceStatus, 'approved');
    assert.equal(wsEvent.data.executionStatus, 'not_dispatched');

    const fullAfterApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    const approvedReadyAfterApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );

    assert.equal(fullAfterApprove.soulActions.length, 2);
    assert.equal(pendingAfterApprove.soulActions.length, 1);
    assert.equal(pendingAfterApprove.soulActions[0]?.id, secondAction.id);
    assert.equal(approvedReadyAfterApprove.soulActions.length, 1);
    assert.equal(approvedReadyAfterApprove.soulActions[0]?.id, firstAction.id);
    assert.equal(approvedReadyAfterApprove.soulActions[0]?.governanceStatus, wsEvent.data.governanceStatus);
    assert.equal(approvedReadyAfterApprove.soulActions[0]?.executionStatus, wsEvent.data.executionStatus);

    const filteredIds = [
      ...pendingAfterApprove.soulActions.map((action) => action.id),
      ...approvedReadyAfterApprove.soulActions.map((action) => action.id),
    ].sort();
    const fullIds = fullAfterApprove.soulActions.map((action) => action.id).sort();
    assert.deepEqual(filteredIds, fullIds);
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('sequential approve websocket updates stay aligned with grouped follow-up filtered lists for settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-approve-ws-sequential-filter-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-approve-ws-sequential-filter-followup',
      sourceNoteId: 'note-api-pr6-approve-ws-sequential-filter-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api sequential approve websocket filter follow-up summary',
      evidence: { source: 'api-approve-ws-sequential-filter-followup-test' },
      now: '2026-03-22T00:30:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-approve-ws-sequential-filter-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for sequential approve websocket filter follow-up test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;

    const firstWsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceReintegrationId === record!.id && event.data.id === firstAction.id,
    );
    const firstApprove = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve first for sequential websocket filter follow-up test' }),
      },
    );
    const firstWsEvent = await firstWsEventPromise;
    assert.equal(firstWsEvent.data.id, firstApprove.soulAction.id);
    assert.equal(firstWsEvent.data.sourceNoteId, firstApprove.soulAction.sourceNoteId);
    assert.equal(firstWsEvent.data.sourceReintegrationId, firstApprove.soulAction.sourceReintegrationId);
    assert.equal(firstWsEvent.data.governanceStatus, firstApprove.soulAction.governanceStatus);
    assert.equal(firstWsEvent.data.governanceStatus, 'approved');
    assert.equal(firstWsEvent.data.executionStatus, firstApprove.soulAction.executionStatus);
    assert.equal(firstWsEvent.data.executionStatus, 'not_dispatched');

    const pendingAfterFirstApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    const approvedAfterFirstApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );

    assert.equal(pendingAfterFirstApprove.filters.sourceReintegrationId, record!.id);
    assert.equal(pendingAfterFirstApprove.filters.governanceStatus, 'pending_review');
    assert.equal(pendingAfterFirstApprove.filters.executionStatus, 'not_dispatched');
    assert.equal(approvedAfterFirstApprove.filters.sourceReintegrationId, record!.id);
    assert.equal(approvedAfterFirstApprove.filters.governanceStatus, 'approved');
    assert.equal(approvedAfterFirstApprove.filters.executionStatus, 'not_dispatched');
    assert.equal(pendingAfterFirstApprove.soulActions.length, 1);
    assert.equal(pendingAfterFirstApprove.soulActions[0]?.id, secondAction.id);
    assert.equal(approvedAfterFirstApprove.soulActions.length, 1);
    assert.equal(approvedAfterFirstApprove.soulActions[0]?.id, firstAction.id);
    assert.equal(approvedAfterFirstApprove.soulActions[0]?.sourceNoteId, firstApprove.soulAction.sourceNoteId);
    assert.equal(approvedAfterFirstApprove.soulActions[0]?.sourceReintegrationId, firstApprove.soulAction.sourceReintegrationId);
    assert.equal(approvedAfterFirstApprove.soulActions[0]?.governanceStatus, firstApprove.soulAction.governanceStatus);
    assert.equal(approvedAfterFirstApprove.soulActions[0]?.executionStatus, firstApprove.soulAction.executionStatus);

    const secondWsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceReintegrationId === record!.id && event.data.id === secondAction.id,
    );
    const secondApprove = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve second for sequential websocket filter follow-up test' }),
      },
    );
    const secondWsEvent = await secondWsEventPromise;
    assert.equal(secondWsEvent.data.id, secondApprove.soulAction.id);
    assert.equal(secondWsEvent.data.sourceNoteId, secondApprove.soulAction.sourceNoteId);
    assert.equal(secondWsEvent.data.sourceReintegrationId, secondApprove.soulAction.sourceReintegrationId);
    assert.equal(secondWsEvent.data.governanceStatus, secondApprove.soulAction.governanceStatus);
    assert.equal(secondWsEvent.data.governanceStatus, 'approved');
    assert.equal(secondWsEvent.data.executionStatus, secondApprove.soulAction.executionStatus);
    assert.equal(secondWsEvent.data.executionStatus, 'not_dispatched');

    const fullAfterSecondApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterSecondApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    const approvedAfterSecondApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );

    assert.equal(pendingAfterSecondApprove.filters.sourceReintegrationId, record!.id);
    assert.equal(pendingAfterSecondApprove.filters.governanceStatus, 'pending_review');
    assert.equal(pendingAfterSecondApprove.filters.executionStatus, 'not_dispatched');
    assert.equal(approvedAfterSecondApprove.filters.sourceReintegrationId, record!.id);
    assert.equal(approvedAfterSecondApprove.filters.governanceStatus, 'approved');
    assert.equal(approvedAfterSecondApprove.filters.executionStatus, 'not_dispatched');
    assert.equal(pendingAfterSecondApprove.soulActions.length, 0);
    assert.equal(approvedAfterSecondApprove.soulActions.length, 2);
    assert.deepEqual(
      approvedAfterSecondApprove.soulActions.map((action) => action.id).sort(),
      [firstWsEvent.data.id, secondWsEvent.data.id].sort(),
    );
    for (const action of approvedAfterSecondApprove.soulActions) {
      const matchingResponse = action.id === firstApprove.soulAction.id ? firstApprove.soulAction : secondApprove.soulAction;
      assert.equal(action.sourceNoteId, matchingResponse.sourceNoteId);
      assert.equal(action.sourceReintegrationId, matchingResponse.sourceReintegrationId);
      assert.equal(action.governanceStatus, matchingResponse.governanceStatus);
      assert.equal(action.executionStatus, matchingResponse.executionStatus);
    }
    assert.deepEqual(
      approvedAfterSecondApprove.soulActions.map((action) => action.id).sort(),
      fullAfterSecondApprove.soulActions.map((action) => action.id).sort(),
    );
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('worker-task terminal updates emit soul-action-updated websocket events aligned with persisted lifecycle state', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-worker-soul-action-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    const sourceNoteId = 'note-api-worker-soul-action-ws';
    const action = createOrReuseSoulAction({
      sourceNoteId,
      actionKind: 'update_persona_snapshot',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-23T10:00:00.000Z',
      governanceReason: 'approved for worker/soul-action websocket sync test',
    });

    const terminalSoulActionEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated'
        && event.data.id === action.id
        && ['succeeded', 'failed', 'cancelled'].includes(event.data.executionStatus),
    );
    const terminalTaskEventPromise = waitForWebSocketEvent<WorkerTaskWsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated'
        && ['succeeded', 'failed', 'cancelled'].includes(event.data.status)
        && event.data.sourceNoteId === sourceNoteId
        && event.data.taskType === 'update_persona_snapshot',
    );

    const dispatchResponse = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.ok(dispatchResponse.task);
    assert.equal(dispatchResponse.soulAction?.id, action.id);
    assert.equal(dispatchResponse.task?.sourceNoteId, sourceNoteId);

    const [terminalSoulActionEvent, terminalTaskEvent] = await Promise.all([
      terminalSoulActionEventPromise,
      terminalTaskEventPromise,
    ]);

    const persistedActionResponse = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action.id)}`,
    );
    const persistedAction = persistedActionResponse.soulAction;

    assert.equal(terminalSoulActionEvent.data.id, action.id);
    assert.equal(terminalSoulActionEvent.data.sourceNoteId, sourceNoteId);
    assert.equal(terminalSoulActionEvent.data.workerTaskId, dispatchResponse.task!.id);
    assert.equal(terminalSoulActionEvent.data.executionStatus, persistedAction.executionStatus);
    assert.equal(terminalSoulActionEvent.data.resultSummary ?? null, persistedAction.resultSummary ?? null);
    assert.equal(terminalSoulActionEvent.data.error ?? null, persistedAction.error ?? null);
    assert.equal(terminalSoulActionEvent.data.executionSummary?.objectType, persistedAction.executionSummary?.objectType ?? null);
    assert.equal(terminalSoulActionEvent.data.executionSummary?.objectId, persistedAction.executionSummary?.objectId ?? null);
    assert.equal(terminalSoulActionEvent.data.executionSummary?.operation, persistedAction.executionSummary?.operation ?? null);
    assert.equal(terminalSoulActionEvent.data.executionStatus, terminalTaskEvent.data.status === 'cancelled' ? 'cancelled' : terminalTaskEvent.data.status);
    assert.equal(terminalSoulActionEvent.data.resultSummary ?? null, terminalTaskEvent.data.resultSummary ?? null);
    assert.equal(terminalSoulActionEvent.data.error ?? null, terminalTaskEvent.data.error ?? null);
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('dispatch websocket updates stay aligned with follow-up filtered lists for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-ws-filter-followup-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-ws-filter-followup',
      sourceNoteId: 'note-api-pr6-ws-filter-followup',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api websocket filter follow-up summary',
      evidence: { source: 'api-ws-filter-followup-test' },
      now: '2026-03-21T23:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-ws-filter-followup');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for websocket filter follow-up test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    for (const action of accepted.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve for websocket filter follow-up test' }),
        },
      );
    }

    const firstAction = accepted.soulActions[0]!;
    const secondAction = accepted.soulActions[1]!;
    const wsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceReintegrationId === record!.id && event.data.id === firstAction.id,
    );

    const firstDispatch = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    assert.ok(firstDispatch.soulAction);

    const wsEvent = await wsEventPromise;
    assert.equal(wsEvent.data.id, firstDispatch.soulAction!.id);
    assert.equal(wsEvent.data.sourceNoteId, 'note-api-pr6-ws-filter-followup');
    assert.equal(wsEvent.data.sourceNoteId, firstDispatch.soulAction!.sourceNoteId);
    assert.equal(wsEvent.data.sourceReintegrationId, record!.id);
    assert.equal(wsEvent.data.sourceReintegrationId, firstDispatch.soulAction!.sourceReintegrationId);
    assert.equal(wsEvent.data.governanceStatus, firstDispatch.soulAction!.governanceStatus);

    const fullAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    const readyAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const dispatchedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(firstDispatch.soulAction!.executionStatus)}`,
    );

    assert.equal(fullAfterDispatch.soulActions.length, 2);
    assert.equal(readyAfterDispatch.filters.sourceReintegrationId, record!.id);
    assert.equal(readyAfterDispatch.filters.governanceStatus, 'approved');
    assert.equal(readyAfterDispatch.filters.executionStatus, 'not_dispatched');
    assert.equal(dispatchedAfterDispatch.filters.sourceReintegrationId, record!.id);
    assert.equal(dispatchedAfterDispatch.filters.governanceStatus, 'approved');
    assert.equal(dispatchedAfterDispatch.filters.executionStatus, firstDispatch.soulAction!.executionStatus);
    assert.equal(readyAfterDispatch.soulActions.length, 1);
    assert.equal(readyAfterDispatch.soulActions[0]?.id, secondAction.id);
    assert.equal(dispatchedAfterDispatch.soulActions.length, 1);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.id, firstAction.id);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.sourceNoteId, firstDispatch.soulAction!.sourceNoteId);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.sourceReintegrationId, firstDispatch.soulAction!.sourceReintegrationId);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.governanceStatus, firstDispatch.soulAction!.governanceStatus);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.executionStatus, firstDispatch.soulAction!.executionStatus);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.executionStatus, wsEvent.data.executionStatus);

    const filteredIds = [
      ...readyAfterDispatch.soulActions.map((action) => action.id),
      ...dispatchedAfterDispatch.soulActions.map((action) => action.id),
    ].sort();
    const fullApprovedIds = fullAfterDispatch.soulActions
      .filter((action) => action.governanceStatus === 'approved')
      .map((action) => action.id)
      .sort();
    assert.deepEqual(filteredIds, fullApprovedIds);
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});
test('soul-action dispatch emits soul-action-updated websocket event for settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-ws-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  let socket: WebSocket | null = null;

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(`ws://127.0.0.1:${env.port}/ws`);

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-ws-refresh',
      sourceNoteId: 'note-api-pr6-ws-refresh',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api websocket summary',
      evidence: { source: 'api-ws-test' },
      now: '2026-03-21T12:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-ws-refresh');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for websocket api test' }),
      },
    );
    const action = accepted.soulActions[0];
    assert.ok(action);

    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for websocket api test' }),
      },
    );

    const wsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceReintegrationId === record!.id && event.data.id === action!.id,
    );

    const dispatchResponse = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const wsEvent = await wsEventPromise;
    const filteredAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(dispatchResponse.soulAction!.executionStatus)}`,
    );
    const filteredAction = filteredAfterDispatch.soulActions.find((item) => item.id === action!.id);

    assert.ok(dispatchResponse.soulAction);
    assert.equal(wsEvent.type, 'soul-action-updated');
    assert.equal(wsEvent.data.id, action!.id);
    assert.equal(wsEvent.data.id, dispatchResponse.soulAction.id);
    assert.equal(wsEvent.data.sourceNoteId, 'note-api-pr6-ws-refresh');
    assert.equal(wsEvent.data.sourceNoteId, dispatchResponse.soulAction.sourceNoteId);
    assert.equal(wsEvent.data.sourceReintegrationId, record!.id);
    assert.equal(wsEvent.data.sourceReintegrationId, dispatchResponse.soulAction.sourceReintegrationId);
    assert.equal(wsEvent.data.governanceStatus, dispatchResponse.soulAction.governanceStatus);
    assert.equal(wsEvent.data.executionSummary?.objectType, dispatchResponse.soulAction.executionSummary?.objectType ?? null);
    assert.equal(wsEvent.data.executionSummary?.objectId, dispatchResponse.soulAction.executionSummary?.objectId ?? null);
    assert.equal(wsEvent.data.executionSummary?.operation, dispatchResponse.soulAction.executionSummary?.operation ?? null);
    assert.equal(filteredAfterDispatch.filters.sourceReintegrationId, record!.id);
    assert.equal(filteredAfterDispatch.filters.governanceStatus, 'approved');
    assert.equal(filteredAfterDispatch.filters.executionStatus, dispatchResponse.soulAction.executionStatus);
    assert.equal(filteredAction?.id, dispatchResponse.soulAction.id);
    assert.equal(filteredAction?.sourceNoteId, dispatchResponse.soulAction.sourceNoteId);
    assert.equal(filteredAction?.sourceReintegrationId, dispatchResponse.soulAction.sourceReintegrationId);
    assert.equal(filteredAction?.governanceStatus, dispatchResponse.soulAction.governanceStatus);
    assert.equal(filteredAction?.executionStatus, dispatchResponse.soulAction.executionStatus);
    assert.equal(filteredAction?.executionSummary?.objectType, dispatchResponse.soulAction.executionSummary?.objectType ?? null);
    assert.equal(filteredAction?.executionSummary?.objectId, dispatchResponse.soulAction.executionSummary?.objectId ?? null);
    assert.equal(filteredAction?.executionSummary?.operation, dispatchResponse.soulAction.executionSummary?.operation ?? null);
    assert.ok(['pending', 'running', 'succeeded'].includes(wsEvent.data.executionStatus));
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('execution-status filter stays aligned when grouped actions converge to the same dispatched state', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-same-status-filter-');
  const configFile = env.configPath;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    await startServer();

    const baseUrl = `http://127.0.0.1:${env.port}`;
    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    initDatabase();
    upsertReintegrationRecord({
      workerTaskId: 'api-pr6-same-status-filter',
      sourceNoteId: 'note-api-pr6-same-status-filter',
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api same-status filter summary',
      evidence: { source: 'api-same-status-filter-test' },
      now: '2026-03-21T21:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-same-status-filter');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for same execution-status filter test' }),
      },
    );
    assert.equal(accepted.soulActions.length, 2);

    for (const action of accepted.soulActions) {
      await api<SoulActionResponse>(
        baseUrl,
        `/api/soul-actions/${encodeURIComponent(action.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'approve for same execution-status filter test' }),
        },
      );
    }

    const dispatchResults: DispatchSoulActionResponse[] = [];
    for (const action of accepted.soulActions) {
      dispatchResults.push(
        await api<DispatchSoulActionResponse>(
          baseUrl,
          `/api/soul-actions/${encodeURIComponent(action.id)}/dispatch`,
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        ),
      );
    }

    const terminalStatus = dispatchResults[0]!.soulAction!.executionStatus;
    assert.ok(dispatchResults.every((result) => result.soulAction?.executionStatus === terminalStatus));

    const fullList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}`,
    );
    assert.equal(fullList.soulActions.length, accepted.soulActions.length);

    const readyList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    assert.equal(readyList.soulActions.length, 0);

    const sameStatusList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceReintegrationId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(terminalStatus)}`,
    );
    assert.equal(sameStatusList.soulActions.length, accepted.soulActions.length);

    const fullIds = fullList.soulActions.map((action) => action.id).sort();
    const sameStatusIds = sameStatusList.soulActions.map((action) => action.id).sort();
    assert.deepEqual(sameStatusIds, fullIds);
    assert.ok(sameStatusList.soulActions.every((action) => action.governanceStatus === 'approved'));
    assert.ok(sameStatusList.soulActions.every((action) => action.executionStatus === terminalStatus));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});