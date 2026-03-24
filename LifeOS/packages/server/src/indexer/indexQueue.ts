import { EventEmitter } from 'events';
import { indexFile, deleteFileRecord } from './indexer.js';
import { Logger } from '../utils/logger.js';
import { getIndexedNoteTriggerSnapshot, triggerCognitiveAnalysisAfterIndex } from '../soul/postIndexPersonaTrigger.js';
import type { WsEvent, IndexOperation, IndexErrorEventData } from '@lifeos/shared';

const logger = new Logger('indexQueue');

interface QueueItem {
  filePath: string;
  operation: IndexOperation;
}

const MAX_ERRORS = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const DEBOUNCE_MS = 300;

/**
 * Concurrent file-index queue.
 *
 * Up to MAX_CONCURRENCY files are processed in parallel.  A Map is used as the
 * pending queue so that duplicate paths are de-duplicated (last-write wins).
 */
const MAX_CONCURRENCY = 3;

export class IndexQueue extends EventEmitter {
  private queue = new Map<string, QueueItem>();
  private activeCount = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private errors: IndexErrorEventData[] = [];
  private processingFiles = new Set<string>();
  private broadcast: (event: WsEvent) => void;

  constructor(broadcast: (event: WsEvent) => void) {
    super();
    this.broadcast = broadcast;
  }

  enqueue(filePath: string, operation: IndexOperation) {
    this.queue.set(filePath, { filePath, operation });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.scheduleProcess(), DEBOUNCE_MS);
  }

  getStatus() {
    return {
      queueSize: this.queue.size,
      processing: this.activeCount > 0,
      processingFiles: Array.from(this.processingFiles),
      activeCount: this.activeCount,
      concurrencyLimit: MAX_CONCURRENCY,
      // Legacy compat: return the first active file, if any
      processingFile: this.processingFiles.size > 0
        ? Array.from(this.processingFiles)[0]
        : null,
    };
  }

  getErrors() {
    return this.errors;
  }

  /** Drain available concurrency slots from the pending queue. */
  private scheduleProcess() {
    while (this.queue.size > 0 && this.activeCount < MAX_CONCURRENCY) {
      const [filePath, item] = this.queue.entries().next().value!;
      this.queue.delete(filePath);
      void this.processItem(item);
    }
  }

  private async processItem(item: QueueItem) {
    const { filePath } = item;
    this.activeCount++;
    this.processingFiles.add(filePath);

    this.broadcast({ type: 'file-changed', data: { filePath, operation: item.operation } });

    const previousNote = item.operation === 'upsert'
      ? getIndexedNoteTriggerSnapshot(filePath)
      : null;

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (item.operation === 'upsert') {
          await indexFile(filePath);
          await triggerCognitiveAnalysisAfterIndex({ filePath, previousNote });
        } else {
          await deleteFileRecord(filePath);
        }
        success = true;
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`Index attempt ${attempt}/${MAX_RETRIES} failed for ${filePath}:`, msg);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        }
      }
    }

    if (!success) {
      const err: IndexErrorEventData = {
        filePath,
        operation: item.operation,
        error: `Failed after ${MAX_RETRIES} retries`,
        timestamp: new Date().toISOString(),
      };
      this.errors.push(err);
      if (this.errors.length > MAX_ERRORS) {
        this.errors.shift();
      }
      this.broadcast({ type: 'index-error', data: err });
    }

    this.activeCount--;
    this.processingFiles.delete(filePath);

    // Try to dispatch more items now that a slot freed up
    if (this.queue.size > 0) {
      this.scheduleProcess();
    } else if (this.activeCount === 0) {
      this.broadcast({ type: 'index-queue-complete' });
    }
  }
}
