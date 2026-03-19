import { ref, onUnmounted } from 'vue';
import type { WsEvent } from '@lifeos/shared';

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

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    isConnected.value = true;
    reconnectDelay = 1000;
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const wsEvent: WsEvent = JSON.parse(event.data);
      document.dispatchEvent(new CustomEvent('ws-update', { detail: wsEvent }));
    } catch (e) {
      console.error('Failed to parse WS message:', e);
    }
  };

  ws.onclose = () => {
    isConnected.value = false;
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after onerror
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

export function initWebSocket() {
  if (initialized) return;
  initialized = true;
  connect();
}

export function useWebSocket() {
  return { isConnected };
}
