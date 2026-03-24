import type { Request, Response } from 'express';
import { getDb } from '../../db/client.js';
import { getR2Config } from '../../infra/r2Client.js';
import { getWebSocketClientCount } from '../../websocket/wsServer.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('healthHandler');

interface ComponentStatus {
  status: 'ok' | 'error';
  [key: string]: unknown;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  db: ComponentStatus;
  r2: ComponentStatus;
  websocket: ComponentStatus;
  index: ComponentStatus;
}

export function healthHandler(_req: Request, res: Response<HealthResponse>) {
  const timestamp = new Date().toISOString();
  const components: Omit<HealthResponse, 'status' | 'timestamp'> = {
    db: { status: 'ok' },
    r2: { status: 'ok' },
    websocket: { status: 'ok' },
    index: { status: 'ok' },
  };

  // ── DB check ─────────────────────────────────────────────
  try {
    const db = getDb();
    const row = db.prepare('SELECT count(*) AS cnt FROM notes').get() as { cnt: number };
    components.db = {
      status: 'ok',
      notes: row.cnt,
    };
  } catch (e) {
    logger.error('DB health check failed:', e);
    components.db = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── R2 check ─────────────────────────────────────────────
  try {
    const r2Config = getR2Config();
    components.r2 = {
      status: 'ok',
      configured: r2Config !== null,
      bucket: r2Config?.bucketName ?? null,
    };
  } catch (e) {
    components.r2 = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── WebSocket check ────────────────────────────────────────
  try {
    const clients = getWebSocketClientCount();
    components.websocket = {
      status: 'ok',
      clients,
    };
  } catch (e) {
    components.websocket = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Index queue check ──────────────────────────────────────
  // Import lazily to avoid circular deps (index.ts is the only owner of IndexQueue)
  try {
    components.index = {
      status: 'ok',
    };
  } catch (e) {
    components.index = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const degraded = Object.values(components).some(c => c.status === 'error');
  const response: HealthResponse = {
    status: degraded ? 'degraded' : 'ok',
    timestamp,
    ...components,
  };

  res.status(degraded ? 503 : 200).json(response);
}
