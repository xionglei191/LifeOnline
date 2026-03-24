<template>
  <div class="search-view">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">语义检索台</p>
        <h2>把分散记录重新聚拢到<span>一条语义线索</span>上。</h2>
        <p v-if="!loading && result" class="hero-summary">
          找到 <strong>{{ result.total }}</strong> 条关于 "<strong>{{ result.filters.q }}</strong>" 的结果。
          <template v-if="matchedSessions.length">
            · 关联 <strong>{{ matchedSessions.length }}</strong> 次认知风暴。
          </template>
        </p>
      </div>
    </section>

    <StateDisplay v-if="loading" type="loading" message="正在检索关联记录..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <div v-else-if="result">
      <StateDisplay v-if="result.notes.length === 0 && !matchedSessions.length" type="empty" message="未找到相关记录，尝试更短的关键词或维度词、标签词。" />

      <!-- 笔记结果 -->
      <NoteList
        v-if="result.notes.length"
        :notes="result.notes"
        @select-note="handleSelectNote"
      />

      <!-- 认知洞察卡片区 -->
      <section v-if="matchedSessions.length" class="cognitive-section">
        <div class="section-head">
          <h3 class="section-title">🧠 相关认知洞察</h3>
          <span class="section-hint">系统基于相关笔记的心智提炼</span>
        </div>

        <div class="bs-grid">
          <article
            v-for="bs in matchedSessions"
            :key="bs.id"
            class="bs-card"
            :class="{ expanded: expandedBs.has(bs.id) }"
            @click="toggleBs(bs.id)"
          >
            <div class="bs-head">
              <div class="bs-meta">
                <span class="bs-status" :class="`status-${bs.status}`">{{ bs.status }}</span>
                <span class="bs-tone" v-if="bs.emotionalTone">{{ bs.emotionalTone }}</span>
              </div>
              <time class="bs-time">{{ formatBsDate(bs.createdAt) }}</time>
            </div>

            <div class="bs-themes">
              <span v-for="theme in bs.themes.slice(0, 4)" :key="theme" class="theme-tag">{{ theme }}</span>
            </div>

            <div v-if="bs.distilledInsights?.length" class="bs-insights" :class="{ collapsed: !expandedBs.has(bs.id) }">
              <p class="insight-label">核心洞察</p>
              <ul class="insight-list">
                <li v-for="(insight, i) in bs.distilledInsights" :key="i">{{ insight }}</li>
              </ul>
            </div>

            <div class="bs-footer">
              <span class="expand-hint">{{ expandedBs.has(bs.id) ? '收起 ↑' : '查看洞察 ↓' }}</span>
              <span v-if="bs.sourceNoteId" class="bs-source">来自 {{ bs.sourceNoteId }}</span>
            </div>
          </article>
        </div>
      </section>
    </div>

    <NoteDetail :note-id="selectedNoteId" @close="selectedNoteId = null" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import type { SearchResult, WsEvent, BrainstormSession } from '@lifeos/shared';
import { searchNotes, fetchBrainstormSessions } from '../api/client';
import { isIndexRefreshEvent } from '../composables/useWebSocket';
import NoteList from '../components/NoteList.vue';
import NoteDetail from '../components/NoteDetail.vue';
import StateDisplay from '../components/StateDisplay.vue';

const route = useRoute();

const result = ref<SearchResult | null>(null);
const loading = ref(false);
const error = ref<Error | null>(null);
const selectedNoteId = ref<string | null>(null);
let activeRequestId = 0;

// BrainstormSession state
const allSessions = ref<BrainstormSession[]>([]);
const expandedBs = ref<Set<string>>(new Set());

const matchedSessions = computed(() => {
  const q = (route.query.q as string || '').toLowerCase().trim();
  if (!q || !allSessions.value.length) return [];
  return allSessions.value.filter(bs => {
    const themesMatch = bs.themes.some(t => t.toLowerCase().includes(q));
    const previewMatch = bs.rawInputPreview?.toLowerCase().includes(q) ?? false;
    const insightMatch = bs.distilledInsights?.some(i => i.toLowerCase().includes(q)) ?? false;
    return themesMatch || previewMatch || insightMatch;
  });
});

function toggleBs(id: string) {
  const next = new Set(expandedBs.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedBs.value = next;
}

function formatBsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

async function loadSessions() {
  try {
    const data = await fetchBrainstormSessions(200);
    allSessions.value = data.sessions;
  } catch {
    // Non-critical: ignore session fetch failures
  }
}

async function performSearch(query: string) {
  const requestId = ++activeRequestId;
  if (!query) {
    result.value = null;
    error.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const nextResult = await searchNotes(query);
    if (requestId !== activeRequestId) return;
    result.value = nextResult;
  } catch (e) {
    if (requestId !== activeRequestId) return;
    error.value = e as Error;
  } finally {
    if (requestId === activeRequestId) {
      loading.value = false;
    }
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

function doesSearchNeedRefresh(wsEvent: WsEvent) {
  return isIndexRefreshEvent(wsEvent)
    || wsEvent.type === 'note-updated'
    || wsEvent.type === 'note-created'
    || wsEvent.type === 'note-deleted';
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  const query = route.query.q;
  if ((wsEvent.type as string) === 'brainstorm-session-updated') {
    void loadSessions();
  }
  if (!doesSearchNeedRefresh(wsEvent) || typeof query !== 'string' || !query) {
    return;
  }
  void performSearch(query);
}

watch(() => route.query.q, (newQuery, oldQuery) => {
  if (newQuery !== oldQuery) {
    selectedNoteId.value = null;
  }
  performSearch(typeof newQuery === 'string' ? newQuery : '');
}, { immediate: true });

onMounted(() => {
  document.addEventListener('ws-update', handleWsUpdate);
  void loadSessions();
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
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

/* ── Cognitive section ── */
.cognitive-section {
  margin-top: 8px;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  color: var(--text);
}

.section-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.bs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.bs-card {
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}

.bs-card:hover,
.bs-card.expanded {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--surface-strong) 88%, transparent);
}

.bs-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.bs-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.bs-status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  border: 1px solid transparent;
}

.bs-status.status-distilled {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
}

.bs-status.status-analyzed {
  background: color-mix(in srgb, var(--signal-soft) 70%, transparent);
  color: var(--signal);
}

.bs-status.status-seeding {
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  color: var(--warn);
}

.bs-tone {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-style: italic;
}

.bs-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.bs-themes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.theme-tag {
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 80%, transparent);
  border: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.bs-insights {
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 4px;
  margin-bottom: 8px;
}

.bs-insights.collapsed {
  display: none;
}

.insight-label {
  margin: 0 0 6px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.insight-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}

.insight-list li {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.bs-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.expand-hint {
  font-size: 0.76rem;
  color: var(--text-muted);
}

.bs-source {
  font-size: 0.73rem;
  color: var(--text-muted);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .hero-panel {
    padding: 20px;
    border-radius: 24px;
  }
  .bs-grid {
    grid-template-columns: 1fr;
  }
}
</style>
