<template>
  <section class="note-list">
    <div class="list-head">
      <div>
        <p class="list-kicker">Records</p>
        <h3>维度记录</h3>
      </div>
      <span class="list-badge">{{ notes.length }} entries</span>
    </div>

    <div v-if="notes.length === 0" class="empty-state">
      <p>当前筛选条件下暂无记录。</p>
    </div>

    <TransitionGroup v-else name="list" tag="div" class="note-grid">
      <article
        v-for="(note, index) in notes"
        :key="note.id"
        class="note-card"
        :class="'status-' + note.status"
        :style="{ '--stagger-index': index }"
        @mouseenter="(e) => showPreview(note, e)"
        @mouseleave="hidePreview"
        @mousemove="(e) => updatePreviewPos(e)"
      >
        <div class="card-main" @click="$emit('selectNote', note.id)">
          <div class="note-header">
            <h3 class="note-title">{{ note.file_name.replace('.md', '') }}</h3>
            <span class="note-type">{{ typeLabels[note.type] }}</span>
          </div>

          <div class="note-meta">
            <span class="note-date">{{ formatDate(note.date) }}</span>
            <span class="note-status" :class="'status-' + note.status">
              {{ statusLabels[note.status] }}
            </span>
            <span v-if="note.priority" class="note-priority" :class="'priority-' + note.priority">
              {{ priorityLabels[note.priority] }}
            </span>
          </div>

          <div v-if="note.tags && note.tags.length" class="note-tags">
            <span v-for="tag in note.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <div class="note-actions" @click.stop>
          <button
            v-if="note.status !== 'done'"
            @click="handleToggleDone(note)"
            class="btn-quick"
            :disabled="syncingNoteIds.includes(note.id)"
            title="标记完成"
          >标记完成</button>
          <button
            v-else
            @click="handleToggleDone(note)"
            class="btn-quick done"
            :disabled="syncingNoteIds.includes(note.id)"
            title="取消完成"
          >恢复待办</button>
        </div>
      </article>
    </TransitionGroup>
  </section>
  <NotePreview :note="previewNote" :visible="previewVisible" :pos="previewPos" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Note } from '@lifeos/shared';
import { updateNote } from '../api/client';
import NotePreview from './NotePreview.vue';

defineProps<{ notes: Note[] }>();
const emit = defineEmits<{ selectNote: [noteId: string]; refresh: [] }>();
const syncingNoteIds = ref<string[]>([]);

const previewNote = ref<Note | null>(null);
const previewVisible = ref(false);
const previewPos = ref({ x: 0, y: 0 });
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function showPreview(note: Note, e: MouseEvent) {
  if (hideTimer) clearTimeout(hideTimer);
  previewNote.value = note;
  updatePreviewPos(e);
  previewVisible.value = true;
}

function hidePreview() {
  hideTimer = setTimeout(() => { previewVisible.value = false; }, 120);
}

function updatePreviewPos(e: MouseEvent) {
  previewPos.value = {
    x: Math.min(e.clientX + 16, window.innerWidth - 300),
    y: Math.max(e.clientY - 60, 8),
  };
}

async function handleToggleDone(note: Note) {
  if (syncingNoteIds.value.includes(note.id)) {
    return;
  }
  const newStatus = note.status === 'done' ? 'pending' : 'done';
  syncingNoteIds.value = [...syncingNoteIds.value, note.id];
  try {
    await updateNote(note.id, { status: newStatus });
    emit('refresh');
  } catch (e) {
    console.error('Toggle failed:', e);
  } finally {
    syncingNoteIds.value = syncingNoteIds.value.filter((id) => id !== note.id);
  }
}

const typeLabels: Record<string, string> = {
  task: '任务',
  schedule: '日程',
  note: '笔记',
  record: '记录',
  milestone: '里程碑',
  review: '复盘',
};

const statusLabels: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  done: '完成',
  cancelled: '取消',
};

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

function formatDate(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<style scoped>
.note-list {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.list-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 18px;
}

.list-kicker {
  margin: 0 0 4px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.list-head h3 {
  margin: 0;
  font-size: 1.35rem;
}

.list-badge {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.empty-state {
  padding: 32px 20px;
  border-radius: 18px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  text-align: center;
}

.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  content-visibility: auto;
  contain-intrinsic-size: 720px;
}

.note-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.note-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 42px -34px var(--shadow-strong);
}

.note-card.status-pending {
  border-color: color-mix(in srgb, var(--signal) 28%, var(--border));
}

.note-card.status-in_progress {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--border));
}

.note-card.status-done {
  border-color: color-mix(in srgb, var(--ok) 28%, var(--border));
}

.card-main {
  display: grid;
  gap: 12px;
  cursor: pointer;
}

.note-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: start;
}

.note-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.45;
}

.note-type,
.note-status,
.note-priority,
.tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
}

.note-type {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.note-meta,
.note-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.note-date {
  color: var(--text-muted);
  font-size: 0.82rem;
  padding-top: 4px;
}

.note-status.status-pending {
  background: color-mix(in srgb, var(--signal-soft) 78%, transparent);
  color: var(--signal);
}

.note-status.status-in_progress {
  background: color-mix(in srgb, var(--warn) 14%, transparent);
  color: var(--warn);
}

.note-status.status-done {
  background: color-mix(in srgb, var(--ok) 14%, transparent);
  color: var(--ok);
}

.note-status.status-cancelled {
  background: var(--surface-muted);
  color: var(--text-muted);
}

.note-priority.priority-high {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.note-priority.priority-medium {
  background: color-mix(in srgb, var(--warn) 14%, transparent);
  color: var(--warn);
}

.note-priority.priority-low {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}

.tag {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.note-actions {
  display: flex;
}

.btn-quick {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--ok) 28%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  color: var(--ok);
  cursor: pointer;
}

.btn-quick.done {
  border-color: var(--border);
  background: var(--surface-muted);
  color: var(--text-secondary);
}

@media (max-width: 720px) {
  .note-list {
    padding: 20px;
    border-radius: 24px;
  }

  .list-head {
    flex-direction: column;
  }
}

/* List animations */
.list-enter-active {
  transition: all 0.3s ease;
  transition-delay: calc(var(--stagger-index, 0) * 50ms);
}

.list-leave-active {
  transition: all 0.2s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-move {
  transition: transform 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .list-enter-active,
  .list-leave-active,
  .list-move {
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
}
</style>
