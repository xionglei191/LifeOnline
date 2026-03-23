<template>
  <div class="stats-view">
    <div class="page-shell">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Signal Analytics</p>
          <h2>把生活记录转成<span>可判断、可比较、可行动</span>的系统信号。</h2>
          <p class="hero-summary">
            这里不只是报表，而是你的完成节律监控台。完成趋势、维度完成率、月度对比和标签热点会一起告诉你，
            最近的资源究竟投向了哪里。
          </p>
        </div>

        <div class="hero-metrics">
          <article class="metric">
            <span class="metric-label">趋势窗口</span>
            <strong>{{ trendDays }}</strong>
            <span class="metric-meta">当前趋势窗口天数</span>
          </article>
          <article class="metric">
            <span class="metric-label">分析图层</span>
            <strong>4</strong>
            <span class="metric-meta">趋势 / 雷达 / 月度 / 标签</span>
          </article>
          <article class="metric accent">
            <span class="metric-label">当前焦点</span>
            <strong>完成率</strong>
            <span class="metric-meta">趋势 / 对比 / 标签热度</span>
          </article>
        </div>
      </section>

      <StateDisplay v-if="loading" type="loading" message="正在汇总生命信号..." />
      <StateDisplay v-else-if="error" type="error" :message="error.message" />
      <div v-else class="stats-grid">
        <section class="stats-card wide">
          <div class="card-header">
            <div>
              <p class="card-kicker">Completion Flow</p>
              <h3>完成趋势</h3>
            </div>
            <div class="day-tabs">
              <button
                v-for="d in [7, 30, 90]"
                :key="d"
                :class="['day-btn', { active: trendDays === d }]"
                @click="trendDays = d; refreshTrend()"
              >
                近{{ d }}天
              </button>
            </div>
          </div>
          <div ref="trendEl" class="chart chart-wide"></div>
        </section>

        <section class="stats-card">
          <div class="card-header compact">
            <div>
              <p class="card-kicker">维度雷达</p>
              <h3>{{ radarTitle }}</h3>
            </div>
          </div>
          <div ref="radarEl" class="chart chart-square"></div>
        </section>

        <section class="stats-card">
          <div class="card-header compact">
            <div>
              <p class="card-kicker">月度对比</p>
              <h3>月度对比</h3>
            </div>
          </div>
          <div ref="monthlyEl" class="chart chart-square"></div>
        </section>

        <section class="stats-card wide">
          <div class="card-header compact">
            <div>
              <p class="card-kicker">标签热度</p>
              <h3>标签频率</h3>
            </div>
          </div>
          <div ref="tagsEl" class="chart chart-wide"></div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { StatsTrendPoint, StatsRadarPoint, StatsMonthlyPoint, StatsTagPoint, WsEvent } from '@lifeos/shared';
import { echarts } from '../lib/echarts';
import { fetchStatsTrend, fetchStatsRadar, fetchStatsMonthly, fetchStatsTags } from '../api/client';
import StateDisplay from '../components/StateDisplay.vue';
import { isIndexRefreshEvent } from '../composables/useWebSocket';
import { getDimensionLabel } from '../utils/dimensions';

const trendEl = ref<HTMLElement | null>(null);
const radarEl = ref<HTMLElement | null>(null);
const monthlyEl = ref<HTMLElement | null>(null);
const tagsEl = ref<HTMLElement | null>(null);

const trendDays = ref(30);
const loading = ref(false);
const error = ref<Error | null>(null);
const radarDimensionCount = ref(0);

let charts: echarts.ECharts[] = [];
let resizeHandler: (() => void) | null = null;
let activeTrendRequestId = 0;

const chartText = '#6e7f92';
const axisLine = 'rgba(123, 145, 170, 0.22)';
const gridLine = 'rgba(123, 145, 170, 0.16)';

function initChart(el: HTMLElement | null): echarts.ECharts | null {
  if (!el) return null;
  return echarts.init(el);
}

function baseTooltip() {
  return {
    trigger: 'axis',
    backgroundColor: 'rgba(10, 18, 28, 0.92)',
    borderColor: 'rgba(96, 165, 250, 0.28)',
    textStyle: { color: '#e2edf8' },
  };
}

function baseAxis() {
  return {
    axisLine: { lineStyle: { color: axisLine } },
    axisLabel: { color: chartText, fontSize: 11 },
    splitLine: { lineStyle: { color: gridLine } },
  };
}

const radarTitle = computed(() => `当前 ${radarDimensionCount.value} 个维度完成率`);

async function loadTrend(data: StatsTrendPoint[]) {
  const c = charts[0];
  if (!c) return;
  c.setOption({
    tooltip: baseTooltip(),
    legend: { data: ['记录总量', '完成'], bottom: 0, textStyle: { color: chartText } },
    grid: { left: 24, right: 18, top: 26, bottom: 42, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.day.slice(5)),
      ...baseAxis(),
      splitLine: { show: false },
    },
    yAxis: { type: 'value', minInterval: 1, ...baseAxis() },
    series: [
      {
        name: '记录总量',
        type: 'line',
        data: data.map((d) => d.total),
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: '#60a5fa' },
        lineStyle: { width: 3, color: '#60a5fa' },
        areaStyle: { color: 'rgba(96, 165, 250, 0.12)' },
      },
      {
        name: '完成',
        type: 'line',
        data: data.map((d) => d.done),
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: '#34d399' },
        lineStyle: { width: 3, color: '#34d399' },
        areaStyle: { color: 'rgba(52, 211, 153, 0.12)' },
      },
    ],
  }, true);
}

async function loadRadar(data: StatsRadarPoint[]) {
  radarDimensionCount.value = data.length;
  const c = charts[1];
  if (!c) return;
  c.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 18, 28, 0.92)',
      borderColor: 'rgba(94, 234, 212, 0.26)',
      textStyle: { color: '#e2edf8' },
    },
    radar: {
      indicator: data.map((d) => ({ name: getDimensionLabel(d.dimension), max: 100 })),
      radius: '68%',
      splitNumber: 4,
      axisName: { color: chartText },
      splitLine: { lineStyle: { color: gridLine } },
      splitArea: { areaStyle: { color: ['transparent'] } },
      axisLine: { lineStyle: { color: axisLine } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: data.map((d) => d.rate),
        name: '完成率%',
        itemStyle: { color: '#5eead4' },
        lineStyle: { width: 2.5, color: '#5eead4' },
        areaStyle: { color: 'rgba(94, 234, 212, 0.2)' },
      }],
    }],
  }, true);
}

async function loadMonthly(data: StatsMonthlyPoint[]) {
  const c = charts[2];
  if (!c) return;
  c.setOption({
    tooltip: baseTooltip(),
    legend: { data: ['记录总量', '完成'], bottom: 0, textStyle: { color: chartText } },
    grid: { left: 24, right: 18, top: 26, bottom: 42, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.month),
      ...baseAxis(),
      splitLine: { show: false },
    },
    yAxis: { type: 'value', minInterval: 1, ...baseAxis() },
    series: [
      {
        name: '记录总量',
        type: 'bar',
        barMaxWidth: 18,
        data: data.map((d) => d.total),
        itemStyle: { color: '#60a5fa', borderRadius: [10, 10, 0, 0] },
      },
      {
        name: '完成',
        type: 'bar',
        barMaxWidth: 18,
        data: data.map((d) => d.done),
        itemStyle: { color: '#34d399', borderRadius: [10, 10, 0, 0] },
      },
    ],
  }, true);
}

async function loadTags(data: StatsTagPoint[]) {
  const c = charts[3];
  if (!c) return;
  c.setOption({
    tooltip: baseTooltip(),
    grid: { left: 24, right: 24, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: 'value', ...baseAxis() },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.tag).reverse(),
      axisLabel: { color: chartText, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: data.map((d) => d.count).reverse(),
      barMaxWidth: 16,
      itemStyle: {
        color: '#c084fc',
        borderRadius: [0, 10, 10, 0],
      },
    }],
  }, true);
}

async function refreshTrend() {
  const requestId = ++activeTrendRequestId;
  error.value = null;
  try {
    const data = await fetchStatsTrend(trendDays.value);
    if (requestId !== activeTrendRequestId) return;
    await loadTrend(data);
  } catch (e) {
    if (requestId !== activeTrendRequestId) return;
    error.value = e as Error;
  }
}

async function loadAllCharts() {
  loading.value = true;
  error.value = null;
  const trendRequestId = ++activeTrendRequestId;
  try {
    const [trendData, radarData, monthlyData, tagData] = await Promise.all([
      fetchStatsTrend(trendDays.value),
      fetchStatsRadar(),
      fetchStatsMonthly(),
      fetchStatsTags(),
    ]);
    if (trendRequestId !== activeTrendRequestId) return;
    await Promise.all([
      loadTrend(trendData),
      loadRadar(radarData),
      loadMonthly(monthlyData),
      loadTags(tagData),
    ]);
  } catch (e) {
    if (trendRequestId !== activeTrendRequestId) return;
    error.value = e as Error;
  } finally {
    if (trendRequestId === activeTrendRequestId) {
      loading.value = false;
    }
  }
}

function doesStatsNeedRefresh(wsEvent: WsEvent) {
  return isIndexRefreshEvent(wsEvent)
    || wsEvent.type === 'note-worker-tasks-updated'
    || wsEvent.type === 'note-updated'
    || wsEvent.type === 'note-created'
    || wsEvent.type === 'note-deleted';
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (!doesStatsNeedRefresh(wsEvent)) return;
  void loadAllCharts();
}

onMounted(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  charts.push(initChart(trendEl.value)!);
  charts.push(initChart(radarEl.value)!);
  charts.push(initChart(monthlyEl.value)!);
  charts.push(initChart(tagsEl.value)!);
  charts = charts.filter(Boolean);
  await loadAllCharts();

  resizeHandler = () => {
    charts.forEach((chart) => chart?.resize());
  };
  window.addEventListener('resize', resizeHandler);
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  document.removeEventListener('ws-update', handleWsUpdate);
  charts.forEach((chart) => chart?.dispose());
  charts = [];
});
</script>

<style scoped>
.stats-view {
  padding: 8px 0 32px;
}

.page-shell {
  display: grid;
  gap: 20px;
}

.hero-panel,
.stats-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.95fr);
  gap: 22px;
  padding: 28px;
  border-radius: 32px;
  background:
    radial-gradient(circle at 86% 18%, color-mix(in srgb, var(--signal-soft) 76%, transparent), transparent 18%),
    linear-gradient(140deg, color-mix(in srgb, var(--accent-soft) 66%, transparent), transparent 30%),
    color-mix(in srgb, var(--surface-strong) 92%, transparent);
}

.hero-copy {
  display: grid;
  gap: 14px;
}

.eyebrow,
.card-kicker {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero-copy h2 {
  margin: 0;
  max-width: 19ch;
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
  font-size: clamp(1.62rem, 1.34rem + 1.1vw, 2.34rem);
  line-height: 1.08;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.metric {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
}

.metric.accent {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 76%, transparent), transparent),
    color-mix(in srgb, var(--surface) 92%, transparent);
}

.metric-label,
.metric-meta {
  color: var(--text-muted);
}

.metric-label {
  font-size: 0.74rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.metric strong {
  font-size: clamp(1.54rem, 1.34rem + 0.72vw, 2rem);
  line-height: 1;
}

.metric-meta {
  font-size: 0.84rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.stats-card {
  padding: 22px;
  border-radius: 28px;
}

.stats-card.wide {
  grid-column: 1 / -1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 16px;
  margin-bottom: 16px;
}

.card-header.compact {
  margin-bottom: 10px;
}

.card-header h3 {
  margin: 6px 0 0;
  font-size: 1.3rem;
}

.day-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.day-btn {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.day-btn:hover {
  border-color: color-mix(in srgb, var(--signal) 34%, var(--border));
  color: var(--signal);
}

.day-btn.active {
  border-color: color-mix(in srgb, var(--signal) 36%, var(--border));
  background: color-mix(in srgb, var(--signal-soft) 82%, transparent);
  color: var(--signal);
}

.chart {
  width: 100%;
}

.chart-wide {
  height: 300px;
}

.chart-square {
  height: 320px;
}

@media (max-width: 1024px) {
  .hero-panel,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero-panel,
  .stats-card {
    padding: 20px;
    border-radius: 24px;
  }

  .card-header {
    flex-direction: column;
  }
}
</style>
