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
