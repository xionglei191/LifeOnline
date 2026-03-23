<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">Dimension Matrix</p>
        <h3>八维度生命矩阵</h3>
      </div>
      <span class="panel-badge">8 channels</span>
    </div>

    <div class="grid">
      <article
        v-for="stat in stats"
        :key="stat.dimension"
        class="card"
        :style="{ '--dimension-color': dimensionColor(stat.dimension) }"
        @click="$router.push(dimensionRoute(stat.dimension))"
      >
        <div class="card-head">
          <div>
            <div class="name">{{ dimensionLabel(stat.dimension) }}</div>
            <div class="subline">活跃 {{ stat.pending + stat.in_progress }} 项 · 完成 {{ stat.done }}/{{ stat.total }}</div>
          </div>
          <div class="score-block">
            <div class="score-label">完成率</div>
            <div class="score">{{ stat.health_score }}%</div>
          </div>
        </div>

        <div class="progress-track">
          <span class="progress-fill" :style="{ width: `${stat.health_score}%` }"></span>
        </div>

        <div class="stats">
          <div class="stat-item">
            <span class="label">总量</span>
            <span class="value">{{ stat.total }}</span>
          </div>
          <div class="stat-item">
            <span class="label">待办</span>
            <span class="value">{{ stat.pending }}</span>
          </div>
          <div class="stat-item">
            <span class="label">进行中</span>
            <span class="value">{{ stat.in_progress }}</span>
          </div>
          <div class="stat-item">
            <span class="label">完成</span>
            <span class="value">{{ stat.done }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DimensionStat, SelectableDimension } from '@lifeos/shared';
import { getDimensionColor, getDimensionLabel } from '../utils/dimensions';

defineProps<{ stats: DimensionStat[] }>();

const dimensionLabel = (dim: SelectableDimension) => getDimensionLabel(dim);
const dimensionColor = (dim: SelectableDimension) => getDimensionColor(dim);
const dimensionRoute = (dim: SelectableDimension) => dim === '_inbox' ? '/inbox' : `/dimension/${dim}`;
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

.panel-badge {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

@media (min-width: 768px) and (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--dimension-color) 24%, var(--border));
  border-radius: 24px;
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--dimension-color) 10%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface) 92%, transparent);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 50px -38px var(--shadow-strong);
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.name {
  font-size: 1.02rem;
  font-weight: 700;
}

.subline {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.score-block {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.score-label {
  color: var(--text-muted);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.score {
  font-size: 2rem;
  line-height: 1;
  font-weight: 700;
  color: var(--dimension-color);
}

.progress-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dimension-color) 12%, var(--surface-muted));
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dimension-color) 76%, white), var(--dimension-color));
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stat-item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-muted) 88%, transparent);
}

.label {
  color: var(--text-muted);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.value {
  font-weight: 700;
}

@media (max-width: 720px) {
  .panel {
    padding: 20px;
    border-radius: 24px;
  }
}
</style>
