import { ref } from 'vue';
import type { WsEvent } from '@lifeos/shared';

export function isIndexRefreshEvent(wsEvent: WsEvent) {
  return wsEvent.type === 'file-changed' || wsEvent.type === 'index-complete' || wsEvent.type === 'index-queue-complete';
}

export function isIndexSettledEvent(wsEvent: WsEvent) {
  return wsEvent.type === 'index-complete' || wsEvent.type === 'index-queue-complete' || wsEvent.type === 'index-error';
}

const isConnected = ref(false);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 10000;
let initialized = false;

function getWsUrl() {
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${loc.host}/ws`;
}

// ── Client-side heartbeat ──────────────────────────────────
// Fire before the server's 30s window so we can detect zombie connections first.
const CLIENT_PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 5_000;

let pingTimer: ReturnType<typeof setInterval> | null = null;
let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let awaitingPong = false;

function handlePong() {
  awaitingPong = false;
  if (pongTimeoutTimer) {
    clearTimeout(pongTimeoutTimer);
    pongTimeoutTimer = null;
  }
}

function startClientPing() {
  stopClientPing();
  pingTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    awaitingPong = true;
    ws.send(JSON.stringify({ type: 'ping' }));
    pongTimeoutTimer = setTimeout(() => {
      if (awaitingPong) {
        console.warn('WebSocket pong timeout — closing connection to trigger reconnect');
        ws?.close();
      }
    }, PONG_TIMEOUT_MS);
  }, CLIENT_PING_INTERVAL_MS);
}

function stopClientPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (pongTimeoutTimer) { clearTimeout(pongTimeoutTimer); pongTimeoutTimer = null; }
  awaitingPong = false;
}

// ── Connection ─────────────────────────────────────────────
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    isConnected.value = true;
    reconnectDelay = 1000;
    console.log('WebSocket connected');
    startClientPing();
  };

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      // Server replied to our ping
      if (parsed?.type === 'pong') {
        handlePong();
        return;
      }
      const wsEvent = parsed as WsEvent;
      document.dispatchEvent(new CustomEvent('ws-update', { detail: wsEvent }));
    } catch (e) {
      console.error('Failed to parse WS message:', e);
    }
  };

  ws.onclose = () => {
    isConnected.value = false;
    stopClientPing();
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after onerror
  };
}

// ── Public API ─────────────────────────────────────────────
export function initWebSocket() {
  if (initialized) return;
  initialized = true;
  connect();
}

export function useWebSocket() {
  return { isConnected };
}
