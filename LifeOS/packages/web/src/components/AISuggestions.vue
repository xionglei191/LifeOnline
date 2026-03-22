<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">AI Insight Stream</p>
        <h3>系统洞察流</h3>
      </div>
      <button @click="handleRefresh" :disabled="loading" class="refresh-btn">
        {{ loading ? '分析中' : '刷新洞察' }}
      </button>
    </div>

    <div v-if="loading" class="state-card">AI 正在扫描你的生命节律与任务负载。</div>
    <div v-else-if="error" class="state-card error-state">{{ error }}</div>
    <div v-else-if="suggestions.length === 0 && fetched" class="state-card">本轮没有识别到明显异常，系统处于平稳区间。</div>
    <div v-else-if="suggestions.length > 0" class="stream">
      <article v-for="s in suggestions" :key="s.id" class="insight-card" :class="'type-' + s.type">
        <div class="insight-rail"></div>
        <div class="insight-body">
          <div class="insight-top">
            <span class="insight-type">{{ typeLabels[s.type] }}</span>
            <span v-if="s.dimension" class="insight-dimension">{{ getDimensionLabel(s.dimension) }}</span>
          </div>
          <h4>{{ s.title }}</h4>
          <p>{{ s.content }}</p>
        </div>
      </article>
    </div>
    <div v-else class="state-card">点击“刷新洞察”让 AI 重新分析最近的数据变化。</div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import type { AISuggestion, WsEvent } from '@lifeos/shared';
import { fetchAISuggestions } from '../api/client';
import { getDimensionLabel } from '../utils/dimensions';
import { isIndexRefreshEvent } from '../composables/useWebSocket';

function doesAISuggestionsNeedRefresh(wsEvent: WsEvent) {
  return isIndexRefreshEvent(wsEvent)
    || wsEvent.type === 'note-updated'
    || wsEvent.type === 'note-created'
    || wsEvent.type === 'note-deleted'
    || wsEvent.type === 'note-worker-tasks-updated';
}

const suggestions = ref<AISuggestion[]>([]);
const loading = ref(false);
const error = ref('');
const fetched = ref(false);
let activeRequestId = 0;

const typeLabels: Record<string, string> = {
  balance: '平衡提示',
  overload: '负载告警',
  goal: '目标推进',
  reminder: '提醒',
};

async function handleRefresh() {
  const requestId = ++activeRequestId;
  loading.value = true;
  error.value = '';
  try {
    const nextSuggestions = await fetchAISuggestions();
    if (requestId !== activeRequestId) return;
    suggestions.value = nextSuggestions;
    fetched.value = true;
  } catch (e: any) {
    if (requestId !== activeRequestId) return;
    fetched.value = true;
    error.value = e.message || 'AI 建议获取失败';
  } finally {
    if (requestId === activeRequestId) {
      loading.value = false;
    }
  }
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (!doesAISuggestionsNeedRefresh(wsEvent)) return;
  void handleRefresh();
}

onMounted(() => {
  document.addEventListener('ws-update', handleWsUpdate);
  void handleRefresh();
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});
</script>

<style scoped>
.panel {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 18px;
}

.panel-kicker {
  margin: 0 0 4px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.panel-head h3 {
  margin: 0;
  font-size: 1.35rem;
}

.refresh-btn {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-soft) 70%, transparent);
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.state-card {
  padding: 18px;
  border-radius: 20px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  line-height: 1.6;
}

.error-state {
  color: var(--danger);
}

.stream {
  display: grid;
  gap: 12px;
}

.insight-card {
  position: relative;
  display: grid;
  grid-template-columns: 4px 1fr;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
}

.insight-rail {
  border-radius: 999px;
  background: var(--signal);
}

.type-balance .insight-rail {
  background: var(--signal);
}

.type-overload .insight-rail {
  background: var(--warn);
}

.type-goal .insight-rail {
  background: var(--ok);
}

.type-reminder .insight-rail {
  background: var(--dim-learning);
}

.insight-body {
  display: grid;
  gap: 8px;
}

.insight-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.insight-type,
.insight-dimension {
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.insight-body h4 {
  margin: 0;
  font-size: 1rem;
}

.insight-body p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.65;
}

@media (max-width: 720px) {
  .panel {
    padding: 20px;
    border-radius: 24px;
  }
}
</style>
