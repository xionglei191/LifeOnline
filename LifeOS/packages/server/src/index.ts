import express from 'express';
import cors from 'cors';
import { router } from './api/routes.js';
import { initDatabase } from './db/client.js';
import { indexVault } from './indexer/indexer.js';
import { loadConfig } from './config/configManager.js';
import { FileWatcher } from './watcher/fileWatcher.js';
import { initWebSocket, broadcastUpdate } from './websocket/wsServer.js';
import { IndexQueue } from './indexer/indexQueue.js';
import { initScheduler, stopScheduler } from './workers/taskScheduler.js';

const app = express();
let watcher: FileWatcher | null = null;
let indexQueue: IndexQueue | null = null;

app.use(cors());
app.use(express.json());
app.use('/api', router);

export { broadcastUpdate };

export function getIndexQueue(): IndexQueue | null {
  return indexQueue;
}

// Expose restartWatcher for config updates
export function restartWatcher(vaultPath: string) {
  if (watcher) {
    watcher.stop();
  }
  if (!indexQueue) {
    indexQueue = new IndexQueue(broadcastUpdate);
  }
  watcher = new FileWatcher(vaultPath, indexQueue);
  watcher.start();
}

async function start() {
  initDatabase();

  const config = await loadConfig();
  const vaultPath = config.vaultPath;

  await indexVault(vaultPath);
  console.log('Initial indexing complete');

  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });

  // Initialize WebSocket
  initWebSocket(server);

  // Create index queue and file watcher
  indexQueue = new IndexQueue(broadcastUpdate);
  watcher = new FileWatcher(vaultPath, indexQueue);
  watcher.start();

  initScheduler();
}

// Graceful shutdown
process.on('SIGINT', () => {
  stopScheduler();
  if (watcher) {
    watcher.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopScheduler();
  if (watcher) {
    watcher.stop();
  }
  process.exit(0);
});

start().catch(console.error);
