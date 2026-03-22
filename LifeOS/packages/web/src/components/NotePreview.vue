<template>
  <Teleport to="body">
    <Transition name="preview-fade">
      <div
        v-if="visible && displayNotes.length > 0"
        class="preview-card"
        :style="{ top: `${pos.y}px`, left: `${pos.x}px` }"
      >
        <!-- Single note -->
        <template v-if="displayNotes.length === 1">
          <div class="preview-head">
            <span class="preview-dim" :style="{ color: dimensionColor(displayNotes[0].dimension) }">
              {{ dimensionLabel(displayNotes[0].dimension) }}
            </span>
            <span class="preview-type">{{ typeLabels[displayNotes[0].type] }}</span>
            <span class="preview-status" :class="'status-' + displayNotes[0].status">{{ statusLabels[displayNotes[0].status] }}</span>
          </div>
          <h4 class="preview-title">{{ displayNotes[0].title || displayNotes[0].file_name.replace('.md', '') }}</h4>
          <p v-if="displayNotes[0].content" class="preview-body">{{ truncate(displayNotes[0].content, 160) }}</p>
          <div class="preview-footer">
            <span class="preview-date">{{ displayNotes[0].date?.slice(0, 10) }}</span>
            <span v-if="displayNotes[0].due" class="preview-due">截止 {{ displayNotes[0].due?.slice(0, 10) }}</span>
          </div>
        </template>

        <!-- Multiple notes -->
        <template v-else>
          <div class="multi-head">
            <span class="multi-count">{{ notes!.length }} 条记录</span>
            <span v-if="notes!.length > 5" class="multi-more">显示前 5 条</span>
          </div>
          <div class="multi-list">
            <div v-for="n in displayNotes" :key="n.id" class="multi-item">
              <div class="multi-item-head">
                <span class="multi-status-dot" :class="'dot-' + n.status"></span>
                <span class="multi-title">{{ n.title || n.file_name.replace('.md', '') }}</span>
              </div>
              <p v-if="n.content" class="multi-content">{{ truncate(n.content, 80) }}</p>
              <div class="multi-meta">
                <span class="multi-type">{{ typeLabels[n.type] }}</span>
                <span v-if="n.priority" class="multi-priority" :class="'pri-' + n.priority">{{ priorityLabels[n.priority] }}</span>
                <span class="multi-date">{{ n.date?.slice(5, 10) }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Note } from '@lifeos/shared';
import { getDimensionColor, getDimensionLabel } from '../utils/dimensions';

const props = defineProps<{
  note?: Note | null;
  notes?: Note[] | null;
  preserveOrder?: boolean;
  visible: boolean;
  pos: { x: number; y: number };
}>();

const displayNotes = computed(() => {
  if (props.notes && props.notes.length > 0) {
    if (props.preserveOrder) {
      return props.notes.slice(0, 5);
    }

    return [...props.notes]
      .sort((left, right) => {
        const leftLabel = (left.title || left.file_name.replace('.md', '')).toLocaleLowerCase();
        const rightLabel = (right.title || right.file_name.replace('.md', '')).toLocaleLowerCase();
        return leftLabel.localeCompare(rightLabel, 'zh-CN');
      })
      .slice(0, 5);
  }
  if (props.note) return [props.note];
  return [];
});

const typeLabels: Record<string, string> = {
  task: '任务', schedule: '日程', note: '笔记', record: '记录',
  milestone: '里程碑', review: '复盘',
};

const statusLabels: Record<string, string> = {
  pending: '待办', in_progress: '进行中', done: '完成', cancelled: '取消',
};

const priorityLabels: Record<string, string> = {
  high: '高', medium: '中', low: '低',
};

function dimensionLabel(dimension: Note['dimension']) {
  return getDimensionLabel(dimension);
}

function dimensionColor(dimension: Note['dimension']) {
  return getDimensionColor(dimension);
}

function truncate(text: string, len: number) {
  const clean = text.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}
</script>

<style scoped>
.preview-card {
  position: fixed;
  z-index: 500;
  min-width: 280px;
  max-width: min(420px, 90vw);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 16px;
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  box-shadow: 0 24px 56px -20px var(--shadow-strong);
  backdrop-filter: blur(18px);
  pointer-events: none;
}

/* Single note */
.preview-head {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.preview-dim,
.preview-type,
.preview-status {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

.preview-type { background: var(--surface-muted); color: var(--text-secondary); }
.preview-status { background: var(--surface-muted); color: var(--text-muted); }
.status-pending { color: var(--signal) !important; }
.status-in_progress { color: var(--warn) !important; }
.status-done { color: var(--ok) !important; }

.preview-title {
  margin: 0 0 8px;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.preview-body {
  margin: 0 0 12px;
  font-size: 0.84rem;
  line-height: 1.65;
  color: var(--text-secondary);
  word-wrap: break-word;
}

.preview-footer {
  display: flex;
  gap: 10px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.preview-due { color: var(--warn); }

/* Multi note */
.multi-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.multi-count {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.multi-more {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.multi-list {
  display: grid;
  gap: 8px;
}

.multi-item {
  display: grid;
  gap: 5px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-muted) 80%, transparent);
}

.multi-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.multi-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dot-pending { background: var(--signal); }
.dot-in_progress { background: var(--warn); }
.dot-done { background: var(--ok); }
.dot-cancelled { background: var(--text-muted); }

.multi-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.multi-content {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
  padding-left: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.multi-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.multi-type {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
}

.multi-priority {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 999px;
}

.pri-high { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.pri-medium { background: color-mix(in srgb, var(--warn) 14%, transparent); color: var(--warn); }
.pri-low { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }

.multi-date {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-left: auto;
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
