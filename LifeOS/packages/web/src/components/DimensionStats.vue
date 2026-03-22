<template>
  <section class="dimension-stats" :style="{ '--dimension-color': dimensionColor }">
    <div class="hero-copy">
      <p class="eyebrow">Dimension Channel</p>
      <h2>{{ dimensionLabel }}</h2>
      <p class="summary">
        当前共有 {{ total }} 条记录，其中 {{ done }} 条已闭环，{{ pending + inProgress }} 条仍在占用注意力。
      </p>
    </div>

    <div class="hero-side">
      <div class="health-score">
        <div class="health-ring" :style="{ background: `conic-gradient(${dimensionColor} ${healthScore * 3.6}deg, color-mix(in srgb, var(--surface-muted) 88%, transparent) 0deg)` }">
          <div class="health-core">
            <strong>{{ healthScore }}</strong>
            <span>health</span>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总量</span>
          <span class="stat-value">{{ total }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">待办</span>
          <span class="stat-value pending">{{ pending }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">进行中</span>
          <span class="stat-value in-progress">{{ inProgress }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">完成</span>
          <span class="stat-value done">{{ done }}</span>
        </div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-segment pending" :style="{ width: pendingPercent + '%' }"></div>
      <div class="progress-segment in-progress" :style="{ width: inProgressPercent + '%' }"></div>
      <div class="progress-segment done" :style="{ width: donePercent + '%' }"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SelectableDimension } from '@lifeos/shared';
import { getDimensionLabel } from '../utils/dimensions';

const props = defineProps<{
  dimension: SelectableDimension;
  total: number;
  pending: number;
  inProgress: number;
  done: number;
}>();

const dimensionColors: Record<SelectableDimension, string> = {
  health: 'var(--dim-health)',
  career: 'var(--dim-career)',
  finance: 'var(--dim-finance)',
  learning: 'var(--dim-learning)',
  relationship: 'var(--dim-relationship)',
  life: 'var(--dim-life)',
  hobby: 'var(--dim-hobby)',
  growth: 'var(--dim-growth)',
};

const dimensionLabel = computed(() => getDimensionLabel(props.dimension));
const dimensionColor = computed(() => dimensionColors[props.dimension]);
const healthScore = computed(() => props.total > 0 ? Math.round((props.done / props.total) * 100) : 0);
const pendingPercent = computed(() => props.total > 0 ? (props.pending / props.total) * 100 : 0);
const inProgressPercent = computed(() => props.total > 0 ? (props.inProgress / props.total) * 100 : 0);
const donePercent = computed(() => props.total > 0 ? (props.done / props.total) * 100 : 0);
</script>

<style scoped>
.dimension-stats {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.95fr);
  gap: 24px;
  padding: 28px;
  border: 1px solid color-mix(in srgb, var(--dimension-color) 28%, var(--border));
  border-radius: 32px;
  background:
    radial-gradient(circle at 84% 18%, color-mix(in srgb, var(--dimension-color) 12%, transparent), transparent 18%),
    linear-gradient(145deg, color-mix(in srgb, var(--dimension-color) 8%, transparent), transparent 36%),
    color-mix(in srgb, var(--surface-strong) 92%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
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
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
  font-size: clamp(1.58rem, 1.34rem + 0.9vw, 2.16rem);
  line-height: 1.08;
  font-weight: 650;
}

.summary {
  margin: 0;
  max-width: 56ch;
  color: var(--text-secondary);
  font-size: 0.97rem;
  line-height: 1.8;
}

.hero-side {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 18px;
  align-items: center;
}

.health-ring {
  width: 116px;
  height: 116px;
  padding: 10px;
  border-radius: 50%;
}

.health-core {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
}

.health-core strong {
  font-size: 2rem;
  line-height: 1;
}

.health-core span {
  margin-top: 4px;
  font-size: 0.74rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
}

.stat-label {
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
}

.stat-value.pending {
  color: var(--signal);
}

.stat-value.in-progress {
  color: var(--warn);
}

.stat-value.done {
  color: var(--ok);
}

.progress-bar {
  grid-column: 1 / -1;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  display: flex;
  background: color-mix(in srgb, var(--surface-muted) 92%, transparent);
}

.progress-segment {
  height: 100%;
}

.progress-segment.pending {
  background: var(--signal);
}

.progress-segment.in-progress {
  background: var(--warn);
}

.progress-segment.done {
  background: var(--ok);
}

@media (max-width: 960px) {
  .dimension-stats,
  .hero-side {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dimension-stats {
    padding: 20px;
    border-radius: 24px;
  }

  .health-ring {
    width: 96px;
    height: 96px;
  }
}
</style>
