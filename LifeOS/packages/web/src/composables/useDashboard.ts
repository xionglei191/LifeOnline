import { ref, onMounted, onUnmounted } from 'vue';
import { fetchDashboard } from '../api/client';
import { isIndexRefreshEvent } from './useWebSocket';
import type { DashboardData, WsEvent } from '@lifeos/shared';

export function useDashboard() {
  const data = ref<DashboardData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  let activeRequestId = 0;

  async function load() {
    const requestId = ++activeRequestId;
    loading.value = true;
    error.value = null;
    try {
      const nextData = await fetchDashboard();
      if (requestId !== activeRequestId) return;
      data.value = nextData;
    } catch (e) {
      if (requestId !== activeRequestId) return;
      error.value = e as Error;
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false;
      }
    }
  }

  function handleWsUpdate(event: Event) {
    const customEvent = event as CustomEvent<WsEvent>;
    const wsEvent = customEvent.detail;
    if (isIndexRefreshEvent(wsEvent)) {
      load();
    }
  }

  onMounted(() => {
    document.addEventListener('ws-update', handleWsUpdate);
  });

  onUnmounted(() => {
    document.removeEventListener('ws-update', handleWsUpdate);
  });

  return { data, loading, error, load };
}
