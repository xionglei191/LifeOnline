<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">Priority Watch</p>
        <h3>本周重点追踪</h3>
      </div>
      <span class="panel-badge">Week Pulse</span>
    </div>

    <div v-if="orderedHighlights.length === 0" class="empty">本周没有特别需要盯住的重点事项。</div>

    <ul v-else class="highlight-list">
      <li v-for="item in orderedHighlights" :key="item.id" class="highlight-item" @click="$emit('selectNote', item.id)">
        <div class="date-block">
          <span class="date-day">{{ formatDay(item.date) }}</span>
          <span class="date-month">{{ formatMonth(item.date) }}</span>
        </div>

        <div class="content">
          <div class="title">{{ item.title || item.file_name.replace('.md', '') }}</div>
          <div class="filename">{{ item.file_name }}</div>
          <div class="meta">
            <span class="dimension" :style="{ '--dimension-color': dimensionColor(item.dimension) }">
              {{ dimensionLabel(item.dimension) }}
            </span>
            <span class="status" :class="`status-${item.status}`">{{ statusLabel(item.status) }}</span>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { Note } from '@lifeos/shared';
import { computed } from 'vue';
import { getDimensionColor, getDimensionLabel } from '../utils/dimensions';

const props = defineProps<{ highlights: Note[] }>();
defineEmits<{ selectNote: [noteId: string] }>();

const orderedHighlights = computed(() => {
  return [...props.highlights].sort((left, right) => {
    const dateDelta = left.date.localeCompare(right.date);
    if (dateDelta !== 0) return dateDelta;

    const leftLabel = (left.title || left.file_name.replace('.md', '')).toLocaleLowerCase();
    const rightLabel = (right.title || right.file_name.replace('.md', '')).toLocaleLowerCase();
    return leftLabel.localeCompare(rightLabel, 'zh-CN');
  });
});

const statuses: Record<string, string> = {
  pending: '待办',
  in_progress: '推进中',
  done: '已完成',
  cancelled: '已取消',
};

const dimensionLabel = (dim: Note['dimension']) => getDimensionLabel(dim);
const dimensionColor = (dim: Note['dimension']) => getDimensionColor(dim);
const statusLabel = (status: string) => statuses[status] || status;

const formatDay = (date: string) => date.slice(8, 10);
const formatMonth = (date: string) => `${date.slice(5, 7)}月`;
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

.empty {
  padding: 20px;
  border-radius: 20px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.highlight-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.highlight-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.highlight-item:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
  box-shadow: 0 18px 42px -34px var(--shadow-strong);
}

.date-block {
  display: grid;
  justify-items: center;
  align-content: center;
  width: 64px;
  min-height: 64px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--signal-soft) 70%, transparent), transparent),
    var(--surface-muted);
}

.date-day {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.date-month {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.content {
  display: grid;
  gap: 8px;
}

.title {
  font-weight: 600;
  line-height: 1.45;
}

.filename {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-top: 4px;
}

.meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.82rem;
}

.dimension,
.status {
  padding: 5px 10px;
  border-radius: 999px;
}

.dimension {
  background: color-mix(in srgb, var(--dimension-color) 13%, transparent);
  color: var(--dimension-color);
}

.status {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.status-pending {
  color: var(--warn);
}

.status-in_progress {
  color: var(--signal);
}

.status-done {
  color: var(--ok);
}

@media (max-width: 720px) {
  .panel {
    padding: 20px;
    border-radius: 24px;
  }
}
</style>
