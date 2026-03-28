<template>
  <section class="charts-panel">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">Dimension Analytics</p>
        <h3>维度分析面板</h3>
      </div>
      <div class="chart-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div v-if="!notes.length" class="empty-state">当前维度还没有足够数据生成图表。</div>
    <div v-else ref="chartEl" class="chart-container"></div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { echarts } from '../lib/echarts';
import type { Note } from '@lifeos/shared';

const props = defineProps<{ notes: Note[]; dimension: string }>();

const chartEl = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
const activeTab = ref('status');

const tabs = [
  { key: 'status', label: '状态分布' },
  { key: 'trend', label: '时间趋势' },
  { key: 'priority', label: '优先级' },
];

const dimensionColors: Record<string, string> = {
  health: '#4ade80',
  career: '#60a5fa',
  finance: '#fbbf24',
  learning: '#c084fc',
  relationship: '#fb923c',
  life: '#2dd4bf',
  hobby: '#f59e0b',
  growth: '#34d399',
};

function chartColor() {
  return dimensionColors[props.dimension] || '#60a5fa';
}

function tooltipBase() {
  return {
    backgroundColor: 'rgba(10, 18, 28, 0.92)',
    borderColor: 'rgba(96, 165, 250, 0.24)',
    textStyle: { color: '#e2edf8' },
  };
}

function getStatusOption() {
  const counts = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
  props.notes.forEach((n) => { counts[n.status as keyof typeof counts]++; });
  return {
    tooltip: { ...tooltipBase(), trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6e7f92' } },
    series: [{
      type: 'pie',
      radius: ['42%', '72%'],
      center: ['50%', '44%'],
      data: [
        { value: counts.pending, name: '待办', itemStyle: { color: '#60a5fa' } },
        { value: counts.in_progress, name: '进行中', itemStyle: { color: '#f59e0b' } },
        { value: counts.done, name: '完成', itemStyle: { color: chartColor() } },
        { value: counts.cancelled, name: '取消', itemStyle: { color: '#94a3b8' } },
      ].filter((d) => d.value > 0),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, color: '#16202b', fontWeight: 'bold' } },
    }],
  };
}

function getTrendOption() {
  const monthMap = new Map<string, number>();
  props.notes.forEach((n) => {
    const month = (n.date || '').slice(0, 7);
    if (month) monthMap.set(month, (monthMap.get(month) || 0) + 1);
  });
  const sorted = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    tooltip: { ...tooltipBase(), trigger: 'axis' },
    grid: { left: 24, right: 18, top: 20, bottom: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: sorted.map(([m]) => m),
      axisLine: { lineStyle: { color: 'rgba(123, 145, 170, 0.22)' } },
      axisLabel: { color: '#6e7f92', fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { lineStyle: { color: 'rgba(123, 145, 170, 0.22)' } },
      axisLabel: { color: '#6e7f92', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(123, 145, 170, 0.16)' } },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 22,
      data: sorted.map(([, v]) => v),
      itemStyle: { color: chartColor(), borderRadius: [10, 10, 0, 0] },
    }],
  };
}

function getPriorityOption() {
  const counts = { high: 0, medium: 0, low: 0 };
  props.notes.forEach((n) => { counts[n.priority as keyof typeof counts]++; });
  return {
    tooltip: { ...tooltipBase(), trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6e7f92' } },
    series: [{
      type: 'pie',
      radius: ['42%', '72%'],
      center: ['50%', '44%'],
      data: [
        { value: counts.high, name: '高优先级', itemStyle: { color: '#f87171' } },
        { value: counts.medium, name: '中优先级', itemStyle: { color: '#f59e0b' } },
        { value: counts.low, name: '低优先级', itemStyle: { color: '#34d399' } },
      ].filter((d) => d.value > 0),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, color: '#16202b', fontWeight: 'bold' } },
    }],
  };
}

function renderChart() {
  if (!chart || !props.notes.length) return;
  const option = activeTab.value === 'status'
    ? getStatusOption()
    : activeTab.value === 'trend'
      ? getTrendOption()
      : getPriorityOption();
  chart.setOption(option, true);
  chart.resize();
}

onMounted(async () => {
  await nextTick();
  if (chartEl.value) {
    chart = echarts.init(chartEl.value);
    renderChart();
    window.addEventListener('resize', renderChart);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', renderChart);
  chart?.dispose();
  chart = null;
});

watch(() => [props.notes, props.notes.length, activeTab.value], renderChart);
</script>

<style scoped>
.charts-panel {
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
  margin-bottom: 16px;
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

.chart-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
}

.tab-btn.active {
  border-color: color-mix(in srgb, var(--signal) 34%, var(--border));
  background: color-mix(in srgb, var(--signal-soft) 78%, transparent);
  color: var(--signal);
}

.empty-state {
  padding: 20px;
  border-radius: 18px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.chart-container {
  width: 100%;
  height: 320px;
}

@media (max-width: 720px) {
  .charts-panel {
    padding: 20px;
    border-radius: 24px;
  }

  .panel-head {
    flex-direction: column;
  }
}
</style>
