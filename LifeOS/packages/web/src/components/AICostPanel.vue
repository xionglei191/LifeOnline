<template>
  <div class="settings-card ai-cost-panel">
    <h3>AI 调用成本统计</h3>
    <p class="hint" style="margin-bottom:16px">追踪系统的 AI API Token 消耗和费用预估（基于最近 7 天数据）。</p>

    <div v-if="loading" class="empty-state">加载数据中...</div>
    <div v-else-if="error" class="message error">{{ error }}</div>
    <div v-else-if="usageData">
      <div class="cost-summary">
        <div class="summary-box">
          <span class="label">累计消耗 Tokens</span>
          <span class="value">{{ formatNumber(usageData.totalTokens) }}</span>
        </div>
        <div class="summary-box">
          <span class="label">累计预估费用 (USD)</span>
          <span class="value">${{ (usageData.totalCostInCents / 100).toFixed(2) }}</span>
        </div>
        <div class="summary-box">
          <span class="label">累计调用次数</span>
          <span class="value">{{ formatNumber(usageData.totalRequests) }} 次</span>
        </div>
      </div>

      <div class="chart-container" v-if="usageData.dailyUsage.length">
        <div class="chart-bars">
          <div v-for="day in usageData.dailyUsage" :key="day.date" class="chart-col">
            <div class="bar-wrap" :title="`${day.date}\nTokens: ${day.totalTokens}\nRequests: ${day.requestCount}`" @click="console.log(day)">
              <div class="bar" :style="{ height: getBarHeight(day.totalTokens) + '%' }"></div>
            </div>
            <span class="day-label">{{ formatDay(day.date) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchAiUsage, type AiUsageResponse } from '../api/client';

const loading = ref(true);
const error = ref('');
const usageData = ref<AiUsageResponse | null>(null);

const maxTokens = computed(() => {
  if (!usageData.value?.dailyUsage.length) return 1;
  return Math.max(...usageData.value.dailyUsage.map(d => d.totalTokens));
});

function getBarHeight(tokens: number) {
  if (!maxTokens.value) return 0;
  return Math.max((tokens / maxTokens.value) * 100, 5); // min 5% height
}

function formatNumber(num: number) {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

onMounted(async () => {
  try {
    usageData.value = await fetchAiUsage(7);
  } catch (err: any) {
    error.value = err.message || '加载 AI 成本数据失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.ai-cost-panel {
  display: flex;
  flex-direction: column;
}

.cost-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-box {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.summary-box .label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-box .value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.chart-container {
  height: 180px;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
}

.chart-bars {
  display: flex;
  height: 100%;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  height: 100%;
}

.bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: color-mix(in srgb, var(--surface) 50%, transparent);
  border-radius: 6px 6px 0 0;
  padding: 0 4%;
  cursor: pointer;
}

.bar {
  width: 100%;
  max-width: 32px;
  background: color-mix(in srgb, var(--dimension-color, #409eff) 80%, transparent);
  border-radius: 4px 4px 0 0;
  transition: height 0.4s ease, background 0.2s;
}

.bar-wrap:hover .bar {
  background: var(--dimension-color, #409eff);
}

.day-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
