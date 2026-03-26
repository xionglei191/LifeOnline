import chokidar, { type FSWatcher as ChokidarWatcher } from 'chokidar';
import path from 'path';
import { EventEmitter } from 'events';
import { IndexQueue } from '../indexer/indexQueue.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('fileWatcher');

const MAX_RESTARTS = 5;

// Helper function to resolve vault path, assuming it's defined elsewhere or needs to be added.
// For now, we'll keep the original path.resolve logic and add the logger.
function resolveVaultPath(vaultPath: string): string {
  return path.resolve(vaultPath);
}

export class FileWatcher extends EventEmitter {
  private watcher: ChokidarWatcher | null = null;
  private vaultPath: string;
  private queue: IndexQueue;
  private restartCount = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(vaultPath: string, queue: IndexQueue) {
    super();
    this.vaultPath = resolveVaultPath(vaultPath); // Assuming resolveVaultPath is a function
    this.queue = queue;
  }

  start() {
    logger.info(`resolved vault path = ${this.vaultPath}`);
    logger.info(`watching directory: ${this.vaultPath}`);

    // Watch the directory, not a glob pattern
    this.watcher = chokidar.watch(this.vaultPath, {
      ignored: [
        /(^|[\/\\])\../, // Dotfiles like .obsidian, .git
        /(^|[\/\\])(_Templates|Templates|_scripts|Scripts|assets)($|[\/\\])/ 
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 99,  // Watch subdirectories
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    this.watcher.on('ready', () => {
      logger.info('ready and watching for changes');
      const watched = this.watcher?.getWatched();
      logger.info('number of watched directories:', Object.keys(watched || {}).length);
    });

    this.watcher.on('add', (filePath: string) => {
      logger.debug(`File added: ${filePath}`);
      if (filePath.endsWith('.md')) {
        this.queue.enqueue(filePath, 'upsert');
      }
    });

    this.watcher.on('change', (filePath: string) => {
      logger.debug(`File changed: ${filePath}`);
      if (filePath.endsWith('.md')) {
        this.queue.enqueue(filePath, 'upsert');
      }
    });

    this.watcher.on('unlink', (filePath: string) => {
      logger.debug(`File deleted: ${filePath}`);
      if (filePath.endsWith('.md')) {
        this.queue.enqueue(filePath, 'delete');
      }
    });

    this.watcher.on('error', (error: unknown) => {
      logger.error('FileWatcher error:', error);
      this.emit('error', error);
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
      logger.info('File watcher stopped');
    }
  }

  private handleError() {
    if (this.restartCount >= MAX_RESTARTS) {
      logger.error(`max restarts (${MAX_RESTARTS}) reached, giving up`);
      this.emit('fatal_error', new Error('Max watcher restarts reached'));
      return;
    }

    this.restartCount++;
    const delay = Math.pow(2, this.restartCount) * 1000;
    logger.info(`restarting in ${delay}ms (attempt ${this.restartCount}/${MAX_RESTARTS})`);

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
