import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import { fetchDashboard, fetchNotes } from '../api/client';
import { parseLocalDate } from '../utils/date';
import { isIndexRefreshEvent } from './useWebSocket';
import type { Note, Dimension, WsEvent } from '@lifeos/shared';

export function doesDimensionNotesNeedRefresh(wsEvent: WsEvent) {
  return isIndexRefreshEvent(wsEvent)
    || wsEvent.type === 'note-updated'
    || wsEvent.type === 'note-created'
    || wsEvent.type === 'note-deleted';
}

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
  let activeStatsRequestId = 0;

  const dimensionStats = ref({ total: 0, pending: 0, inProgress: 0, done: 0, healthScore: 0 });

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

      if (compareValue !== 0) {
        return filters.value.sortOrder === 'desc' ? -compareValue : compareValue;
      }

      const leftLabel = (a.title || a.file_name.replace('.md', '')).toLocaleLowerCase();
      const rightLabel = (b.title || b.file_name.replace('.md', '')).toLocaleLowerCase();
      return leftLabel.localeCompare(rightLabel, 'zh-CN');
    });

    return result;
  });

  const stats = computed(() => dimensionStats.value);

  async function loadStats() {
    const requestId = ++activeStatsRequestId;
    try {
      const dashboard = await fetchDashboard();
      if (requestId !== activeStatsRequestId) return;
      const stat = dashboard.dimensionStats.find((item) => item.dimension === dimension.value);
      dimensionStats.value = stat
        ? {
            total: stat.total,
            pending: stat.pending,
            inProgress: stat.in_progress,
            done: stat.done,
            healthScore: stat.health_score,
          }
        : { total: 0, pending: 0, inProgress: 0, done: 0, healthScore: 0 };
    } catch (e) {
      if (requestId !== activeStatsRequestId) return;
      throw e;
    }
  }

  async function load() {
    const requestId = ++activeRequestId;
    loading.value = true;
    error.value = null;
    try {
      const [nextNotes] = await Promise.all([
        fetchNotes({ dimension: dimension.value }),
        loadStats(),
      ]);
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
    if (doesDimensionNotesNeedRefresh(wsEvent)) load();
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
    dimensionStats.value = { total: 0, pending: 0, inProgress: 0, done: 0, healthScore: 0 };
    load();
  }, { immediate: true });

  return { notes, loading, error, filters, filteredNotes, availableTags, stats, load };
}
