import { ref, onMounted, onUnmounted } from 'vue';
import { fetchTimeline } from '../api/client';
import { isIndexRefreshEvent } from './useWebSocket';
import type { TimelineData, WsEvent } from '@lifeos/shared';

export function doesTimelineNeedRefresh(wsEvent: WsEvent) {
  return isIndexRefreshEvent(wsEvent)
    || wsEvent.type === 'note-updated'
    || wsEvent.type === 'note-created'
    || wsEvent.type === 'note-deleted';
}

export function useTimeline() {
  const data = ref<TimelineData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  let currentStart = '';
  let currentEnd = '';
  let activeRequestId = 0;

  async function load(start: string, end: string) {
    currentStart = start;
    currentEnd = end;
    const requestId = ++activeRequestId;
    loading.value = true;
    error.value = null;
    try {
      const nextData = await fetchTimeline(start, end);
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
    const wsEvent = (event as CustomEvent<WsEvent>).detail;
    if (doesTimelineNeedRefresh(wsEvent) && currentStart && currentEnd) {
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
