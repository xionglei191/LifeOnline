<template>
  <div class="events-view">
    <!-- ── Hero ── -->
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">认知时序台</p>
        <h2>把系统的<span>认知事件</span>串成一条生命轨迹。</h2>
        <div v-if="!loading && (eventNodes.length || brainstormCount)" class="hero-stats">
          <span class="stat-chip">
            <strong>{{ eventNodes.length }}</strong> 个认知事件
          </span>
          <span class="stat-chip">
            <strong>{{ brainstormCount }}</strong> 次心智风暴
          </span>
        </div>
      </div>
    </section>

    <!-- ── Filters ── -->
    <section class="filter-bar">
      <button
        v-for="kind in eventKindOptions"
        :key="kind.value"
        class="filter-pill"
        :class="{ active: activeKind === kind.value }"
        @click="activeKind = activeKind === kind.value ? null : kind.value"
      >
        {{ kind.label }}
      </button>
    </section>

    <!-- ── States ── -->
    <StateDisplay v-if="loading" type="loading" message="正在加载认知事件..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <StateDisplay v-else-if="!filteredNodes.length" type="empty" message="暂无认知事件，系统处理笔记后会在此展示里程碑、周回顾等大事件。" />

    <!-- ── Timeline ── -->
    <section v-else class="timeline-container">
      <article
        v-for="node in filteredNodes"
        :key="node.id"
        class="event-card"
        :class="{ expanded: expandedIds.has(node.id) }"
        @click="toggleExpand(node.id)"
      >
        <div class="event-spine">
          <div class="spine-dot" :class="`kind-${node.eventKind}`"></div>
          <div class="spine-line"></div>
        </div>

        <div class="event-body">
          <div class="event-head">
            <span class="event-kind-badge" :class="`kind-${node.eventKind}`">
              {{ formatEventKindLabel(node) }}
            </span>
            <time class="event-time">{{ formatDate(node.occurredAt) }}</time>
          </div>

          <h3 class="event-title">{{ node.title }}</h3>
          <p class="event-summary">{{ node.summary }}</p>

          <div v-if="expandedIds.has(node.id)" class="event-detail">
            <div v-if="getExplanation(node)" class="explanation-block">
              <p class="detail-label">推理摘要</p>
              <p class="detail-value">{{ getExplanation(node) }}</p>
            </div>
            <div class="meta-row">
              <span class="meta-pill">阈值: {{ formatEventNodeThresholdLabel(node) }}</span>
              <span class="meta-pill">状态: {{ formatEventNodeStatusLabel(node) }}</span>
              <span v-if="node.sourceNoteId" class="meta-pill">来源: {{ node.sourceNoteId }}</span>
            </div>
          </div>

          <div class="event-footer">
            <span class="expand-hint">{{ expandedIds.has(node.id) ? '收起 ↑' : '展开详情 ↓' }}</span>
            <span v-if="relatedBsCount(node)" class="bs-badge">🧠 {{ relatedBsCount(node) }} 次风暴</span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { EventNode, BrainstormSession, WsEvent } from '@lifeos/shared';
import { formatEventKindLabel, formatEventNodeThresholdLabel, formatEventNodeStatusLabel, getProjectionExplanationSummary } from '@lifeos/shared';
import { fetchEventNodes, fetchBrainstormSessions } from '../api/client';
import StateDisplay from '../components/StateDisplay.vue';

type EventKindFilter = 'weekly_reflection' | 'persona_shift' | 'milestone_report';

const eventNodes = ref<EventNode[]>([]);
const brainstormSessions = ref<BrainstormSession[]>([]);
const loading = ref(false);
const error = ref<Error | null>(null);
const activeKind = ref<EventKindFilter | null>(null);
const expandedIds = ref<Set<string>>(new Set());

const eventKindOptions: Array<{ value: EventKindFilter; label: string }> = [
  { value: 'weekly_reflection', label: '周回顾' },
  { value: 'persona_shift', label: '人格切换' },
  { value: 'milestone_report', label: '里程碑' },
];

const brainstormCount = computed(() => brainstormSessions.value.length);

const filteredNodes = computed(() => {
  const nodes = [...eventNodes.value].sort((a, b) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
  if (!activeKind.value) return nodes;
  return nodes.filter(n => n.eventKind === activeKind.value);
});

function relatedBsCount(node: EventNode): number {
  if (!node.sourceNoteId) return 0;
  return brainstormSessions.value.filter(bs => bs.sourceNoteId === node.sourceNoteId).length;
}

function getExplanation(node: EventNode): string | null {
  const summary = getProjectionExplanationSummary(node);
  return summary?.primaryReason ?? null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    const [nodes, bs] = await Promise.all([
      fetchEventNodes(),
      fetchBrainstormSessions(200),
    ]);
    eventNodes.value = nodes;
    brainstormSessions.value = bs.sessions;
  } catch (e) {
    error.value = e as Error;
  } finally {
    loading.value = false;
  }
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (wsEvent.type === 'event-node-updated') {
    void loadData();
  }
}

onMounted(() => {
  void loadData();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});
</script>

<style scoped>
.events-view {
  display: grid;
  gap: 20px;
  padding: 8px 0 32px;
}

/* ── Hero ── */
.hero-panel {
  padding: 28px 30px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background:
    radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--accent-soft) 80%, transparent), transparent 20%),
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
  margin: 0 0 14px;
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
  font-size: clamp(1.5rem, 1.2rem + 0.8vw, 2.1rem);
  line-height: 1.1;
  font-weight: 650;
}

.hero-copy h2 span { color: var(--accent); }

.hero-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stat-chip {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 80%, transparent);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* ── Filters ── */
.filter-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.filter-pill:hover,
.filter-pill.active {
  background: color-mix(in srgb, var(--accent-soft) 80%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  color: var(--text);
}

/* ── Timeline ── */
.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.event-card {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 0 14px;
  cursor: pointer;
  transition: opacity 0.18s;
}

.event-card:hover { opacity: 0.92; }

.event-spine {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
}

.spine-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2.5px solid var(--border-strong);
  background: var(--surface-strong);
  flex-shrink: 0;
  transition: transform 0.18s;
}

.event-card:hover .spine-dot { transform: scale(1.2); }

.spine-dot.kind-milestone_report { background: var(--signal); border-color: var(--signal); }
.spine-dot.kind-persona_shift { background: var(--warn); border-color: var(--warn); }
.spine-dot.kind-weekly_reflection { background: var(--accent); border-color: var(--accent); }

.spine-line {
  flex: 1;
  width: 2px;
  min-height: 16px;
  background: var(--border);
  margin: 6px 0;
}

.event-card:last-child .spine-line { display: none; }

.event-body {
  padding: 16px 20px 20px;
  margin-bottom: 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  transition: border-color 0.18s, background 0.18s;
}

.event-card.expanded .event-body {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--surface-strong) 88%, transparent);
}

.event-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.event-kind-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  border: 1px solid transparent;
}

.event-kind-badge.kind-milestone_report {
  background: color-mix(in srgb, var(--signal-soft) 80%, transparent);
  color: var(--signal);
  border-color: color-mix(in srgb, var(--signal) 20%, transparent);
}
.event-kind-badge.kind-persona_shift {
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  color: var(--warn);
  border-color: color-mix(in srgb, var(--warn) 20%, transparent);
}
.event-kind-badge.kind-weekly_reflection {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 20%, transparent);
}

.event-time {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.event-title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 650;
  color: var(--text);
  line-height: 1.3;
}

.event-summary {
  margin: 0 0 12px;
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.event-detail {
  padding: 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-muted) 70%, transparent);
  margin-bottom: 10px;
  display: grid;
  gap: 10px;
}

.detail-label {
  margin: 0 0 4px;
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.detail-value {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.meta-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-pill {
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 80%, transparent);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.expand-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.bs-badge {
  font-size: 0.78rem;
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 60%, transparent);
}

@media (max-width: 720px) {
  .hero-panel { padding: 20px; border-radius: 22px; }
  .event-body { padding: 14px; }
}
</style>
