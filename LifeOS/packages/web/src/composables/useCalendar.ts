import { ref, onMounted, onUnmounted } from 'vue';
import { fetchCalendar } from '../api/client';
import type { CalendarData } from '@lifeos/shared';

export function useCalendar() {
  const data = ref<CalendarData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const selectedDay = ref<string | null>(null);
  let currentYear = 0;
  let currentMonth = 0;

  async function load(year: number, month: number) {
    currentYear = year;
    currentMonth = month;
    loading.value = true;
    error.value = null;
    selectedDay.value = null;
    try {
      data.value = await fetchCalendar(year, month);
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  function handleWsUpdate(event: Event) {
    const customEvent = event as CustomEvent;
    const wsEvent = customEvent.detail;
    if ((wsEvent.type === 'file-changed' || wsEvent.type === 'index-complete') && currentYear && currentMonth) {
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
