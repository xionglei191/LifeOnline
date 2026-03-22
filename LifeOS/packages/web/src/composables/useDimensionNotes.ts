import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import { fetchNotes } from '../api/client';
import { parseLocalDate } from '../utils/date';
import { isIndexRefreshEvent } from './useWebSocket';
import type { Note, Dimension, WsEvent } from '@lifeos/shared';

interface Filters {
  types: string[];
  statuses: string[];
  priorities: string[];
  sortBy: 'date' | 'priority';
  sortOrder: 'asc' | 'desc';
  dateFrom: string;
  dateTo: string;
  tags: string[];
  keyword: string;
}

export function useDimensionNotes(dimension: Ref<Dimension>) {
  const notes = ref<Note[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  let activeRequestId = 0;

  const filters = ref<Filters>({
    types: [],
    statuses: [],
    priorities: [],
    sortBy: 'date',
    sortOrder: 'desc',
    dateFrom: '',
    dateTo: '',
    tags: [],
    keyword: '',
  });

  // All tags available in current dimension
  const availableTags = computed(() => {
    const tagSet = new Set<string>();
    notes.value.forEach(n => n.tags?.forEach(t => tagSet.add(t)));
    return [...tagSet].sort();
  });

  const filteredNotes = computed(() => {
    let result = [...notes.value];

    if (filters.value.types.length > 0)
      result = result.filter(n => filters.value.types.includes(n.type));

    if (filters.value.statuses.length > 0)
      result = result.filter(n => filters.value.statuses.includes(n.status));

    if (filters.value.priorities.length > 0)
      result = result.filter(n => n.priority && filters.value.priorities.includes(n.priority));

    if (filters.value.dateFrom)
      result = result.filter(n => n.date >= filters.value.dateFrom);

    if (filters.value.dateTo)
      result = result.filter(n => n.date <= filters.value.dateTo);

    if (filters.value.tags.length > 0)
      result = result.filter(n => filters.value.tags.every(t => n.tags?.includes(t)));

    if (filters.value.keyword) {
      const kw = filters.value.keyword.toLowerCase();
      result = result.filter(n =>
        n.title?.toLowerCase().includes(kw) ||
        n.file_name.toLowerCase().includes(kw) ||
        n.content?.toLowerCase().includes(kw)
      );
    }

    result.sort((a, b) => {
      let compareValue = 0;
      if (filters.value.sortBy === 'date') {
        compareValue = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      } else if (filters.value.sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] : 0;
        const bPriority = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] : 0;
        compareValue = bPriority - aPriority;
      }
      return filters.value.sortOrder === 'desc' ? -compareValue : compareValue;
    });

    return result;
  });

  const stats = computed(() => {
    const total = notes.value.length;
    const pending = notes.value.filter(n => n.status === 'pending').length;
    const inProgress = notes.value.filter(n => n.status === 'in_progress').length;
    const done = notes.value.filter(n => n.status === 'done').length;
    return { total, pending, inProgress, done };
  });

  async function load() {
    const requestId = ++activeRequestId;
    loading.value = true;
    error.value = null;
    try {
      const nextNotes = await fetchNotes({ dimension: dimension.value });
      if (requestId !== activeRequestId) return;
      notes.value = nextNotes;
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
    if (isIndexRefreshEvent(wsEvent)) load();
  }

  onMounted(() => {
    document.addEventListener('ws-update', handleWsUpdate);
  });

  onUnmounted(() => {
    document.removeEventListener('ws-update', handleWsUpdate);
  });

  watch(dimension, () => {
    filters.value = {
      types: [],
      statuses: [],
      priorities: [],
      sortBy: 'date',
      sortOrder: 'desc',
      dateFrom: '',
      dateTo: '',
      tags: [],
      keyword: '',
    };
    notes.value = [];
    load();
  }, { immediate: true });

  return { notes, loading, error, filters, filteredNotes, availableTags, stats, load };
}
