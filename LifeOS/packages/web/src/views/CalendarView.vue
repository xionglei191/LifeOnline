<template>
  <div class="calendar-view">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Calendar Surface</p>
        <h2>把事件密度、活跃日期和<span>日常节律</span>放回日历坐标。</h2>
      </div>
      <div class="controls">
        <button @click="prevMonth">&lt; 上月</button>
        <span class="month-label">{{ year }}年{{ month }}月</span>
        <button @click="nextMonth">下月 &gt;</button>
      </div>
    </section>

    <StateDisplay v-if="loading" type="loading" message="正在展开当月记录..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <div v-else-if="data" class="calendar-content">
      <CalendarGrid
        :calendar-data="data"
        @select-day="handleSelectDay"
        @select-note="handleSelectNote"
      />

      <section v-if="selectedDay" class="day-notes">
        <div class="day-head">
          <div>
            <p class="day-kicker">Daily Records</p>
            <h3>{{ selectedDay }}</h3>
          </div>
          <span class="day-count">{{ getDayNotes(selectedDay).length }} entries</span>
        </div>

        <div class="note-list">
          <div
            v-for="note in getDayNotes(selectedDay)"
            :key="note.id"
            class="note-item"
            @click="handleSelectNote(note.id)"
          >
            <div class="note-item-head">
              <span class="note-status-dot" :class="'dot-' + note.status"></span>
              <span class="note-title">{{ note.title || note.file_name.replace('.md', '') }}</span>
            </div>
            <p v-if="noteBodyPreview(note)" class="note-content">{{ noteBodyPreview(note) }}</p>
            <div class="note-meta">
              <span class="note-type">{{ getTypeLabel(note.type) }}</span>
              <span v-if="note.priority" class="note-priority" :class="'pri-' + note.priority">{{ getPriorityLabel(note.priority) }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <NoteDetail :note-id="selectedNoteId" @close="selectedNoteId = null" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useCalendar } from '../composables/useCalendar';
import CalendarGrid from '../components/CalendarGrid.vue';
import NoteDetail from '../components/NoteDetail.vue';
import StateDisplay from '../components/StateDisplay.vue';
import { sortCalendarNotes } from '../utils/noteOrdering';

const { data, loading, error, selectedDay, load } = useCalendar();

const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const selectedNoteId = ref<string | null>(null);

watch([year, month], ([nextYear, nextMonth], [prevYear, prevMonth]) => {
  if (nextYear === prevYear && nextMonth === prevMonth) return;
  selectedNoteId.value = null;
  load(nextYear, nextMonth);
}, { immediate: true });

function prevMonth() {
  if (month.value === 1) {
    year.value--;
    month.value = 12;
  } else {
    month.value--;
  }
}

function nextMonth() {
  if (month.value === 12) {
    year.value++;
    month.value = 1;
  } else {
    month.value++;
  }
}

function handleSelectDay(date: string) {
  selectedDay.value = date;
}

function handleSelectNote(noteId: string) {
  selectedNoteId.value = noteId;
}

async function handleDeleted() {
  selectedNoteId.value = null;
  await load(year.value, month.value);
}

function getDayNotes(date: string) {
  const notes = data.value?.days.find((d) => d.date === date)?.notes || [];
  return sortCalendarNotes(notes);
}

function noteBodyPreview(note: { content?: string; privacy?: string; encrypted?: boolean }) {
  if (note.encrypted) {
    return '🔒 内容已加密，预览已隐藏';
  }
  if (note.privacy === 'private' || note.privacy === 'sensitive') {
    return '🔒 当前内容受隐私保护，预览已隐藏';
  }
  if (!note.content) {
    return '';
  }
  return truncateContent(note.content, 100);
}

function truncateContent(text: string, len: number) {
  const clean = text.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    task: '任务', schedule: '日程', note: '笔记', record: '记录',
    milestone: '里程碑', review: '复盘',
  };
  return labels[type] || type;
}

function getPriorityLabel(priority: string) {
  const labels: Record<string, string> = {
    high: '高', medium: '中', low: '低',
  };
  return labels[priority] || priority;
}
</script>

<style scoped>
.calendar-view {
  display: grid;
  gap: 20px;
  padding: 8px 0 32px;
}

.hero-panel,
.day-notes {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 24px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 86% 18%, color-mix(in srgb, var(--accent-soft) 78%, transparent), transparent 18%),
    color-mix(in srgb, var(--surface-strong) 90%, transparent);
}

.eyebrow,
.day-kicker {
  margin: 0 0 6px;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero-copy h2,
.day-head h3 {
  margin: 0;
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
}

.hero-copy h2 {
  font-size: clamp(1.52rem, 1.3rem + 0.82vw, 2.08rem);
  line-height: 1.1;
  font-weight: 650;
}

.hero-copy h2 span {
  color: var(--accent-strong);
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.controls button {
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--signal) 30%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--signal-soft) 78%, transparent);
  color: var(--signal);
  cursor: pointer;
}

.month-label {
  min-width: 132px;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
}

.calendar-content {
  display: grid;
  gap: 20px;
}

.day-notes {
  padding: 24px;
  border-radius: 28px;
}

.day-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 16px;
}

.day-count {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.note-list {
  display: grid;
  gap: 10px;
}

.note-item {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  cursor: pointer;
  display: grid;
  gap: 8px;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.note-item:hover {
  background: color-mix(in srgb, var(--signal-soft) 80%, transparent);
  border-color: var(--signal);
}

.note-item-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.note-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.note-status-dot.dot-pending {
  background: var(--signal);
}

.note-status-dot.dot-in_progress {
  background: var(--warn);
}

.note-status-dot.dot-done {
  background: var(--ok);
}

.note-status-dot.dot-cancelled {
  background: var(--text-muted);
}

.note-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.4;
}

.note-content {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
  padding-left: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.note-meta {
  display: flex;
  gap: 8px;
  padding-left: 18px;
}

.note-type,
.note-priority {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.74rem;
  font-weight: 600;
}

.note-priority.pri-high {
  background: color-mix(in srgb, var(--signal) 20%, var(--surface-muted));
  color: var(--signal);
}

.note-priority.pri-medium {
  background: color-mix(in srgb, var(--warn) 20%, var(--surface-muted));
  color: var(--warn);
}

.note-priority.pri-low {
  background: var(--surface-muted);
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .hero-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero-panel,
  .day-notes {
    padding: 20px;
    border-radius: 24px;
  }

  .day-head,
  .note-item {
    flex-direction: column;
    align-items: start;
  }
}
</style>
