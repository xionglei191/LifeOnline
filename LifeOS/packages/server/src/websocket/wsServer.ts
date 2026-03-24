import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WsEvent } from '@lifeos/shared';
import { Logger } from '../utils/logger.js';

const logger = new Logger('wsServer');

// Heartbeat configuration
const PING_INTERVAL_MS = 30_000; // 30s
const PONG_TIMEOUT_MS = 5_000;   // terminate if no pong within 5s

/* We extend WebSocket so TypeScript knows about our custom properties. */
interface ExtendedWs extends WebSocket {
  isAlive: boolean;
  pingTimer: ReturnType<typeof setTimeout> | null;
}

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// ── Heartbeat helpers ──────────────────────────────────────

function startHeartbeat(wsServer: WebSocketServer) {
  // Broadcast a ping to all connected clients every PING_INTERVAL_MS.
  // If a client hasn't responded with a pong before the next round, terminate it.
  heartbeatInterval = setInterval(() => {
    wsServer.clients.forEach((rawClient) => {
      const client = rawClient as ExtendedWs;
      if (client.isAlive === false) {
        logger.warn('WebSocket client did not respond to ping — terminating');
        client.terminate();
        return;
      }
      // Mark as dead; will be revived when pong arrives
      client.isAlive = false;
      client.ping();
    });
  }, PING_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ── Internal helpers ───────────────────────────────────────

async function closeWebSocketServer(server: WebSocketServer): Promise<void> {
  stopHeartbeat();

  const clients = Array.from(server.clients);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close();
    }
  }

  await Promise.all(clients.map((client) => new Promise<void>((resolve) => {
    if (client.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      client.terminate();
    }, 1000);

    client.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  })));

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

// ── Public API ─────────────────────────────────────────────

export function initWebSocket(server: Server) {
  if (wss) {
    throw new Error('WebSocket server already initialized');
  }
  wss = new WebSocketServer({ server, path: '/ws' });

  startHeartbeat(wss);

  wss.on('connection', (rawWs) => {
    const ws = rawWs as ExtendedWs;
    ws.isAlive = true;
    ws.pingTimer = null;

    // Mark alive on pong
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle ping from client (send pong back automatically by ws library,
    // but we also track them for logging)
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Not JSON or unknown message — ignore
      }
    });

    logger.info('WebSocket client connected');
    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });

  logger.info('WebSocket server initialized (heartbeat: 30s)');
}

export function getWebSocketClientCount(): number {
  return wss ? wss.clients.size : 0;
}

export function broadcastUpdate(event: WsEvent) {
  if (!wss || wss.clients.size === 0) {
    return;
  }
  const message = JSON.stringify(event);
  const clientCount = wss.clients.size;
  logger.info(`broadcasting ${event.type} to ${clientCount} client(s)`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export async function closeWebSocket(): Promise<void> {
  if (!wss) return;

  const server = wss;
  wss = null;

  await closeWebSocketServer(server);
}
