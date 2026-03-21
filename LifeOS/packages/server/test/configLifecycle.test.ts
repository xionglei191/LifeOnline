import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import type { AISuggestion, ListAiSuggestionsResponse, PromptRecord } from '@lifeos/shared';
import { createTestEnv } from './helpers/testEnv.js';
import { startServer, stopServer, broadcastUpdate } from '../src/index.js';
import { loadConfig, loadStoredConfig } from '../src/config/configManager.js';
import { createWorkerTask as seedWorkerTask, cancelWorkerTask as seedCancelWorkerTask } from '../src/workers/workerTasks.js';
import { configUpdateDeps } from '../src/config/configUpdateService.js';

const CONFIG_FILE = fileURLToPath(new URL('../config.json', import.meta.url));

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

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<T>;
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

test('AI provider APIs respond with shared provider contracts', async () => {
  const env = await createTestEnv('lifeos-ai-provider-contract-');
  const configFile = CONFIG_FILE;
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

    const fetched = await api<import('../../shared/src/types.js').AiProviderSettings>(baseUrl, '/api/ai/provider');
    assert.equal(typeof fetched.baseUrl, 'string');
    assert.equal(typeof fetched.model, 'string');
    assert.equal(typeof fetched.enabled, 'boolean');
    assert.equal(typeof fetched.hasApiKey, 'boolean');

    const updated = await api<import('../../shared/src/types.js').AiProviderSettings>(baseUrl, '/api/ai/provider', {
      method: 'PATCH',
      body: JSON.stringify({ model: fetched.model } satisfies import('../../shared/src/types.js').UpdateAiProviderSettingsRequest),
    });
    assert.equal(updated.model, fetched.model);

    const tested = await api<import('../../shared/src/types.js').TestAiProviderConnectionResponse>(baseUrl, '/api/ai/provider/test', {
      method: 'POST',
      body: JSON.stringify({ model: fetched.model } satisfies import('../../shared/src/types.js').TestAiProviderConnectionRequest),
    });
    assert.equal(typeof tested.success, 'boolean');
    assert.equal(typeof tested.message, 'string');
    assert.equal(typeof tested.resolvedBaseUrl, 'string');
    assert.equal(typeof tested.resolvedModel, 'string');
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('AI prompt APIs respond with shared prompt contracts', async () => {
  const env = await createTestEnv('lifeos-ai-prompt-contract-');
  const configFile = CONFIG_FILE;
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

    const listed = await api<import('../../shared/src/types.js').ListAiPromptsResponse>(baseUrl, '/api/ai/prompts');
    assert.ok(Array.isArray(listed.prompts));

    const updated = await api<import('../../shared/src/types.js').AiPromptResponse>(baseUrl, '/api/ai/prompts/classify', {
      method: 'PATCH',
      body: JSON.stringify({
        content: 'Classify content: {{content}}',
        enabled: true,
        notes: 'test override',
      } satisfies import('../../shared/src/types.js').UpdatePromptRequest),
    });
    assert.equal(updated.prompt.key, 'classify');
    assert.equal(updated.prompt.overrideContent, 'Classify content: {{content}}');

    const reset = await api<import('../../shared/src/types.js').ResetAiPromptResponse>(baseUrl, '/api/ai/prompts/classify', {
      method: 'DELETE',
    });
    assert.equal(reset.success, true);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('worker task APIs respond with shared worker task contracts', async () => {
  const env = await createTestEnv('lifeos-worker-task-contract-');
  const configFile = CONFIG_FILE;
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

    const created = await api<import('../../shared/src/types.js').CreateWorkerTaskResponse>(baseUrl, '/api/worker-tasks', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'openclaw_task',
        input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
      } satisfies import('../../shared/src/types.js').CreateWorkerTaskRequest),
    });
    assert.equal(created.task.taskType, 'openclaw_task');

    const listed = await api<import('../../shared/src/types.js').WorkerTaskListResponse>(baseUrl, '/api/worker-tasks?limit=10&taskType=openclaw_task');
    assert.ok(listed.tasks.some((task) => task.id === created.task.id));

    const fetched = await api<import('../../shared/src/types.js').WorkerTaskResponse>(baseUrl, `/api/worker-tasks/${created.task.id}`);
    assert.equal(fetched.task.id, created.task.id);

    const cancellableTask = seedWorkerTask({
      taskType: 'openclaw_task',
      input: { instruction: 'Seed cancellable task', outputDimension: 'learning' },
    });
    const cancelled = await api<import('../../shared/src/types.js').WorkerTaskResponse>(baseUrl, `/api/worker-tasks/${cancellableTask.id}/cancel`, {
      method: 'POST',
    });
    assert.equal(cancelled.task.id, cancellableTask.id);
    assert.equal(cancelled.task.status, 'cancelled');

    const retrySeed = seedWorkerTask({
      taskType: 'openclaw_task',
      input: { instruction: 'Seed retry task', outputDimension: 'learning' },
    });
    seedCancelWorkerTask(retrySeed.id);

    const retried = await api<import('../../shared/src/types.js').WorkerTaskResponse>(baseUrl, `/api/worker-tasks/${retrySeed.id}/retry`, {
      method: 'POST',
    });
    assert.equal(retried.task.id, retrySeed.id);

    const cleared = await api<import('../../shared/src/types.js').ClearFinishedWorkerTasksResponse>(baseUrl, '/api/worker-tasks/finished', {
      method: 'DELETE',
    });
    assert.equal(cleared.success, true);
    assert.equal(typeof cleared.deleted, 'number');
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('dashboard, timeline, and calendar APIs respond with shared view contracts', async () => {
  const env = await createTestEnv('lifeos-view-contracts-');
  const configFile = CONFIG_FILE;
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

    const dashboard = await api<import('../../shared/src/types.js').DashboardData>(baseUrl, '/api/dashboard');
    assert.ok(Array.isArray(dashboard.todayTodos));
    assert.ok(Array.isArray(dashboard.weeklyHighlights));
    assert.ok(Array.isArray(dashboard.dimensionStats));
    assert.equal(typeof dashboard.inboxCount, 'number');

    const timeline = await api<import('../../shared/src/types.js').TimelineData>(baseUrl, '/api/timeline?start=2026-01-01&end=2026-12-31');
    assert.equal(timeline.startDate, '2026-01-01');
    assert.equal(timeline.endDate, '2026-12-31');
    assert.ok(Array.isArray(timeline.tracks));

    const calendar = await api<import('../../shared/src/types.js').CalendarData>(baseUrl, '/api/calendar?year=2026&month=3');
    assert.equal(calendar.year, 2026);
    assert.equal(calendar.month, 3);
    assert.ok(Array.isArray(calendar.days));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('schedule APIs respond with shared schedule contracts', async () => {
  const env = await createTestEnv('lifeos-schedule-contract-');
  const configFile = CONFIG_FILE;
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

    const created = await api<import('../../shared/src/types.js').TaskScheduleResponse>(baseUrl, '/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'openclaw_task',
        input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
        cronExpression: '0 9 * * *',
        label: 'Daily reflection',
      } satisfies import('../../shared/src/types.js').CreateTaskScheduleRequest),
    });
    assert.equal(created.schedule.label, 'Daily reflection');

    const listed = await api<import('../../shared/src/types.js').TaskScheduleListResponse>(baseUrl, '/api/schedules');
    assert.ok(listed.schedules.some((schedule) => schedule.id === created.schedule.id));

    const fetched = await api<import('../../shared/src/types.js').TaskScheduleResponse>(baseUrl, `/api/schedules/${created.schedule.id}`);
    assert.equal(fetched.schedule.id, created.schedule.id);

    const updated = await api<import('../../shared/src/types.js').TaskScheduleResponse>(baseUrl, `/api/schedules/${created.schedule.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ label: 'Daily reflection updated' } satisfies import('../../shared/src/types.js').UpdateTaskScheduleRequest),
    });
    assert.equal(updated.schedule.label, 'Daily reflection updated');

    const runNow = await api<import('../../shared/src/types.js').TaskScheduleResponse>(baseUrl, `/api/schedules/${created.schedule.id}/run`, {
      method: 'POST',
    });
    assert.equal(runNow.schedule.id, created.schedule.id);

    const deleted = await api<import('../../shared/src/types.js').DeleteTaskScheduleResponse>(baseUrl, `/api/schedules/${created.schedule.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleted.success, true);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('stats APIs respond with shared stats contracts', async () => {
  const env = await createTestEnv('lifeos-stats-contract-');
  const configFile = CONFIG_FILE;
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

    const trend = await api<Array<import('../../shared/src/types.js').StatsTrendPoint>>(baseUrl, '/api/stats/trend?days=30');
    const radar = await api<Array<import('../../shared/src/types.js').StatsRadarPoint>>(baseUrl, '/api/stats/radar');
    const monthly = await api<Array<import('../../shared/src/types.js').StatsMonthlyPoint>>(baseUrl, '/api/stats/monthly');
    const tags = await api<Array<import('../../shared/src/types.js').StatsTagPoint>>(baseUrl, '/api/stats/tags');

    assert.ok(Array.isArray(trend));
    assert.ok(Array.isArray(radar));
    assert.ok(Array.isArray(monthly));
    assert.ok(Array.isArray(tags));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('schedule health API responds with shared schedule health contract', async () => {
  const env = await createTestEnv('lifeos-schedule-health-contract-');
  const configFile = CONFIG_FILE;
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

    const health = await api<import('../../shared/src/types.js').ScheduleHealth>(baseUrl, '/api/schedules/health');
    assert.equal(typeof health.total, 'number');
    assert.equal(typeof health.active, 'number');
    assert.equal(typeof health.failing, 'number');
    assert.ok(Array.isArray(health.failingSchedules));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('config API responds with shared config contracts', async () => {
  const env = await createTestEnv('lifeos-config-contract-');
  const configFile = CONFIG_FILE;
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

    const config = await api<import('../../shared/src/types.js').Config>(baseUrl, '/api/config');
    assert.equal(config.vaultPath, env.vaultPath);
    assert.equal(config.port, env.port);

    const unchanged = await api<import('../../shared/src/types.js').UpdateConfigResponse>(baseUrl, '/api/config', {
      method: 'POST',
      body: JSON.stringify({ vaultPath: env.vaultPath } satisfies import('../../shared/src/types.js').UpdateConfigRequest),
    });
    assert.equal(unchanged.success, true);
    assert.equal(unchanged.indexResult, null);

    const indexStatus = await api<import('../../shared/src/types.js').IndexStatus>(baseUrl, '/api/index/status');
    assert.equal(typeof indexStatus.queueSize, 'number');
    assert.equal(typeof indexStatus.processing, 'boolean');
    assert.equal(indexStatus.processingFile === null || typeof indexStatus.processingFile === 'string', true);

    const indexErrors = await api<Array<import('../../shared/src/types.js').IndexErrorEventData>>(baseUrl, '/api/index/errors');
    assert.ok(Array.isArray(indexErrors));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('configManager reuses shared Config contract internally', async () => {
  const env = await createTestEnv('lifeos-config-manager-contract-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));

    const storedConfig = await loadStoredConfig();
    const runtimeConfig = await loadConfig();

    const storedConfigContract = storedConfig satisfies import('../../shared/src/types.js').Config;
    const runtimeConfigContract = runtimeConfig satisfies import('../../shared/src/types.js').Config;

    assert.equal(storedConfigContract.vaultPath, env.vaultPath);
    assert.equal(storedConfigContract.port, env.port);
    assert.equal(runtimeConfigContract.vaultPath, env.vaultPath);
    assert.equal(runtimeConfigContract.port, env.port);
  } finally {
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('loadStoredConfig keeps persisted values separate from env overrides', async () => {
  const env = await createTestEnv('lifeos-config-persist-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const persistedVaultPath = path.join(env.rootDir, 'persisted-vault');

  await fs.mkdir(persistedVaultPath, { recursive: true });
  await fs.writeFile(path.join(persistedVaultPath, 'note.md'), '# persisted\n');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: persistedVaultPath, port: 3000 }, null, 2));
    process.env.VAULT_PATH = env.vaultPath;
    process.env.PORT = '4567';

    const storedConfig = await loadStoredConfig();
    const runtimeConfig = await loadConfig();

    assert.equal(storedConfig.vaultPath, persistedVaultPath);
    assert.equal(storedConfig.port, 3000);
    assert.equal(runtimeConfig.vaultPath, env.vaultPath);
    assert.equal(runtimeConfig.port, 4567);
  } finally {
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('updating config persists vault path, emits index-complete, and rebinds watcher to the new vault', async () => {
  const env = await createTestEnv('lifeos-config-update-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const replacementVaultPath = path.join(env.rootDir, 'replacement-vault');
  const replacementNotePath = path.join(replacementVaultPath, '切换后.md');
  let socket: WebSocket | null = null;

  await fs.mkdir(replacementVaultPath, { recursive: true });
  await fs.writeFile(path.join(replacementVaultPath, 'seed.md'), '# seed\n');

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
    process.env.VAULT_PATH = env.vaultPath;

    const unchanged = await api<{ success: boolean; indexResult: unknown | null }>(baseUrl, '/api/config', {
      method: 'POST',
      body: JSON.stringify({ vaultPath: env.vaultPath }),
    });
    assert.equal(unchanged.indexResult, null);

    const responsePromise = api<{ success: boolean; indexResult: unknown }>(baseUrl, '/api/config', {
      method: 'POST',
      body: JSON.stringify({ vaultPath: replacementVaultPath }),
    });
    const eventPromise = waitForWebSocketEvent<import('@lifeos/shared').WsEvent>(
      socket,
      (event) => event.type === 'index-complete',
    );

    const [response, event] = await Promise.all([responsePromise, eventPromise]);

    assert.equal(event.type, 'index-complete');
    assert.deepEqual(event.data, response.indexResult);

    const storedConfig = await loadStoredConfig();
    assert.equal(storedConfig.vaultPath, replacementVaultPath);

    await fs.writeFile(replacementNotePath, '# rebound\n');

    await waitFor(async () => {
      const notes = await api<Array<{ file_path: string }>>(baseUrl, '/api/notes');
      return notes.some((note) => note.file_path === replacementNotePath);
    });
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('updating config treats equivalent vault paths as unchanged after normalization', async () => {
  const env = await createTestEnv('lifeos-config-normalize-');
  const configFile = CONFIG_FILE;
  const serverRoot = path.dirname(configFile);
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const relativeVaultPath = path.relative(serverRoot, env.vaultPath);

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

    const response = await api<{ success: boolean; indexResult: unknown | null }>(baseUrl, '/api/config', {
      method: 'POST',
      body: JSON.stringify({ vaultPath: `  ${relativeVaultPath}  ` }),
    });

    assert.equal(response.indexResult, null);

    const storedConfig = await loadStoredConfig();
    assert.equal(storedConfig.vaultPath, env.vaultPath);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('updating config rolls back persisted vault path when reindex fails', async () => {
  const env = await createTestEnv('lifeos-config-rollback-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const replacementVaultPath = path.join(env.rootDir, 'rollback-vault');
  const originalIndexVault = configUpdateDeps.indexVault;

  await fs.mkdir(replacementVaultPath, { recursive: true });
  await fs.writeFile(path.join(replacementVaultPath, 'seed.md'), '# rollback\n');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    configUpdateDeps.indexVault = async () => {
      throw new Error('index failed');
    };

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

    await assert.rejects(
      api(baseUrl, '/api/config', {
        method: 'POST',
        body: JSON.stringify({ vaultPath: replacementVaultPath }),
      }),
      /\/api\/config failed: 500/,
    );

    const storedConfig = await loadStoredConfig();
    assert.equal(storedConfig.vaultPath, env.vaultPath);
  } finally {
    configUpdateDeps.indexVault = originalIndexVault;
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('updating config restores original watcher state when restart fails', async () => {
  const env = await createTestEnv('lifeos-config-restart-rollback-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const replacementVaultPath = path.join(env.rootDir, 'restart-rollback-vault');
  const replacementNotePath = path.join(replacementVaultPath, '新库.md');
  const originalRestartWatcher = configUpdateDeps.restartWatcher;

  await fs.mkdir(replacementVaultPath, { recursive: true });
  await fs.writeFile(path.join(replacementVaultPath, 'seed.md'), '# restart rollback\n');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));

    let shouldFailRestart = true;
    configUpdateDeps.restartWatcher = async (vaultPath: string) => {
      if (shouldFailRestart && vaultPath === replacementVaultPath) {
        shouldFailRestart = false;
        throw new Error('restart failed');
      }
      await originalRestartWatcher(vaultPath);
    };

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

    await assert.rejects(
      api(baseUrl, '/api/config', {
        method: 'POST',
        body: JSON.stringify({ vaultPath: replacementVaultPath }),
      }),
      /\/api\/config failed: 500/,
    );

    const storedConfig = await loadStoredConfig();
    assert.equal(storedConfig.vaultPath, env.vaultPath);

    await fs.writeFile(path.join(env.vaultPath, 'still-watching.md'), '# original\n');

    await waitFor(async () => {
      const notes = await api<Array<{ file_path: string }>>(baseUrl, '/api/notes');
      const originalNoteDetected = notes.some((note) => note.file_path === path.join(env.vaultPath, 'still-watching.md'));
      const replacementNoteDetected = notes.some((note) => note.file_path === replacementNotePath);
      return originalNoteDetected && !replacementNoteDetected;
    });
  } finally {
    configUpdateDeps.restartWatcher = originalRestartWatcher;
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('soul-actions API approve then dispatch runs governance happy path', async () => {
  const env = await createTestEnv('lifeos-soul-actions-api-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const growthFilePath = path.join(env.vaultPath, '成长', '2026-03-20-api-review.md');

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

    await fs.mkdir(path.dirname(growthFilePath), { recursive: true });
    await fs.writeFile(growthFilePath, `---\ntype: "note"\ndimension: "growth"\nstatus: "done"\npriority: "medium"\nprivacy: "private"\ndate: "2026-03-20"\nsource: "desktop"\ncreated: "2026-03-20T09:00:00.000Z"\nupdated: "2026-03-20T09:00:00.000Z"\n---\n\n我想继续以长期主义和系统化推进。\n`);

    await waitFor(async () => {
      try {
        const queued = await api<{ soulActions: Array<{ id: string }> }>(
          baseUrl,
          '/api/soul-actions?governanceStatus=pending_review&actionKind=update_persona_snapshot',
        );
        return queued.soulActions.length === 1;
      } catch {
        return false;
      }
    });

    const queueResponse = await api<{ soulActions: Array<{ id: string; governanceStatus: string; executionStatus: string }> }>(
      baseUrl,
      '/api/soul-actions?governanceStatus=pending_review&actionKind=update_persona_snapshot',
    );
    assert.equal(queueResponse.soulActions.length, 1);
    const queued = queueResponse.soulActions[0]!;
    assert.equal(queued.governanceStatus, 'pending_review');
    assert.equal(queued.executionStatus, 'not_dispatched');

    const approved = await api<{ soulAction: { id: string; governanceStatus: string; executionStatus: string } }>(
      baseUrl,
      `/api/soul-actions/${queued.id}/approve`,
      { method: 'POST', body: JSON.stringify({ reason: 'approved in api test' }) },
    );
    assert.equal(approved.soulAction.governanceStatus, 'approved');
    assert.equal(approved.soulAction.executionStatus, 'not_dispatched');

    const dispatched = await api<{ result: { dispatched: boolean; workerTaskId: string | null }; soulAction: { governanceStatus: string; executionStatus: string }; task: { id: string; status: string } }>(
      baseUrl,
      `/api/soul-actions/${queued.id}/dispatch`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    assert.equal(dispatched.result.dispatched, true);
    assert.ok(dispatched.result.workerTaskId);
    assert.equal(dispatched.soulAction.governanceStatus, 'approved');
    assert.equal(dispatched.task.status, 'succeeded');

    const detail = await api<{ soulAction: { id: string; governanceStatus: string; executionStatus: string; workerTaskId: string | null } }>(
      baseUrl,
      `/api/soul-actions/${queued.id}`,
    );
    assert.equal(detail.soulAction.id, queued.id);
    assert.equal(detail.soulAction.governanceStatus, 'approved');
    assert.equal(detail.soulAction.executionStatus, 'succeeded');
    assert.ok(detail.soulAction.workerTaskId);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('AI suggestions prompt override accepts suggest prompt and reset restores default content', async () => {
  const env = await createTestEnv('lifeos-ai-suggest-prompt-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const overrideContent = `Analyze the following productivity data and generate actionable suggestions. Return only valid JSON.\n\nDashboard data:\n{dashboardData}\n\nRecent notes summary:\n{recentNotes}\n\nReturn exactly 1 suggestion as JSON only.`;

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

    const listed = await api<{ prompts: PromptRecord[] }>(baseUrl, '/api/ai/prompts');
    const suggestPrompt = listed.prompts.find((prompt) => prompt.key === 'suggest');
    assert.ok(suggestPrompt);
    assert.equal(suggestPrompt?.requiredPlaceholders.includes('{dashboardData}'), true);
    assert.equal(suggestPrompt?.requiredPlaceholders.includes('{recentNotes}'), true);
    assert.equal(suggestPrompt?.isOverridden, false);

    const updated = await api<{ prompt: PromptRecord }>(baseUrl, '/api/ai/prompts/suggest', {
      method: 'PATCH',
      body: JSON.stringify({
        content: overrideContent,
        enabled: true,
        notes: 'config lifecycle test override',
      }),
    });

    assert.equal(updated.prompt.key, 'suggest');
    assert.equal(updated.prompt.overrideContent, overrideContent);
    assert.equal(updated.prompt.effectiveContent, overrideContent);
    assert.equal(updated.prompt.isOverridden, true);
    assert.equal(updated.prompt.notes, 'config lifecycle test override');

    const relisted = await api<{ prompts: PromptRecord[] }>(baseUrl, '/api/ai/prompts');
    const overriddenSuggestPrompt = relisted.prompts.find((prompt) => prompt.key === 'suggest');
    assert.ok(overriddenSuggestPrompt);
    assert.equal(overriddenSuggestPrompt?.effectiveContent, overrideContent);
    assert.equal(overriddenSuggestPrompt?.isOverridden, true);

    const reset = await api<{ success: boolean }>(baseUrl, '/api/ai/prompts/suggest', {
      method: 'DELETE',
    });
    assert.equal(reset.success, true);

    const resetListed = await api<{ prompts: PromptRecord[] }>(baseUrl, '/api/ai/prompts');
    const resetSuggestPrompt = resetListed.prompts.find((prompt) => prompt.key === 'suggest');
    assert.ok(resetSuggestPrompt);
    assert.equal(resetSuggestPrompt?.isOverridden, false);
    assert.equal(resetSuggestPrompt?.overrideContent, null);
    assert.notEqual(resetSuggestPrompt?.effectiveContent, overrideContent);
    assert.equal(resetSuggestPrompt?.requiredPlaceholders.includes('{dashboardData}'), true);
    assert.equal(resetSuggestPrompt?.requiredPlaceholders.includes('{recentNotes}'), true);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('AI suggestions prompt override rejects missing required placeholders', async () => {
  const env = await createTestEnv('lifeos-ai-suggest-prompt-invalid-');
  const configFile = CONFIG_FILE;
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

    const response = await fetch(`${baseUrl}/api/ai/prompts/suggest`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Dashboard data only: {dashboardData}',
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json() as { error?: string };
    assert.match(payload.error || '', /\{recentNotes\}/);

    const listed = await api<{ prompts: PromptRecord[] }>(baseUrl, '/api/ai/prompts');
    const suggestPrompt = listed.prompts.find((prompt) => prompt.key === 'suggest');
    assert.ok(suggestPrompt);
    assert.equal(suggestPrompt?.isOverridden, false);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('AI suggestions API returns fallback suggestions without provider credentials', async () => {
  const env = await createTestEnv('lifeos-ai-suggestions-api-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    delete process.env.ANTHROPIC_API_KEY;
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

    const response = await api<ListAiSuggestionsResponse>(baseUrl, '/api/ai/suggestions');
    const suggestions = response.suggestions;

    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.length <= 3);
    for (const suggestion of suggestions as AISuggestion[]) {
      assert.ok(suggestion.id);
      assert.match(suggestion.type, /^(balance|overload|goal|reminder)$/);
      assert.ok(suggestion.title.length > 0);
      assert.ok(suggestion.content.length > 0);
      assert.ok(suggestion.createdAt.length > 0);
      if (suggestion.dimension) {
        assert.match(suggestion.dimension, /^(health|career|finance|learning|relationship|life|hobby|growth)$/);
      }
    }
    assert.ok(suggestions.some((suggestion) => suggestion.dimension));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('AI suggestions API responds with shared list contract', async () => {
  const env = await createTestEnv('lifeos-ai-suggestions-contract-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');

  try {
    await fs.writeFile(configFile, JSON.stringify({ vaultPath: env.vaultPath, port: env.port }, null, 2));
    delete process.env.ANTHROPIC_API_KEY;
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

    const response = await api<ListAiSuggestionsResponse>(baseUrl, '/api/ai/suggestions');
    assert.equal(Object.prototype.hasOwnProperty.call(response, 'suggestions'), true);
    assert.ok(Array.isArray(response.suggestions));
    assert.ok(response.suggestions.length > 0);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('search API matches dimension terms used by search view copy', async () => {
  const env = await createTestEnv('lifeos-search-dimension-contract-');
  const configFile = CONFIG_FILE;
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

    const result = await api<import('../../shared/src/types.js').SearchResult>(baseUrl, '/api/search?q=growth');
    assert.ok(result.notes.length > 0);
    assert.ok(result.notes.some((note) => note.dimension === 'growth'));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('search API matches tag terms used by search view copy', async () => {
  const env = await createTestEnv('lifeos-search-tag-contract-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const taggedNotePath = path.join(env.vaultPath, '成长', '2026-03-22-search-tag-contract.md');

  try {
    await fs.writeFile(
      taggedNotePath,
      `---
type: note
dimension: growth
status: pending
privacy: private
date: 2026-03-22
tags: [rare-search-tag-contract]
source: web
created: 2026-03-22T10:00:00
---

Tag-only search body.
`,
    );
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

    const result = await api<import('../../shared/src/types.js').SearchResult>(baseUrl, '/api/search?q=rare-search-tag-contract');
    assert.ok(result.notes.some((note) => note.file_path === taggedNotePath));
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('notes API returns shared note title field when indexer extracts one', async () => {
  const env = await createTestEnv('lifeos-notes-title-contract-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const titledNotePath = path.join(env.vaultPath, '成长', '2026-03-22-title-contract.md');

  try {
    await fs.writeFile(
      titledNotePath,
      `---
type: note
dimension: growth
status: pending
privacy: private
date: 2026-03-22
source: web
created: 2026-03-22T10:00:00
---

## Shared contract title

Body for title contract coverage.
`,
    );
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

    const notes = await api<Array<import('@lifeos/shared').Note>>(baseUrl, '/api/notes');
    const createdNote = notes.find((note) => note.file_path === titledNotePath);

    assert.ok(createdNote);
    assert.equal(createdNote?.title, 'Shared contract title');
    assert.equal(createdNote?.file_name, '2026-03-22-title-contract.md');
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('notes update API responds with shared success contract', async () => {
  const env = await createTestEnv('lifeos-notes-update-contract-');
  const configFile = CONFIG_FILE;
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

    const notes = await api<Array<import('@lifeos/shared').Note>>(baseUrl, '/api/notes');
    const target = notes[0];
    assert.ok(target);

    const response = await api<import('@lifeos/shared').UpdateNoteResponse>(
      baseUrl,
      `/api/notes/${encodeURIComponent(target!.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done', approval_status: 'approved' } satisfies import('@lifeos/shared').UpdateNoteRequest),
      },
    );

    assert.deepEqual(response, { success: true });
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('notes create API responds with shared success contract', async () => {
  const env = await createTestEnv('lifeos-notes-create-contract-');
  const configFile = CONFIG_FILE;
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

    const response = await api<import('@lifeos/shared').CreateNoteResponse>(
      baseUrl,
      '/api/notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Server Contract Create Note',
          dimension: 'learning',
          type: 'note',
          content: 'server create contract body',
          priority: 'medium',
          tags: ['server-contract'],
        } satisfies import('@lifeos/shared').CreateNoteRequest),
      },
    );

    assert.equal(response.success, true);
    assert.match(response.filePath, /Server Contract Create Note\.md$/);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('notes create API records web source in created note frontmatter', async () => {
  const env = await createTestEnv('lifeos-notes-create-source-web-');
  const configFile = CONFIG_FILE;
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

    const createResponse = await api<import('@lifeos/shared').CreateNoteResponse>(
      baseUrl,
      '/api/notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Server Contract Web Source Note',
          dimension: 'learning',
          type: 'note',
          content: 'source semantics body',
          priority: 'medium',
          tags: ['source-semantics'],
        } satisfies import('@lifeos/shared').CreateNoteRequest),
      },
    );

    assert.equal(createResponse.success, true);

    const createdFile = await fs.readFile(createResponse.filePath, 'utf-8');
    assert.match(createdFile, /source:\s*web/);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('notes create API keeps longer file names aligned with shared note naming semantics', async () => {
  const env = await createTestEnv('lifeos-notes-create-long-name-');
  const configFile = CONFIG_FILE;
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const longTitle = 'Server Contract Web Source Note With A Much Longer Title For Stable Naming';

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

    const createResponse = await api<import('@lifeos/shared').CreateNoteResponse>(
      baseUrl,
      '/api/notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: longTitle,
          dimension: 'learning',
          type: 'note',
          content: 'naming semantics body',
          priority: 'medium',
          tags: ['naming-semantics'],
        } satisfies import('@lifeos/shared').CreateNoteRequest),
      },
    );

    assert.equal(createResponse.success, true);
    assert.match(createResponse.filePath, /Server Contract Web Source Note With A Much Longer Title For\.md$/);
  } finally {
    await stopServer();
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
  }
});

test('broadcastUpdate is silent when websocket server is unavailable', async () => {
  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    broadcastUpdate({ type: 'index-complete', data: { total: 1, indexed: 1, skipped: 0, deleted: 0, errors: [] } });
    assert.deepEqual(calls, []);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('stopServer closes active websocket clients', async () => {
  const env = await createTestEnv('lifeos-ws-shutdown-');
  let socket: WebSocket | null = null;

  try {
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

    const closeCode = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for websocket close')), 10000);
      socket!.once('close', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
      void stopServer().catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    assert.equal(closeCode, 1005);
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    await env.cleanup();
  }
});
