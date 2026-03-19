import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { createTestEnv } from './helpers/testEnv.js';
import { startServer, stopServer, broadcastUpdate } from '../src/index.js';
import { loadConfig, loadStoredConfig } from '../src/config/configManager.js';

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

test('loadStoredConfig keeps persisted values separate from env overrides', async () => {
  const env = await createTestEnv('lifeos-config-persist-');
  const configFile = path.resolve('/home/xionglei/Project/LifeOnline/LifeOS/packages/server/config.json');
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
  const configFile = path.resolve('/home/xionglei/Project/LifeOnline/LifeOS/packages/server/config.json');
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
    const eventPromise = waitForWebSocketEvent<{ type: string; data?: unknown }>(
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
  const configFile = path.resolve('/home/xionglei/Project/LifeOnline/LifeOS/packages/server/config.json');
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

test('broadcastUpdate is silent when websocket server is unavailable', async () => {
  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    broadcastUpdate({ type: 'index-complete', data: { total: 1 } });
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
