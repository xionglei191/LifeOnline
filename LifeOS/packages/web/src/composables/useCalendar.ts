import { ref, onMounted, onUnmounted } from 'vue';
import { fetchCalendar } from '../api/client';
import { isIndexRefreshEvent } from './useWebSocket';
import type { CalendarData, WsEvent } from '@lifeos/shared';

export function doesCalendarNeedRefresh(wsEvent: WsEvent) {
  return isIndexRefreshEvent(wsEvent)
    || wsEvent.type === 'note-updated'
    || wsEvent.type === 'note-created'
    || wsEvent.type === 'note-deleted';
}

export function useCalendar() {
  const data = ref<CalendarData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const selectedDay = ref<string | null>(null);
  let currentYear = 0;
  let currentMonth = 0;
  let activeRequestId = 0;

  async function load(year: number, month: number) {
    currentYear = year;
    currentMonth = month;
    const requestId = ++activeRequestId;
    loading.value = true;
    error.value = null;
    selectedDay.value = null;
    try {
      const nextData = await fetchCalendar(year, month);
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
    if (doesCalendarNeedRefresh(wsEvent) && currentYear && currentMonth) {
      load(currentYear, currentMonth);
    }
  }

  onMounted(() => {
    document.addEventListener('ws-update', handleWsUpdate);
  });

  onUnmounted(() => {
    document.removeEventListener('ws-update', handleWsUpdate);
  });

  return { data, loading, error, selectedDay, load };
}
