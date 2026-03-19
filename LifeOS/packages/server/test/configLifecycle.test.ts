import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { createTestEnv } from './helpers/testEnv.js';
import { startServer, stopServer } from '../src/index.js';
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

test('updating config persists vault path and rebinds watcher to the new vault', async () => {
  const env = await createTestEnv('lifeos-config-update-');
  const configFile = path.resolve('/home/xionglei/Project/LifeOnline/LifeOS/packages/server/config.json');
  const originalConfig = await fs.readFile(configFile, 'utf-8');
  const replacementVaultPath = path.join(env.rootDir, 'replacement-vault');
  const replacementNotePath = path.join(replacementVaultPath, '切换后.md');

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

    process.env.VAULT_PATH = env.vaultPath;

    const unchanged = await api<{ success: boolean; indexResult: unknown | null }>(baseUrl, '/api/config', {
      method: 'POST',
      body: JSON.stringify({ vaultPath: env.vaultPath }),
    });
    assert.equal(unchanged.indexResult, null);

    await api<{ success: boolean }>(baseUrl, '/api/config', {
      method: 'POST',
      body: JSON.stringify({ vaultPath: replacementVaultPath }),
    });

    const storedConfig = await loadStoredConfig();
    assert.equal(storedConfig.vaultPath, replacementVaultPath);

    await fs.writeFile(replacementNotePath, '# rebound\n');

    await waitFor(async () => {
      const notes = await api<Array<{ file_path: string }>>(baseUrl, '/api/notes');
      return notes.some((note) => note.file_path === replacementNotePath);
    });
  } finally {
    await fs.writeFile(configFile, originalConfig);
    await env.cleanup();
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
