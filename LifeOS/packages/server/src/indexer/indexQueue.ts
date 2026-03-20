import { indexFile, deleteFileRecord } from './indexer.js';
import { getIndexedNoteTriggerSnapshot, triggerPersonaSnapshotAfterIndex } from '../soul/postIndexPersonaTrigger.js';
import type { WsEvent, IndexOperation, IndexErrorEventData } from '@lifeos/shared';

interface QueueItem {
  filePath: string;
  operation: IndexOperation;
}


const MAX_ERRORS = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const DEBOUNCE_MS = 300;

export class IndexQueue {
  private queue = new Map<string, QueueItem>();
  private processing = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private errors: IndexErrorEventData[] = [];
  private processingFile: string | null = null;
  private broadcast: (event: WsEvent) => void;

  constructor(broadcast: (event: WsEvent) => void) {
    this.broadcast = broadcast;
  }

  enqueue(filePath: string, operation: IndexOperation) {
    this.queue.set(filePath, { filePath, operation });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.processQueue(), DEBOUNCE_MS);
  }

  getStatus() {
    return {
      queueSize: this.queue.size,
      processing: this.processing,
      processingFile: this.processingFile,
    };
  }

  getErrors() {
    return this.errors;
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.size > 0) {
      const [filePath, item] = this.queue.entries().next().value!;
      this.queue.delete(filePath);
      this.processingFile = filePath;

      this.broadcast({ type: 'file-changed', data: { filePath, operation: item.operation } });

      const previousNote = item.operation === 'upsert'
        ? getIndexedNoteTriggerSnapshot(filePath)
        : null;
      let success = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (item.operation === 'upsert') {
            await indexFile(filePath);
            await triggerPersonaSnapshotAfterIndex({ filePath, previousNote });
          } else {
            await deleteFileRecord(filePath);
          }
          success = true;
          break;
        } catch (e: any) {
          console.error(`Index attempt ${attempt}/${MAX_RETRIES} failed for ${filePath}:`, e.message);
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
    }

    this.processingFile = null;
    this.processing = false;
    this.broadcast({ type: 'index-queue-complete' });
  }
}
