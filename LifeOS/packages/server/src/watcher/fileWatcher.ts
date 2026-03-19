import chokidar, { type FSWatcher as ChokidarWatcher } from 'chokidar';
import path from 'path';
import { IndexQueue } from '../indexer/indexQueue.js';

const MAX_RESTARTS = 5;

export class FileWatcher {
  private watcher: ChokidarWatcher | null = null;
  private vaultPath: string;
  private queue: IndexQueue;
  private restartCount = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(vaultPath: string, queue: IndexQueue) {
    this.vaultPath = path.resolve(vaultPath);
    this.queue = queue;
  }

  start() {
    console.log(`FileWatcher: resolved vault path = ${this.vaultPath}`);
    console.log(`FileWatcher: watching directory: ${this.vaultPath}`);

    // Watch the directory, not a glob pattern
    this.watcher = chokidar.watch(this.vaultPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      depth: 99,  // Watch subdirectories
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    this.watcher
      .on('ready', () => {
        const watched = this.watcher?.getWatched();
        console.log('FileWatcher: ready and watching for changes');
        console.log('FileWatcher: number of watched directories:', Object.keys(watched || {}).length);
      })
      .on('add', (filePath: string) => {
        if (!filePath.endsWith('.md')) return;
        console.log(`File added: ${filePath}`);
        this.queue.enqueue(filePath, 'upsert');
      })
      .on('change', (filePath: string) => {
        if (!filePath.endsWith('.md')) return;
        console.log(`File changed: ${filePath}`);
        this.queue.enqueue(filePath, 'upsert');
      })
      .on('unlink', (filePath: string) => {
        if (!filePath.endsWith('.md')) return;
        console.log(`File deleted: ${filePath}`);
        this.queue.enqueue(filePath, 'delete');
      })
      .on('error', (error: unknown) => {
        console.error('FileWatcher error:', error);
        this.handleError();
      });
  }

  async stop() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }

  private handleError() {
    if (this.restartCount >= MAX_RESTARTS) {
      console.error(`FileWatcher: max restarts (${MAX_RESTARTS}) reached, giving up`);
      return;
    }

    this.restartCount++;
    const delay = Math.pow(2, this.restartCount) * 1000;
    console.log(`FileWatcher: restarting in ${delay}ms (attempt ${this.restartCount}/${MAX_RESTARTS})`);

    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null;
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }
      this.start();
    }, delay);
  }
}
