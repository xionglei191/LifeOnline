import { ref, onMounted, onUnmounted } from 'vue';
import { fetchTimeline } from '../api/client';
import type { TimelineData } from '@lifeos/shared';

export function useTimeline() {
  const data = ref<TimelineData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  let currentStart = '';
  let currentEnd = '';

  async function load(start: string, end: string) {
    currentStart = start;
    currentEnd = end;
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetchTimeline(start, end);
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  function handleWsUpdate(event: Event) {
    const customEvent = event as CustomEvent;
    const wsEvent = customEvent.detail;
    if ((wsEvent.type === 'file-changed' || wsEvent.type === 'index-complete') && currentStart && currentEnd) {
      load(currentStart, currentEnd);
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
