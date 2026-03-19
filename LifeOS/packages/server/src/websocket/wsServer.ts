import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WsEvent } from '@lifeos/shared';

let wss: WebSocketServer | null = null;

async function closeWebSocketServer(server: WebSocketServer): Promise<void> {
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

export function initWebSocket(server: Server) {
  if (wss) {
    throw new Error('WebSocket server already initialized');
  }
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  console.log('WebSocket server initialized');
}

export function broadcastUpdate(event: WsEvent) {
  if (!wss || wss.clients.size === 0) {
    return;
  }
  const message = JSON.stringify(event);
  const clientCount = wss.clients.size;
  console.log(`WebSocket: broadcasting ${event.type} to ${clientCount} client(s)`);
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
