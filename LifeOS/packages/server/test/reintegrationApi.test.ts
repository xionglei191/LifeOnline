import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import {
  type AcceptReintegrationRecordResponse,
  type DispatchSoulActionResponse,
  type ListReintegrationRecordsResponse,
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
type WorkerTaskWsEvent = Extract<WsEvent, { type: 'worker-task-updated' }>;

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

test('reintegration accept API returns reviewed record and planned soul actions', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-accept-');
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api accept summary',
      evidence: { source: 'api-test' },
      now: '2026-03-21T10:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-accept');
    assert.ok(record);
    assert.equal(record?.reviewStatus, 'pending_review');

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
    assert.equal(accepted.soulActions.length, 2);
    assert.deepEqual(
      accepted.soulActions.map((action) => action.actionKind).sort(),
      ['promote_continuity_record', 'promote_event_node'],
    );
    assert.ok(accepted.soulActions.every((action) => action.sourceNoteId === record!.id));

    const planned = await api<PlanReintegrationPromotionsResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/plan-promotions`,
      { method: 'POST' },
    );
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

test('soul-action list API keeps filters stable with multiple promotion actions and mixed governance states', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-filters-');
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(recordA!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    assert.equal(pendingForA.filters.sourceNoteId, recordA!.id);
    assert.equal(pendingForA.filters.governanceStatus, 'pending_review');
    assert.equal(pendingForA.filters.executionStatus, 'not_dispatched');
    assert.equal(pendingForA.soulActions.length, 1);
    assert.ok(pendingForA.soulActions.every((action) => action.sourceNoteId === recordA!.id));
    assert.ok(pendingForA.soulActions.every((action) => action.governanceStatus === 'pending_review'));
    assert.ok(pendingForA.soulActions.every((action) => action.executionStatus === 'not_dispatched'));

    const approvedForA = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(recordA!.id)}&governanceStatus=approved`,
    );
    assert.equal(approvedForA.soulActions.length, 1);
    assert.equal(approvedForA.soulActions[0]?.id, approvedAction.id);
    assert.ok(approvedForA.soulActions.every((action) => action.sourceNoteId === recordA!.id));
    assert.ok(approvedForA.soulActions.every((action) => action.governanceStatus === 'approved'));

    const pendingForB = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(recordB!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    assert.equal(pendingForB.soulActions.length, 2);
    assert.ok(pendingForB.soulActions.every((action) => action.sourceNoteId === recordB!.id));
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      sourceNoteId: null,
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
    assert.ok(acceptedA.soulActions.every((action) => action.sourceNoteId === recordA!.id));
    assert.ok(acceptedB.soulActions.every((action) => action.sourceNoteId === recordB!.id));

    const allSoulActions = await api<ListSoulActionsResponse>(baseUrl, '/api/soul-actions');
    const groupedIds = new Map<string, Set<string>>();
    for (const action of allSoulActions.soulActions.filter((item) => item.sourceNoteId === recordA!.id || item.sourceNoteId === recordB!.id)) {
      if (!groupedIds.has(action.sourceNoteId)) {
        groupedIds.set(action.sourceNoteId, new Set());
      }
      groupedIds.get(action.sourceNoteId)!.add(action.id);
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      sourceNoteId: null,
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
      sourceNoteId: null,
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
    for (const action of allSoulActions.soulActions.filter((item) => item.sourceNoteId === recordA!.id || item.sourceNoteId === recordB!.id || item.sourceNoteId === recordC!.id)) {
      const current = groups.get(action.sourceNoteId) ?? { totalCount: 0, pendingCount: 0, dispatchReadyCount: 0 };
      current.totalCount += 1;
      if (action.governanceStatus === 'pending_review') {
        current.pendingCount += 1;
      }
      if (action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched') {
        current.dispatchReadyCount += 1;
      }
      groups.set(action.sourceNoteId, current);
    }

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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
          if (event.type !== 'soul-action-updated' || event.data.sourceNoteId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceNoteId !== record!.id) {
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterAccept = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
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

test('reintegration accept emits soul-action-updated websocket events for planned settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-accept-ws-');
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
          if (event.type !== 'soul-action-updated' || event.data.sourceNoteId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<SoulActionWsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceNoteId !== record!.id) {
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
    const action = createOrReuseSoulAction({
      sourceNoteId: '2025-02-01.md',
      actionKind: 'update_persona_snapshot',
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
      now: '2026-03-22T01:00:00.000Z',
      governanceReason: 'approved for dispatch task websocket follow-up test',
    });

    const taskEventPromise = waitForWebSocketEvent<WorkerTaskWsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated' && event.data.sourceNoteId === action.sourceNoteId,
    );

    const dispatched = await api<DispatchSoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action.id)}/dispatch`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    assert.equal(dispatched.soulAction?.id, action.id);
    assert.equal(dispatched.soulAction?.sourceNoteId, action.sourceNoteId);
    assert.ok(dispatched.result.workerTaskId);
    assert.ok(dispatched.task);
    assert.equal(dispatched.task?.id, dispatched.result.workerTaskId);
    assert.equal(dispatched.task?.sourceNoteId, action.sourceNoteId);
    assert.equal(dispatched.task?.taskType, 'update_persona_snapshot');
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(dispatched.task!.status));

    const taskEvent = await taskEventPromise;
    assert.equal(taskEvent.type, 'worker-task-updated');
    assert.equal(taskEvent.data.id, dispatched.result.workerTaskId);
    assert.equal(taskEvent.data.sourceNoteId, action.sourceNoteId);
    assert.equal(taskEvent.data.taskType, 'update_persona_snapshot');
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(taskEvent.data.status));

    const workerTasksAfterDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(action.sourceNoteId)}`,
    );
    const filteredWorkerTasksAfterDispatch = await api<{ tasks: WorkerTask[]; filters: { sourceNoteId?: string; status?: string; taskType?: string; worker?: string } }>(
      baseUrl,
      `/api/worker-tasks?sourceNoteId=${encodeURIComponent(action.sourceNoteId)}&taskType=${encodeURIComponent(dispatched.task!.taskType)}`,
    );
    const refreshedTask = workerTasksAfterDispatch.tasks.find((task) => task.id === dispatched.result.workerTaskId);
    const filteredTask = filteredWorkerTasksAfterDispatch.tasks.find((task) => task.id === dispatched.result.workerTaskId);

    assert.ok(refreshedTask);
    assert.ok(filteredTask);
    assert.equal(workerTasksAfterDispatch.filters.sourceNoteId, action.sourceNoteId);
    assert.equal(filteredWorkerTasksAfterDispatch.filters.sourceNoteId, action.sourceNoteId);
    assert.equal(filteredWorkerTasksAfterDispatch.filters.taskType, dispatched.task!.taskType);
    assert.equal(refreshedTask?.id, taskEvent.data.id);
    assert.equal(refreshedTask?.sourceNoteId, taskEvent.data.sourceNoteId);
    assert.equal(refreshedTask?.taskType, taskEvent.data.taskType);
    assert.equal(filteredTask?.id, dispatched.task?.id);
    assert.equal(filteredTask?.sourceNoteId, dispatched.task?.sourceNoteId);
    assert.equal(filteredTask?.taskType, dispatched.task?.taskType);
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(refreshedTask!.status));
    assert.ok(['pending', 'running', 'succeeded', 'failed'].includes(filteredTask!.status));
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('dispatch API response and follow-up list stay aligned for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-dispatch-list-');
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
    assert.equal(dispatched.soulAction.sourceNoteId, record!.id);

    const listedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const refreshed = listedAfterDispatch.soulActions.find((item) => item.id === action!.id);
    assert.ok(refreshed);
    assert.equal(refreshed?.sourceNoteId, record!.id);
    assert.equal(refreshed?.governanceStatus, 'approved');
    assert.equal(refreshed?.executionStatus, dispatched.soulAction.executionStatus);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('grouped settings list converges after full accept-approve-dispatch chain', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-group-convergence-');
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    assert.equal(listedAfterDispatch.soulActions.length, accepted.soulActions.length);

    const refreshedById = new Map(listedAfterDispatch.soulActions.map((action) => [action.id, action]));
    for (const dispatched of dispatchResults) {
      assert.ok(dispatched.soulAction);
      const refreshed = refreshedById.get(dispatched.soulAction!.id);
      assert.ok(refreshed);
      assert.equal(refreshed?.sourceNoteId, record!.id);
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const mixedById = new Map(listedAfterMixedUpdate.soulActions.map((action) => [action.id, action]));
    assert.equal(mixedById.get(firstAction.id)?.sourceNoteId, record!.id);
    assert.equal(mixedById.get(firstAction.id)?.governanceStatus, 'approved');
    assert.equal(mixedById.get(firstAction.id)?.executionStatus, firstDispatched.soulAction!.executionStatus);
    assert.equal(mixedById.get(secondAction.id)?.sourceNoteId, record!.id);
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const readyAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const dispatchedAfterFirstDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(firstDispatch.soulAction!.executionStatus)}`,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const readyAfterSecondDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const secondDispatchedAfterSecondDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(secondDispatch.soulAction!.executionStatus)}`,
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const approvedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved`,
    );
    const readyList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const dispatchedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(firstDispatch.soulAction!.executionStatus)}`,
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const approvedList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved`,
    );
    const readyList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const sameStatusList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(terminalStatus)}`,
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      (event) => event.type === 'soul-action-updated' && event.data.sourceNoteId === record!.id && event.data.id === firstAction.id,
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
    assert.equal(wsEvent.data.sourceNoteId, record!.id);
    assert.equal(wsEvent.data.governanceStatus, firstApprove.soulAction.governanceStatus);
    assert.equal(wsEvent.data.governanceStatus, 'approved');
    assert.equal(wsEvent.data.executionStatus, 'not_dispatched');

    const fullAfterApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    const approvedReadyAfterApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      (event) => event.type === 'soul-action-updated' && event.data.sourceNoteId === record!.id && event.data.id === firstAction.id,
    );
    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(firstAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve first for sequential websocket filter follow-up test' }),
      },
    );
    const firstWsEvent = await firstWsEventPromise;
    assert.equal(firstWsEvent.data.governanceStatus, 'approved');
    assert.equal(firstWsEvent.data.executionStatus, 'not_dispatched');

    const pendingAfterFirstApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    const approvedAfterFirstApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );

    assert.equal(pendingAfterFirstApprove.soulActions.length, 1);
    assert.equal(pendingAfterFirstApprove.soulActions[0]?.id, secondAction.id);
    assert.equal(approvedAfterFirstApprove.soulActions.length, 1);
    assert.equal(approvedAfterFirstApprove.soulActions[0]?.id, firstAction.id);

    const secondWsEventPromise = waitForWebSocketEvent<SoulActionWsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceNoteId === record!.id && event.data.id === secondAction.id,
    );
    await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(secondAction.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve second for sequential websocket filter follow-up test' }),
      },
    );
    const secondWsEvent = await secondWsEventPromise;
    assert.equal(secondWsEvent.data.governanceStatus, 'approved');
    assert.equal(secondWsEvent.data.executionStatus, 'not_dispatched');

    const fullAfterSecondApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const pendingAfterSecondApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=pending_review&executionStatus=not_dispatched`,
    );
    const approvedAfterSecondApprove = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );

    assert.equal(pendingAfterSecondApprove.soulActions.length, 0);
    assert.equal(approvedAfterSecondApprove.soulActions.length, 2);
    assert.deepEqual(
      approvedAfterSecondApprove.soulActions.map((action) => action.id).sort(),
      [firstWsEvent.data.id, secondWsEvent.data.id].sort(),
    );
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

test('dispatch websocket updates stay aligned with follow-up filtered lists for grouped settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-ws-filter-followup-');
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      (event) => event.type === 'soul-action-updated' && event.data.sourceNoteId === record!.id && event.data.id === firstAction.id,
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
    assert.equal(wsEvent.type, 'soul-action-updated');
    assert.equal(wsEvent.data.id, firstAction.id);
    assert.equal(wsEvent.data.sourceNoteId, record!.id);
    assert.equal(wsEvent.data.executionStatus, firstDispatch.soulAction!.executionStatus);

    const fullAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    const readyAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    const dispatchedAfterDispatch = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(firstDispatch.soulAction!.executionStatus)}`,
    );

    assert.equal(fullAfterDispatch.soulActions.length, 2);
    assert.equal(readyAfterDispatch.soulActions.length, 1);
    assert.equal(readyAfterDispatch.soulActions[0]?.id, secondAction.id);
    assert.equal(dispatchedAfterDispatch.soulActions.length, 1);
    assert.equal(dispatchedAfterDispatch.soulActions[0]?.id, firstAction.id);
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      (event) => event.type === 'soul-action-updated' && event.data.sourceNoteId === record!.id && event.data.id === action!.id,
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
    assert.equal(wsEvent.type, 'soul-action-updated');
    assert.equal(wsEvent.data.id, action!.id);
    assert.equal(wsEvent.data.sourceNoteId, record!.id);
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
  const configFile = path.resolve('/home/xionglei/LifeOnline/LifeOS/packages/server/config.json');
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
      sourceNoteId: null,
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
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}`,
    );
    assert.equal(fullList.soulActions.length, accepted.soulActions.length);

    const readyList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=not_dispatched`,
    );
    assert.equal(readyList.soulActions.length, 0);

    const sameStatusList = await api<ListSoulActionsResponse>(
      baseUrl,
      `/api/soul-actions?sourceNoteId=${encodeURIComponent(record!.id)}&governanceStatus=approved&executionStatus=${encodeURIComponent(terminalStatus)}`,
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