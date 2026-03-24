<template>
  <aside class="related-insights">
    <div class="insights-head">
      <h3>🧩 语义关联灵感</h3>
      <span class="beta-tag">AI 挖掘</span>
    </div>
    
    <StateDisplay v-if="loading" type="loading" message="正在向量库中检索..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <div v-else-if="sessions.length === 0" class="empty-hint">
      暂未发现强语义关联的历史灵感。
    </div>
    
    <div v-else class="insights-list">
      <article
        v-for="bs in sessions"
        :key="bs.id"
        class="insight-card"
        :class="{ expanded: expandedIds.has(bs.id) }"
        @click="toggleExpand(bs.id)"
      >
        <div class="card-head">
          <span class="match-score">98% 关联度</span>
          <time class="card-time">{{ formatTime(bs.createdAt) }}</time>
        </div>
        
        <div class="card-themes">
          <span v-for="theme in bs.themes.slice(0, 3)" :key="theme" class="theme-pill">{{ theme }}</span>
        </div>
        
        <div class="card-body">
          <ul class="insight-points">
            <li v-for="(insight, i) in bs.distilledInsights" :key="i">{{ insight }}</li>
          </ul>
        </div>
        
        <div v-if="expandedIds.has(bs.id) && bs.rawInputPreview" class="card-source">
          <strong>原境回顾：</strong>
          <p>{{ bs.rawInputPreview }}</p>
        </div>
      </article>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { BrainstormSession } from '@lifeos/shared';
import StateDisplay from './StateDisplay.vue';

defineProps<{
  sessions: BrainstormSession[];
  loading: boolean;
  error: Error | null;
}>();

const expandedIds = ref<Set<string>>(new Set());

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.related-insights {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
  border-radius: 20px;
  border: 1px solid var(--border-soft);
}

.insights-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.insights-head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  color: var(--text);
  letter-spacing: 0.05em;
}

.beta-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--accent-soft) 80%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
  padding: 24px 0;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
  padding-right: 4px;
}

.insight-card {
  padding: 14px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
}

.insight-card:hover, .insight-card.expanded {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  box-shadow: 0 4px 12px -8px var(--shadow);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.match-score {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--signal);
}

.card-time {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.card-themes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.theme-pill {
  padding: 2px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-strong) 80%, transparent);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.insight-points {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.insight-points li {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.card-source {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}

.card-source strong {
  display: block;
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
}

.card-source p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.5;
}

/* Scrollbar styling for pure css */
.insights-list::-webkit-scrollbar { width: 4px; }
.insights-list::-webkit-scrollbar-track { background: transparent; }
.insights-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
</style>
