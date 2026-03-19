import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export type WsEventType = 'file-changed' | 'index-complete' | 'index-error' | 'worker-task-updated' | 'schedule-updated';

export interface WsEvent {
  type: WsEventType;
  data?: any;
}

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server) {
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
  if (!wss) {
    console.log('WebSocket: cannot broadcast, wss not initialized');
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
