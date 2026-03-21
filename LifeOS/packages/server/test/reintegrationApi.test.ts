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
  type WsEvent,
} from '@lifeos/shared';
import { createTestEnv } from './helpers/testEnv.js';
import { startServer, stopServer } from '../src/index.js';
import { initDatabase } from '../src/db/client.js';
import { upsertReintegrationRecord } from '../src/soul/reintegrationRecords.js';

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
      waitForWebSocketEvent<WsEvent>(
        socket,
        (event) => {
          if (event.type !== 'soul-action-updated' || event.data.sourceNoteId !== record!.id) {
            return false;
          }
          seenActionIds.add(event.data.id);
          return seenActionIds.size >= 1;
        },
      ),
      waitForWebSocketEvent<WsEvent>(
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

test('soul-action approve emits soul-action-updated websocket event for settings refresh', async () => {
  const env = await createTestEnv('lifeos-reintegration-api-approve-ws-');
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
      workerTaskId: 'api-pr6-approve-ws-refresh',
      sourceNoteId: null,
      soulActionId: null,
      taskType: 'weekly_report',
      terminalStatus: 'succeeded',
      signalKind: 'weekly_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'api approve websocket summary',
      evidence: { source: 'api-approve-ws-test' },
      now: '2026-03-21T16:00:00.000Z',
    });

    const listed = await api<ListReintegrationRecordsResponse>(baseUrl, '/api/reintegration-records');
    const record = listed.reintegrationRecords.find((item) => item.workerTaskId === 'api-pr6-approve-ws-refresh');
    assert.ok(record);

    const accepted = await api<AcceptReintegrationRecordResponse>(
      baseUrl,
      `/api/reintegration-records/${encodeURIComponent(record!.id)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'accept for approve websocket api test' }),
      },
    );
    const action = accepted.soulActions[0];
    assert.ok(action);

    const wsEventPromise = waitForWebSocketEvent<WsEvent>(
      socket,
      (event) => event.type === 'soul-action-updated' && event.data.sourceNoteId === record!.id && event.data.id === action!.id && event.data.governanceStatus === 'approved',
    );

    const approved = await api<SoulActionResponse>(
      baseUrl,
      `/api/soul-actions/${encodeURIComponent(action!.id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'approve for websocket api test' }),
      },
    );

    const wsEvent = await wsEventPromise;
    assert.equal(approved.soulAction.id, action!.id);
    assert.equal(approved.soulAction.governanceStatus, 'approved');
    assert.equal(wsEvent.type, 'soul-action-updated');
    assert.equal(wsEvent.data.id, action!.id);
    assert.equal(wsEvent.data.sourceNoteId, record!.id);
    assert.equal(wsEvent.data.governanceStatus, 'approved');
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

    const wsEventPromise = waitForWebSocketEvent<WsEvent>(
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
