import assert from 'node:assert/strict';
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

async function main(): Promise<void> {
  const env = await createTestEnv('lifeos-smoke-');
  const baseUrl = `http://127.0.0.1:${env.port}`;

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

    const workerTaskResponse = await api<{ task: { id: string } }>(baseUrl, '/api/worker-tasks', {
      method: 'POST',
      body: JSON.stringify({ taskType: 'extract_tasks', input: { noteId: 'missing-note' } }),
    });

    await waitFor(async () => {
      const task = await api<{ task: { status: string } }>(baseUrl, `/api/worker-tasks/${workerTaskResponse.task.id}`);
      return ['failed', 'succeeded', 'cancelled'].includes(task.task.status);
    });

    const scheduleResponse = await api<{ schedule: { id: string } }>(baseUrl, '/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'extract_tasks',
        input: { noteId: 'missing-note' },
        cronExpression: '*/10 * * * *',
        label: 'smoke schedule',
      }),
    });

    const schedules = await api<{ schedules: Array<{ id: string }> }>(baseUrl, '/api/schedules');
    assert.ok(schedules.schedules.some((schedule) => schedule.id === scheduleResponse.schedule.id));

    const health = await api<{ total: number; active: number }>(baseUrl, '/api/schedules/health');
    assert.ok(health.total >= 1);
    assert.ok(health.active >= 1);

    const rerun = await api<{ schedule: { lastTaskId?: string | null } }>(baseUrl, `/api/schedules/${scheduleResponse.schedule.id}/run`, {
      method: 'POST',
    });
    assert.ok(rerun.schedule.lastTaskId);

    await api(baseUrl, `/api/schedules/${scheduleResponse.schedule.id}`, { method: 'DELETE' });

    console.log('✓ Smoke check passed');
  } finally {
    await stopServer().catch(() => {});
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error('✗ Smoke check failed:', error);
  process.exit(1);
});
