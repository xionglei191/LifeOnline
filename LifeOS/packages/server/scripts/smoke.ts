import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import type { CreateWorkerTaskResponse, TaskSchedule, WorkerTaskStatus, WsEvent } from '@lifeos/shared';
import { createTestEnv } from '../test/helpers/testEnv.js';
import { startServer, stopServer } from '../src/index.js';

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for server readiness');
}

async function api<T>(baseUrl: string, pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

async function waitForWebSocketEvent<T>(socket: WebSocket, predicate: (payload: T) => boolean, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for WebSocket event'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.off('message', onMessage);
      socket.off('error', onError);
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
    socket.on('error', onError);
  });
}

async function openWebSocket(url: string, timeoutMs = 10000): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('Timed out connecting to WebSocket server'));
    }, timeoutMs);

    socket.once('open', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function main(): Promise<void> {
  const env = await createTestEnv('lifeos-smoke-');
  const baseUrl = `http://127.0.0.1:${env.port}`;
  const wsUrl = `ws://127.0.0.1:${env.port}/ws`;
  let socket: WebSocket | null = null;

  try {
    await startServer();

    await waitFor(async () => {
      try {
        await api(baseUrl, '/api/config');
        return true;
      } catch {
        return false;
      }
    });

    socket = await openWebSocket(wsUrl);

    const config = await api<{ vaultPath: string; port: number }>(baseUrl, '/api/config');
    assert.equal(config.vaultPath, env.vaultPath);
    assert.equal(config.port, env.port);

    const indexStatus = await api<{ queueSize: number; processing: boolean }>(baseUrl, '/api/index/status');
    assert.ok(typeof indexStatus.queueSize === 'number');

    const dashboard = await api<{ todayTodos: unknown[]; weeklyHighlights: unknown[] }>(baseUrl, '/api/dashboard');
    assert.ok(Array.isArray(dashboard.todayTodos));
    assert.ok(Array.isArray(dashboard.weeklyHighlights));

    const notes = await api<unknown[]>(baseUrl, '/api/notes');
    assert.ok(Array.isArray(notes));

    const workerTaskEventPromise = waitForWebSocketEvent<WsEvent>(
      socket,
      (event) => event.type === 'worker-task-updated',
    );

    const workerTaskResponse = await api<CreateWorkerTaskResponse>(baseUrl, '/api/worker-tasks', {
      method: 'POST',
      body: JSON.stringify({ taskType: 'extract_tasks', input: { noteId: 'missing-note' } }),
    });

    const workerTaskEvent = await workerTaskEventPromise;
    if (workerTaskEvent.type !== 'worker-task-updated') {
      throw new Error(`Unexpected websocket event: ${workerTaskEvent.type}`);
    }
    assert.equal(workerTaskEvent.data.id, workerTaskResponse.task.id);
    assert.equal(workerTaskEvent.data.taskType, 'extract_tasks');
    assert.equal(workerTaskEvent.data.status, 'pending');

    await waitFor(async () => {
      const task = await api<{ task: { status: WorkerTaskStatus } }>(baseUrl, `/api/worker-tasks/${workerTaskResponse.task.id}`);
      return ['failed', 'succeeded', 'cancelled'].includes(task.task.status);
    });

    const scheduleResponse = await api<{ schedule: TaskSchedule }>(baseUrl, '/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'extract_tasks',
        input: { noteId: 'missing-note' },
        cronExpression: '*/10 * * * *',
        label: 'smoke schedule',
      }),
    });

    const schedules = await api<{ schedules: TaskSchedule[] }>(baseUrl, '/api/schedules');
    assert.ok(schedules.schedules.some((schedule) => schedule.id === scheduleResponse.schedule.id));

    const health = await api<{ total: number; active: number }>(baseUrl, '/api/schedules/health');
    assert.ok(health.total >= 1);
    assert.ok(health.active >= 1);

    const rerun = await api<{ schedule: Pick<TaskSchedule, 'lastTaskId'> }>(baseUrl, `/api/schedules/${scheduleResponse.schedule.id}/run`, {
      method: 'POST',
    });
    assert.ok(rerun.schedule.lastTaskId);

    await api(baseUrl, `/api/schedules/${scheduleResponse.schedule.id}`, { method: 'DELETE' });

    console.log('✓ Smoke check passed');
  } finally {
    if (socket) {
      const activeSocket = socket;
      activeSocket.removeAllListeners('error');
      await new Promise<void>((resolve) => {
        activeSocket.once('close', () => resolve());
        activeSocket.close();
      }).catch(() => {});
    }
    await stopServer().catch(() => {});
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error('✗ Smoke check failed:', error);
  process.exit(1);
});
