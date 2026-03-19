import { ref, onMounted, onUnmounted } from 'vue';
import { fetchDashboard } from '../api/client';
import type { DashboardData, WsEvent } from '@lifeos/shared';

export function useDashboard() {
  const data = ref<DashboardData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetchDashboard();
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  function handleWsUpdate(event: Event) {
    const customEvent = event as CustomEvent<WsEvent>;
    const wsEvent = customEvent.detail;
    if (wsEvent.type === 'file-changed' || wsEvent.type === 'index-complete') {
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
