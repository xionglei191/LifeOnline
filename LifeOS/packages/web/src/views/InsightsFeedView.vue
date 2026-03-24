<template>
  <div class="insights-feed-view">
    <header class="view-header">
      <h2>✧ 闲时洞察 (Idle Insights)</h2>
      <p class="view-desc">系统在闲置期间自发演化的跨笔记联想与深层发现</p>
    </header>

    <StateDisplay v-if="loading" type="loading" message="正在同步脉络..." />
    <StateDisplay v-else-if="error" type="error" :message="error" />
    <div v-else-if="records.length === 0" class="empty-state">
      暂未生成闲时洞察，请等待下次系统级维护或定时触发。
    </div>
    
    <div v-else class="feed-container">
      <TransitionGroup name="list" tag="div" class="feed-list">
        <article v-for="record in records" :key="record.id" class="insight-card panel">
          <div class="insight-meta">
            <span class="insight-date">{{ new Date(record.createdAt).toLocaleString() }}</span>
            <span class="insight-badge">{{ formatSourceAction(record.signalKind) }}</span>
          </div>
          
          <div class="insight-content">
            <h3 class="insight-title">{{ record.nextActionSummary?.candidateTitle || '深空回响' }}</h3>
            <p class="insight-summary">{{ record.summary }}</p>
            
            <div v-if="getDistilledInsights(record).length > 0" class="distilled-list">
              <h4>精炼结论</h4>
              <ul>
                <li v-for="(insight, idx) in getDistilledInsights(record)" :key="idx">{{ insight }}</li>
              </ul>
            </div>
            
            <div v-if="getContinuitySignals(record).length > 0" class="continuity-list">
              <h4>岁月连续性指引</h4>
              <ul>
                <li v-for="(sig, idx) in getContinuitySignals(record)" :key="idx">{{ sig }}</li>
              </ul>
            </div>
          </div>
        </article>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ReintegrationRecord } from '@lifeos/shared';
import { fetchReintegrationRecords } from '../api/client';
import StateDisplay from '../components/StateDisplay.vue';

const records = ref<ReintegrationRecord[]>([]);
const loading = ref(true);
const error = ref('');

const formatSourceAction = (kind: string) => {
  if (kind === 'promote_event_node') return '从记忆锚点提炼';
  if (kind === 'promote_continuity_record') return '岁月指引升华';
  if (kind === 'launch_openclaw_task') return '全视野反思';
  return '跨维度联想';
};

const getDistilledInsights = (record: ReintegrationRecord): string[] => {
  const arr = record.evidence?.distilledInsights;
  return Array.isArray(arr) ? arr as string[] : [];
};

const getContinuitySignals = (record: ReintegrationRecord): string[] => {
  const arr = record.evidence?.continuitySignals;
  return Array.isArray(arr) ? arr as string[] : [];
};

const loadData = async () => {
  loading.value = true;
  error.value = '';
  try {
    records.value = await fetchReintegrationRecords();
  } catch (err: any) {
    error.value = err.message || '获取闲时洞察失败';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.insights-feed-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.view-header {
  margin-bottom: 32px;
  text-align: center;
}

.view-header h2 {
  font-size: 1.8rem;
  margin: 0 0 8px;
  color: var(--text);
  letter-spacing: 0.05em;
}

.view-desc {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin: 0;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.insight-card {
  padding: 24px;
  border-radius: 20px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  box-shadow: 0 10px 30px -10px var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.insight-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 40px -12px var(--shadow-strong);
}

.insight-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 0.85rem;
}

.insight-date {
  color: var(--text-muted);
}

.insight-badge {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-strong);
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.insight-title {
  margin: 0 0 12px;
  font-size: 1.25rem;
  color: var(--text);
}

.insight-summary {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.distilled-list, .continuity-list {
  margin-top: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--surface-muted) 50%, transparent);
  border-radius: 12px;
}

.distilled-list h4, .continuity-list h4 {
  margin: 0 0 10px;
  font-size: 0.9rem;
  color: var(--text);
  opacity: 0.8;
}

.distilled-list ul, .continuity-list ul {
  margin: 0;
  padding-left: 20px;
  font-size: 0.92rem;
  color: var(--text-secondary);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
