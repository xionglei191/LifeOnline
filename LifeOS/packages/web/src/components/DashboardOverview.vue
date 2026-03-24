<template>
  <div class="dashboard">
    <StateDisplay v-if="loading" type="loading" message="正在同步生命信号..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <div v-else-if="data" class="dashboard-layout">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">生命信号 / 今日聚焦</p>
          <h2>今天的重点不是做更多，而是把生命资源投向<span>正确的轨道</span>。</h2>
          <p class="hero-summary">
            当前共有 {{ totalOpenItems }} 项活跃事项，已完成率 {{ completionRate }}%，
            {{ topAttentionDimensionLabel }} 是当前最需要投入的维度。
          </p>
        </div>

        <div class="hero-metrics">
          <article class="metric-tile accent">
            <span class="metric-label">今日待办</span>
            <strong>{{ data.todayTodos.length }}</strong>
            <span class="metric-meta">需要你立即处理的任务队列</span>
          </article>
          <article class="metric-tile">
            <span class="metric-label">平均完成率</span>
            <strong>{{ averageHealth }}%</strong>
            <span class="metric-meta">{{ averageHealthMeta }}</span>
          </article>
          <article class="metric-tile">
            <span class="metric-label">本周重点</span>
            <strong>{{ data.weeklyHighlights.length }}</strong>
            <span class="metric-meta">持续追踪的高权重事项</span>
          </article>
          <article class="metric-tile">
            <span class="metric-label">最高积压维度</span>
            <strong>{{ topBacklogDimensionLabel }}</strong>
            <span class="metric-meta">当前待处理工作最多的维度</span>
          </article>
        </div>

        <div class="signal-band">
          <div
            v-for="stat in rankedStats.slice(0, 4)"
            :key="stat.dimension"
            class="signal-chip"
            :style="{ '--dimension-color': getDimensionColor(stat.dimension) }"
          >
            <div class="signal-chip-head">
              <span class="signal-name">{{ getDimensionLabel(stat.dimension) }}</span>
              <span class="signal-score">完成率 {{ stat.health_score }}%</span>
            </div>
            <span class="signal-track">
              <span class="signal-fill" :style="{ width: `${stat.health_score}%` }"></span>
            </span>
            <span class="signal-meta">活跃 {{ stat.pending + stat.in_progress }} 项 · 完成 {{ stat.done }}/{{ stat.total }}</span>
          </div>
        </div>
      </section>

      <!-- ── Shortcuts ── -->
      <section class="shortcuts-panel">
        <button class="shortcut-btn" @click="$router.push('/inbox')">
          <span class="sc-icon">📥</span>
          <span class="sc-label">Inbox</span>
        </button>
        <button class="shortcut-btn" @click="$router.push('/calendar')">
          <span class="sc-icon">📅</span>
          <span class="sc-label">全景日历</span>
        </button>
        <button class="shortcut-btn" @click="$router.push('/governance')">
          <span class="sc-icon">⚖️</span>
          <span class="sc-label">治理中心</span>
        </button>
        <button class="shortcut-btn" @click="$router.push('/ops')">
          <span class="sc-icon">⚙️</span>
          <span class="sc-label">运行时控制</span>
        </button>
      </section>

      <section v-if="data.inboxCount > 0" class="inbox-banner" @click="$router.push('/inbox')">
        <span class="inbox-icon">📥</span>
        <span class="inbox-text">_Inbox 中有 <strong>{{ data.inboxCount }}</strong> 条待整理笔记</span>
        <span class="inbox-action">前往整理 →</span>
      </section>

      <section v-if="scheduleHealth" class="schedule-health-banner" :class="{ warning: scheduleHealth.failing > 0 }">
        <span class="sh-icon">{{ scheduleHealth.failing > 0 ? '⚠️' : '⏱️' }}</span>
        <span class="sh-text">
          定时任务：<strong>{{ scheduleHealth.active }}</strong> 个活跃
          <template v-if="scheduleHealth.failing > 0">
            / <strong class="sh-failing">{{ scheduleHealth.failing }}</strong> 个异常
          </template>
        </span>
        <span v-if="scheduleHealth.failing > 0" class="sh-detail">
          {{ scheduleHealth.failingSchedules.map((s: any) => s.label).join('、') }}
        </span>
        <span class="sh-action" @click="$router.push('/settings')">前往设置 →</span>
      </section>
      <StateDisplay
        v-else-if="scheduleHealthError"
        type="error"
        :message="`定时任务健康状态加载失败：${scheduleHealthError.message}`"
      />

      <!-- ── Cognitive Overview ── -->
      <section class="cognitive-grid">
        <!-- Persona Card -->
        <article class="persona-card settings-card">
          <div class="card-head">
            <h3>🎭 人格状态 (Persona)</h3>
          </div>
          <div v-if="loadingCognitive && !latestPersonaSnapshot" class="empty-state">同步脉络中...</div>
          <div v-else-if="latestPersonaSnapshot" class="persona-content">
            <p class="persona-summary">{{ latestPersonaSnapshot.summary }}</p>
            <div class="persona-meta">
              <span class="meta-pill">基于: {{ latestPersonaSnapshot.snapshot.sourceNoteTitle }}</span>
              <span class="meta-pill">更新于: {{ new Date(latestPersonaSnapshot.updatedAt).toLocaleDateString() }}</span>
            </div>
            <p class="persona-preview">{{ latestPersonaSnapshot.snapshot.contentPreview }}</p>
          </div>
          <div v-else class="empty-state">
            暂无人格快照，请在运维中心触发 update_persona_snapshot。
          </div>
        </article>

        <!-- Recent Actions -->
        <article class="recent-actions-card settings-card">
          <div class="card-head">
            <h3>🧠 最近认知活动 (SoulActions)</h3>
            <button class="btn-link" @click="$router.push('/governance')">查看全部</button>
          </div>
          <div v-if="loadingCognitive && !recentSoulActions.length" class="empty-state">同步脉络中...</div>
          <div v-else-if="recentSoulActions.length > 0" class="actions-list">
            <router-link
              v-for="action in recentSoulActions"
              :key="action.id"
              :to="`/governance/soul-action/${action.id}`"
              class="action-item"
            >
              <div class="action-item-top">
                <span class="action-kind-badge">{{ formatSoulActionKindLabel(action.actionKind) }}</span>
                <span class="action-time">{{ new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
              <div class="action-item-meta">
                <span>治理: {{ action.governanceStatus }}</span>
                <span>执行: {{ action.executionStatus }}</span>
              </div>
            </router-link>
          </div>
          <div v-else class="empty-state">
            暂无最近系统自主行为记录。
          </div>
        </article>
      </section>

      <section class="mission-grid">
        <div class="mission-column">
          <TodayTodos :todos="data.todayTodos" @selectNote="selectedNoteId = $event" />
          <WeeklyHighlights :highlights="data.weeklyHighlights" @selectNote="selectedNoteId = $event" />
        </div>

        <div class="signal-column">
          <DimensionHealth :stats="data.dimensionStats" />
          <AISuggestions />
        </div>
      </section>

      <NoteDetail :noteId="selectedNoteId" @close="selectedNoteId = null" @deleted="handleDeleted" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useDashboard, doesDashboardNeedRefresh } from '../composables/useDashboard';
import { fetchScheduleHealth } from '../api/client';
import type { ScheduleHealth } from '@lifeos/shared';
import { getDimensionColor, getDimensionLabel } from '../utils/dimensions';
import { fetchSoulActionList, fetchWorkerTasks, fetchPersonaSnapshot } from '../api/client';
import type { WsEvent, SoulAction, PersonaSnapshot } from '@lifeos/shared';
import { formatSoulActionKindLabel } from '@lifeos/shared';
import TodayTodos from './TodayTodos.vue';
import WeeklyHighlights from './WeeklyHighlights.vue';
import DimensionHealth from './DimensionHealth.vue';
import AISuggestions from './AISuggestions.vue';
import NoteDetail from './NoteDetail.vue';
import StateDisplay from './StateDisplay.vue';

const { data, loading, error, load } = useDashboard();
const recentSoulActions = ref<SoulAction[]>([]);
const latestPersonaSnapshot = ref<PersonaSnapshot | null>(null);
const loadingCognitive = ref(false);

const selectedNoteId = ref<string | null>(null);
const scheduleHealth = ref<ScheduleHealth | null>(null);
const scheduleHealthError = ref<Error | null>(null);
let activeScheduleHealthRequestId = 0;

const dashboardDimensionStats = computed(() => {
  return (data.value?.dimensionStats ?? []).filter((item) => item.dimension !== '_inbox');
});

const attentionRankedStats = computed(() => {
  return [...dashboardDimensionStats.value]
    .sort((left, right) => (right.pending + right.in_progress) - (left.pending + left.in_progress));
});

const rankedStats = computed(() => {
  return [...dashboardDimensionStats.value].sort((a, b) => b.health_score - a.health_score);
});

const averageHealth = computed(() => {
  const stats = dashboardDimensionStats.value;
  if (!stats.length) return 0;
  return Math.round(stats.reduce((sum, item) => sum + item.health_score, 0) / stats.length);
});

const averageHealthMeta = computed(() => {
  return `当前 ${dashboardDimensionStats.value.length} 个维度的平均完成进度`;
});

const totalOpenItems = computed(() => {
  const stats = dashboardDimensionStats.value;
  return stats.reduce((sum, item) => sum + item.pending + item.in_progress, 0);
});

const completionRate = computed(() => {
  const stats = dashboardDimensionStats.value;
  const done = stats.reduce((sum, item) => sum + item.done, 0);
  const total = stats.reduce((sum, item) => sum + item.total, 0);
  return total ? Math.round((done / total) * 100) : 0;
});

const topAttentionDimensionLabel = computed(() => {
  if (!attentionRankedStats.value.length) return '系统整体';
  return getDimensionLabel(attentionRankedStats.value[0].dimension);
});

const topBacklogDimensionLabel = computed(() => {
  if (!attentionRankedStats.value.length) return '无';
  return getDimensionLabel(attentionRankedStats.value[0].dimension);
});

async function handleRefresh() {
  await Promise.all([
    load(),
    loadScheduleHealth(),
    loadCognitiveData(),
  ]);
}

async function handleDeleted() {
  selectedNoteId.value = null;
  await handleRefresh();
}

async function loadCognitiveData() {
  loadingCognitive.value = true;
  try {
    const actionList = await fetchSoulActionList();
    if (actionList.items) {
      recentSoulActions.value = actionList.items.slice(0, 3);
    }
    const snapTasks = await fetchWorkerTasks(5, { taskType: 'update_persona_snapshot' });
    let found = false;
    for (const t of snapTasks) {
      if (t.sourceNoteId && t.status === 'succeeded') {
        try {
          const snap = await fetchPersonaSnapshot(t.sourceNoteId);
          if (snap) {
            latestPersonaSnapshot.value = snap;
            found = true;
            break;
          }
        } catch (e) { /* ignore */ }
      }
    }
    if (!found) latestPersonaSnapshot.value = null;
  } catch (e) {
    console.warn('Failed to load cognitive data', e);
  } finally {
    loadingCognitive.value = false;
  }
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (doesDashboardNeedRefresh(wsEvent)) {
    loadScheduleHealth();
    return;
  }
  if (wsEvent.type === 'schedule-updated') {
    loadScheduleHealth();
  }
}

async function loadScheduleHealth() {
  const requestId = ++activeScheduleHealthRequestId;
  scheduleHealthError.value = null;
  try {
    const health = await fetchScheduleHealth();
    if (requestId !== activeScheduleHealthRequestId) return;
    scheduleHealth.value = health;
  } catch (e) {
    if (requestId !== activeScheduleHealthRequestId) return;
    scheduleHealth.value = null;
    scheduleHealthError.value = e as Error;
  }
}

onMounted(() => {
  load();
  loadScheduleHealth();
  loadCognitiveData();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});
</script>

<style scoped>
.dashboard {
  padding: 8px 0 32px;
}

.dashboard-layout {
  display: grid;
  gap: 20px;
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(20rem, 0.95fr);
  gap: 22px;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 32px;
  background:
    radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--accent-soft) 92%, transparent), transparent 18%),
    linear-gradient(140deg, color-mix(in srgb, var(--signal-soft) 48%, transparent), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 92%, transparent), color-mix(in srgb, var(--surface) 92%, transparent));
  box-shadow: 0 28px 80px -42px var(--shadow-strong);
}

.hero-copy {
  display: grid;
  gap: 14px;
  align-content: start;
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero-copy h2 {
  margin: 0;
  max-width: 18ch;
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
  font-size: clamp(1.68rem, 1.36rem + 1.25vw, 2.52rem);
  line-height: 1.08;
  letter-spacing: 0.01em;
  font-weight: 650;
}

.hero-copy h2 span {
  color: var(--accent-strong);
}

.hero-summary {
  margin: 0;
  max-width: 58ch;
  color: var(--text-secondary);
  font-size: 0.98rem;
  line-height: 1.8;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.metric-tile {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface-strong) 84%, transparent);
}

.metric-tile.accent {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 70%, transparent), transparent),
    color-mix(in srgb, var(--surface-strong) 85%, transparent);
}

.metric-label,
.metric-meta {
  color: var(--text-muted);
}

.metric-label {
  font-size: 0.76rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.metric-tile strong {
  font-size: clamp(1.62rem, 1.4rem + 0.8vw, 2.18rem);
  line-height: 1;
}

.metric-meta {
  font-size: 0.9rem;
  line-height: 1.5;
}

.signal-band {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.signal-chip {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 84%, transparent);
}

.signal-chip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.signal-name {
  font-weight: 600;
}

.signal-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dimension-color) 12%, var(--surface-muted));
}

.signal-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dimension-color) 72%, white), var(--dimension-color));
}

.signal-score {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.signal-meta {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.inbox-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
  cursor: pointer;
  transition: background 0.18s ease;
  animation: inbox-pulse 2s ease-in-out infinite;
}

@keyframes inbox-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 0%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .inbox-banner {
    animation: none;
  }
}

.inbox-banner:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, var(--surface));
}

.inbox-icon {
  font-size: 1.2rem;
}

.inbox-text {
  flex: 1;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.inbox-text strong {
  color: var(--text);
  font-weight: 700;
}

.inbox-action {
  font-size: 0.88rem;
  color: var(--accent-strong);
  font-weight: 600;
}

.mission-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
  gap: 20px;
  align-items: start;
}

.mission-column,
.signal-column {
  display: grid;
  gap: 20px;
}

@media (max-width: 1024px) {
  .hero-panel,
  .mission-grid {
    grid-template-columns: 1fr;
  }

  .signal-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .hero-panel {
    padding: 20px;
    border-radius: 24px;
  }

  .hero-copy h2 {
    max-width: none;
  }

  .hero-metrics,
  .signal-band,
  .mission-grid {
    grid-template-columns: 1fr;
  }
}

.schedule-health-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-muted) 60%, var(--surface));
  font-size: 0.95rem;
}

.schedule-health-banner.warning {
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
  background: color-mix(in srgb, var(--danger) 6%, var(--surface));
}

.sh-icon {
  font-size: 1.2rem;
}

.sh-text {
  flex: 1;
  color: var(--text-secondary);
}

.sh-text strong {
  color: var(--text);
  font-weight: 700;
}

.sh-failing {
  color: var(--danger);
}

.sh-detail {
  font-size: 0.85rem;
  color: var(--danger);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sh-action {
  font-size: 0.88rem;
  color: var(--accent-strong);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

/* ─── Shortcuts ─── */
.shortcuts-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  cursor: pointer;
  transition: all 0.2s ease;
}
.shortcut-btn:hover {
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  transform: translateY(-2px);
}
.sc-icon {
  font-size: 1.6rem;
}
.sc-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ─── Cognitive Grid ─── */
.cognitive-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.8fr);
  gap: 20px;
}
.settings-card {
  background: var(--card-bg);
  border-radius: 24px;
  padding: 24px;
  border: 1px solid var(--border);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.card-head h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text);
  font-weight: 600;
}
.btn-link {
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.85rem;
}
.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 0.9rem;
  background: var(--meta-bg);
  border-radius: 12px;
}

/* ─── Persona Card ─── */
.persona-content {
  display: grid;
  gap: 12px;
}
.persona-summary {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--text-primary);
  font-weight: 600;
}
.persona-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.meta-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.75rem;
}
.persona-preview {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--text-muted);
  white-space: pre-wrap;
  background: var(--meta-bg);
  padding: 12px;
  border-radius: 12px;
}

/* ─── Recent Actions Card ─── */
.actions-list {
  display: grid;
  gap: 10px;
}
.action-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
  text-decoration: none;
  transition: background 0.2s;
}
.action-item:hover {
  background: var(--surface);
}
.action-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.action-kind-badge {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}
.action-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.action-item-meta {
  display: flex;
  gap: 12px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .shortcuts-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cognitive-grid {
    grid-template-columns: 1fr;
  }
}
</style>
