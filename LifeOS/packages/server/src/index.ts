import express from 'express';
import cors from 'cors';
import type { Server } from 'http';
import { router } from './api/routes.js';
import { initDatabase, closeDb } from './db/client.js';
import { indexVault } from './indexer/indexer.js';
import { loadConfig } from './config/configManager.js';
import type { Config } from '@lifeos/shared';
import { FileWatcher } from './watcher/fileWatcher.js';
import { initWebSocket, closeWebSocket, broadcastUpdate } from './websocket/wsServer.js';
import { IndexQueue } from './indexer/indexQueue.js';
import { initScheduler, stopScheduler } from './workers/taskScheduler.js';

const app = express();
let watcher: FileWatcher | null = null;
let indexQueue: IndexQueue | null = null;
let httpServer: Server | null = null;
let lifecyclePromise: Promise<void> | null = null;
let signalHandlersRegistered = false;

app.use(cors());
app.use(express.json());
app.use('/api', router);

export { broadcastUpdate };

export interface ServerLifecycle {
  app: typeof app;
  server: Server;
  config: Config;
  watcher: FileWatcher;
  indexQueue: IndexQueue;
}

export function getIndexQueue(): IndexQueue | null {
  return indexQueue;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function stopWatcher(): Promise<void> {
  if (!watcher) return;
  const activeWatcher = watcher;
  watcher = null;
  await activeWatcher.stop();
}

async function shutdown(): Promise<void> {
  if (lifecyclePromise) {
    return lifecyclePromise;
  }

  lifecyclePromise = (async () => {
    stopScheduler();
    await stopWatcher();
    await closeWebSocket();

    if (httpServer) {
      const server = httpServer;
      httpServer = null;
      await closeServer(server);
    }

    indexQueue = null;
    closeDb();
  })();

  try {
    await lifecyclePromise;
  } finally {
    lifecyclePromise = null;
  }
}

function registerSignalHandlers(): void {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  const handleSignal = (signal: NodeJS.Signals) => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`Failed to shutdown on ${signal}:`, error);
        process.exit(1);
      });
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

export async function startServer(): Promise<ServerLifecycle> {
  if (httpServer && watcher && indexQueue) {
    const config = await loadConfig();
    return { app, server: httpServer, config, watcher, indexQueue };
  }

  initDatabase();

  const config = await loadConfig();
  await indexVault(config.vaultPath);
  console.log('Initial indexing complete');

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
      resolve(instance);
    });
  });

  httpServer = server;
  initWebSocket(server);

  indexQueue = new IndexQueue(broadcastUpdate);
  watcher = new FileWatcher(config.vaultPath, indexQueue);
  watcher.start();

  initScheduler();
  registerSignalHandlers();

  return { app, server, config, watcher, indexQueue };
}

export async function stopServer(): Promise<void> {
  await shutdown();
}

export async function restartWatcher(vaultPath: string): Promise<void> {
  await stopWatcher();
  if (!indexQueue) {
    indexQueue = new IndexQueue(broadcastUpdate);
  }
  watcher = new FileWatcher(vaultPath, indexQueue);
  watcher.start();
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
