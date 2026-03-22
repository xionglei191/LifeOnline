<template>
  <section class="calendar-grid">
    <div class="weekday-header">
      <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
    </div>
    <div class="calendar-body">
      <div
        v-for="day in calendarDays"
        :key="day.date"
        class="calendar-cell"
        :class="{
          'has-notes': day.count > 0,
          'is-today': isToday(day.date),
          'is-selected': day.date === selectedDate
        }"
        @click="handleSelectDay(day)"
        @mouseenter="day.count > 0 ? onCellEnter(day, $event) : null"
        @mouseleave="onCellLeave"
      >
        <div class="day-number">{{ getDayNumber(day.date) }}</div>

        <!-- Schedule/Task items -->
        <div v-if="day.count > 0" class="day-items">
          <div
            v-for="note in getDisplayItems(day.notes)"
            :key="note.id"
            class="day-item"
            :class="'item-' + note.type"
          >
            <span class="item-dot" :class="'dot-' + note.status"></span>
            <span class="item-text">{{ note.title || note.file_name.replace('.md', '') }}</span>
          </div>
          <div v-if="day.count > 3" class="day-item-more">+{{ day.count - 3 }} 更多</div>
        </div>

        <div v-if="day.count > 0" class="note-badge">{{ day.count }}</div>
      </div>
    </div>

    <NotePreview :notes="previewNotes" :preserve-order="true" :visible="previewVisible" :pos="previewPos" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CalendarData, CalendarDay, Note } from '@lifeos/shared';
import NotePreview from './NotePreview.vue';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import { sortCalendarNotes } from '../utils/noteOrdering';

const props = defineProps<{
  calendarData: CalendarData;
}>();

const emit = defineEmits<{
  selectDay: [date: string];
  selectNote: [noteId: string];
}>();

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const selectedDate = ref<string | null>(null);

// Preview
const previewNotes = ref<Note[]>([]);
const previewVisible = ref(false);
const previewPos = ref({ x: 0, y: 0 });
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function onCellEnter(day: CalendarDay, e: MouseEvent) {
  if (hideTimer) clearTimeout(hideTimer);
  if (day.notes.length === 0) return;

  previewNotes.value = sortCalendarNotes(day.notes);

  // Calculate preview dimensions
  const previewWidth = 320;
  const previewHeight = day.notes.length > 1 ? Math.min(day.notes.length * 90 + 80, 500) : 200;

  // Calculate position
  let x = e.clientX + 16;
  if (x + previewWidth > window.innerWidth) {
    x = e.clientX - previewWidth - 16;
  }
  x = Math.max(8, Math.min(x, window.innerWidth - previewWidth - 8));

  let y = e.clientY - 80;
  if (y + previewHeight > window.innerHeight - 20) {
    y = window.innerHeight - previewHeight - 20;
  }
  y = Math.max(8, y);

  previewPos.value = { x, y };
  previewVisible.value = true;
}

function onCellLeave() {
  hideTimer = setTimeout(() => { previewVisible.value = false; }, 150);
}

const calendarDays = computed(() => {
  const firstDay = new Date(props.calendarData.year, props.calendarData.month - 1, 1);
  const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const days: CalendarDay[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyDate = new Date(firstDay);
    emptyDate.setDate(emptyDate.getDate() - (startDayOfWeek - i));
    days.push({
      date: formatLocalDate(emptyDate),
      notes: [],
      count: 0,
    });
  }

  days.push(...props.calendarData.days);

  return days;
});

function getDayNumber(date: string) {
  return parseLocalDate(date).getDate();
}

function isToday(date: string) {
  const today = formatLocalDate(new Date());
  return date === today;
}

function getDisplayItems(notes: Note[]) {
  return sortCalendarNotes(notes).slice(0, 3);
}

function handleSelectDay(day: CalendarDay) {
  if (day.count > 0) {
    selectedDate.value = day.date;
    emit('selectDay', day.date);
  }
}
</script>

<style scoped>
.calendar-grid {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.weekday {
  text-align: center;
  font-weight: 700;
  font-size: 0.84rem;
  color: var(--text-muted);
  padding: 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.calendar-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
}

.calendar-cell {
  aspect-ratio: 1.4 / 1;
  min-height: 120px;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 12px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.calendar-cell:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--signal) 34%, var(--border));
  background: color-mix(in srgb, var(--signal-soft) 72%, transparent);
}

.calendar-cell.has-notes {
  background: color-mix(in srgb, var(--accent-soft) 58%, transparent);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
}

.calendar-cell.is-today {
  border-color: color-mix(in srgb, var(--signal) 46%, var(--border));
}

.calendar-cell.is-selected {
  background: color-mix(in srgb, var(--signal-soft) 88%, transparent);
  border-color: color-mix(in srgb, var(--signal) 46%, var(--border));
}

.day-number {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.day-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.day-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  font-size: 0.78rem;
  line-height: 1.3;
  overflow: hidden;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.day-item:hover {
  background: color-mix(in srgb, var(--surface) 95%, transparent);
}

.item-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.item-dot.dot-pending {
  background: var(--signal);
}

.item-dot.dot-in_progress {
  background: var(--warn);
}

.item-dot.dot-done {
  background: var(--ok);
  opacity: 0.6;
}

.item-dot.dot-cancelled {
  background: var(--text-muted);
  opacity: 0.4;
}

.item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-weight: 500;
}

.day-item.item-schedule .item-text {
  color: var(--accent);
  font-weight: 600;
}

.day-item.item-task .item-text {
  color: var(--text);
}

.day-item.item-milestone .item-text {
  color: var(--warn);
  font-weight: 600;
}

.day-item-more {
  font-size: 0.65rem;
  color: var(--text-muted);
  padding: 2px 5px;
  text-align: center;
  flex-shrink: 0;
}

.note-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--signal);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
}

.calendar-cell.is-selected .note-badge {
  background: color-mix(in srgb, var(--surface-strong) 92%, transparent);
  color: var(--signal);
}

@media (max-width: 720px) {
  .calendar-grid {
    padding: 14px;
    border-radius: 24px;
  }

  .weekday-header,
  .calendar-body {
    gap: 6px;
  }

  .calendar-cell {
    min-height: 64px;
    border-radius: 14px;
    padding: 8px;
  }

  .weekday {
    font-size: 0.72rem;
    padding: 6px 0;
  }

  .day-number {
    font-size: 0.9rem;
  }

  .note-badge {
    top: 6px;
    right: 6px;
    min-width: 20px;
    height: 20px;
    font-size: 0.64rem;
  }
}
</style>
