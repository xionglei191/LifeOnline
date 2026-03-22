<template>
  <div class="search-view">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Search Console</p>
        <h2>把分散记录重新聚拢到<span>一条语义线索</span>上。</h2>
        <p v-if="!loading && result" class="hero-summary">
          找到 <strong>{{ result.total }}</strong> 条关于 “<strong>{{ result.query }}</strong>” 的结果。
        </p>
      </div>
    </section>

    <StateDisplay v-if="loading" type="loading" message="正在检索关联记录..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <div v-else-if="result">
      <StateDisplay v-if="result.notes.length === 0" type="empty" message="未找到相关记录，尝试更短的关键词或维度词、标签词。" />
      <NoteList
        v-else
        :notes="result.notes"
        @select-note="handleSelectNote"
      />
    </div>

    <NoteDetail :note-id="selectedNoteId" @close="selectedNoteId = null" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import type { SearchResult } from '@lifeos/shared';
import { searchNotes } from '../api/client';
import NoteList from '../components/NoteList.vue';
import NoteDetail from '../components/NoteDetail.vue';
import StateDisplay from '../components/StateDisplay.vue';

const route = useRoute();

const result = ref<SearchResult | null>(null);
const loading = ref(false);
const error = ref<Error | null>(null);
const selectedNoteId = ref<string | null>(null);

async function performSearch(query: string) {
  if (!query) {
    result.value = null;
    error.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    result.value = await searchNotes(query);
  } catch (e) {
    error.value = e as Error;
  } finally {
    loading.value = false;
  }
}

function handleSelectNote(noteId: string) {
  selectedNoteId.value = noteId;
}

async function handleDeleted() {
  selectedNoteId.value = null;
  const query = route.query.q as string;
  if (query) {
    await performSearch(query);
  }
}

watch(() => route.query.q, (newQuery) => {
  performSearch(typeof newQuery === 'string' ? newQuery : '');
}, { immediate: true });

onMounted(() => {
  const query = route.query.q;
  performSearch(typeof query === 'string' ? query : '');
});
</script>

<style scoped>
.search-view {
  display: grid;
  gap: 20px;
  padding: 8px 0 32px;
}

.hero-panel {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background:
    radial-gradient(circle at 84% 18%, color-mix(in srgb, var(--signal-soft) 76%, transparent), transparent 18%),
    color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero-copy h2 {
  margin: 0;
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
  font-size: clamp(1.52rem, 1.3rem + 0.82vw, 2.08rem);
  line-height: 1.1;
  font-weight: 650;
}

.hero-copy h2 span {
  color: var(--signal);
}

.hero-summary {
  margin: 12px 0 0;
  color: var(--text-secondary);
  line-height: 1.8;
}

@media (max-width: 720px) {
  .hero-panel {
    padding: 20px;
    border-radius: 24px;
  }
}
</style>
