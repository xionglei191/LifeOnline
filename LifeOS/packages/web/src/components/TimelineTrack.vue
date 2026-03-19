<template>
  <div class="orbit-timeline" ref="containerRef">
    <!-- Date ruler -->
    <div class="ruler-row">
      <div class="ruler-spacer"></div>
      <div class="ruler">
        <div
          v-for="tick in ticks"
          :key="tick.label"
          class="ruler-cell"
          :class="{ today: tick.isToday, weekend: tick.isWeekend }"
          :style="{ left: `${tick.pct}%`, width: `${tick.widthPct}%` }"
        >
          <span class="ruler-day">{{ tick.label }}</span>
          <span v-if="tick.sub" class="ruler-wd">{{ tick.sub }}</span>
        </div>
      </div>
    </div>

    <!-- 8 tracks -->
    <div class="tracks-wrap">
      <!-- Labels -->
      <div class="labels">
        <div
          v-for="track in tracks"
          :key="track.dimension"
          class="label"
          :style="{ '--dim-color': dimColor(track.dimension) }"
        >
          <span class="label-name">{{ dimLabel(track.dimension) }}</span>
          <span class="label-count">{{ track.notes.length }}</span>
        </div>
      </div>

      <!-- Track area -->
      <div class="tracks">
        <div
          v-for="track in tracks"
          :key="track.dimension"
          class="track"
          :style="{ '--dim-color': dimColor(track.dimension) }"
        >
          <div class="track-line"></div>

          <!-- Group notes by tick bucket -->
          <template v-for="bucket in getBuckets(track)" :key="bucket.key">
            <button
              class="dot"
              :class="bucketDotClass(bucket.notes)"
              :style="{ left: `calc(${bucket.pct}% - 12px)` }"
              @mouseenter="(e) => onDotEnter(bucket.notes, e)"
              @mouseleave="onDotLeave"
              @click="onDotClick(bucket.notes)"
            >
              <span v-if="bucket.notes.length > 1" class="dot-count">{{ bucket.notes.length }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Preview -->
    <NotePreview :notes="previewNotes" :visible="previewVisible" :pos="previewPos" />

    <!-- Multi-note picker -->
    <Teleport to="body">
      <Transition name="picker-fade">
        <div v-if="pickerNotes.length > 1" class="picker-overlay" @click.self="pickerNotes = []">
          <div class="note-picker" :style="{ top: `${pickerPos.y}px`, left: `${pickerPos.x}px` }">
            <button
              v-for="note in pickerNotes"
              :key="note.id"
              class="picker-item"
              @click="$emit('selectNote', note.id); pickerNotes = []"
            >
              <div class="picker-item-head">
                <span class="picker-status-dot" :class="'dot-' + note.status"></span>
                <span class="picker-title">{{ note.title || note.file_name.replace('.md', '') }}</span>
              </div>
              <p v-if="note.content" class="picker-content">{{ truncateContent(note.content, 80) }}</p>
              <div class="picker-meta">
                <span class="picker-type">{{ getTypeLabel(note.type) }}</span>
                <span class="picker-date">{{ note.date?.slice(5, 10) }}</span>
              </div>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { TimelineTrack, Note } from '@lifeos/shared';
import NotePreview from './NotePreview.vue';

const props = defineProps<{
  tracks: TimelineTrack[];
  startDate: string;
  endDate: string;
}>();

const emit = defineEmits<{ selectNote: [noteId: string] }>();

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(800);

// Track container width for responsive scaling
function updateWidth() {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth - 120; // subtract label width
  }
}

onMounted(() => {
  updateWidth();
  window.addEventListener('resize', updateWidth);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth);
});

// Total days in range
const totalDays = computed(() => {
  const start = new Date(props.startDate);
  const end = new Date(props.endDate);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
});

// Choose tick interval based on total days and available width
// Target: ~60-80px per tick label minimum
const tickInterval = computed(() => {
  const days = totalDays.value;
  const w = containerWidth.value;
  const minTickPx = 64;
  const maxTicks = Math.floor(w / minTickPx);

  if (days <= maxTicks) return 1;           // every day
  if (days / 2 <= maxTicks) return 2;       // every 2 days
  if (days / 3 <= maxTicks) return 3;       // every 3 days
  if (days / 5 <= maxTicks) return 5;       // every 5 days
  if (days / 7 <= maxTicks) return 7;       // weekly
  if (days / 10 <= maxTicks) return 10;     // every 10 days
  if (days / 14 <= maxTicks) return 14;     // bi-weekly
  return Math.ceil(days / maxTicks);        // auto
});

// All dates in range
const allDates = computed(() => {
  const dates: string[] = [];
  const d = new Date(props.startDate);
  const end = new Date(props.endDate);
  while (d <= end) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
});

// Convert date to percentage position
function dateToPct(date: string): number {
  const idx = allDates.value.indexOf(date);
  if (idx < 0) return 0;
  return (idx / (totalDays.value - 1)) * 100;
}

// Tick marks for ruler
interface Tick {
  label: string;
  sub: string;
  pct: number;
  widthPct: number;
  isToday: boolean;
  isWeekend: boolean;
}

const ticks = computed((): Tick[] => {
  const result: Tick[] = [];
  const interval = tickInterval.value;
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < allDates.value.length; i += interval) {
    const date = allDates.value[i];
    const d = new Date(date);
    const pct = dateToPct(date);
    const nextIdx = Math.min(i + interval, allDates.value.length - 1);
    const nextPct = dateToPct(allDates.value[nextIdx]);
    const widthPct = nextPct - pct || (100 / Math.ceil(totalDays.value / interval));

    let label = '';
    let sub = '';

    if (interval === 1) {
      label = date.slice(8); // day number
      sub = ['日','一','二','三','四','五','六'][d.getDay()];
    } else if (interval <= 7) {
      label = `${d.getMonth() + 1}/${d.getDate()}`;
      sub = ['日','一','二','三','四','五','六'][d.getDay()];
    } else {
      label = `${d.getMonth() + 1}/${d.getDate()}`;
      sub = '';
    }

    result.push({
      label,
      sub,
      pct,
      widthPct,
      isToday: date === today,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return result;
});

// Group notes into tick buckets for each track
interface Bucket {
  key: string;
  pct: number;
  notes: Note[];
}

function getBuckets(track: TimelineTrack): Bucket[] {
  const interval = tickInterval.value;
  const bucketMap = new Map<number, Note[]>();

  for (const note of track.notes) {
    const dateStr = note.date?.slice(0, 10);
    if (!dateStr) continue;
    const idx = allDates.value.indexOf(dateStr);
    if (idx < 0) continue;
    const bucketIdx = Math.floor(idx / interval) * interval;
    if (!bucketMap.has(bucketIdx)) bucketMap.set(bucketIdx, []);
    bucketMap.get(bucketIdx)!.push(note);
  }

  return [...bucketMap.entries()].map(([idx, notes]) => ({
    key: String(idx),
    pct: dateToPct(allDates.value[Math.min(idx + Math.floor(interval / 2), allDates.value.length - 1)]),
    notes,
  }));
}

function bucketDotClass(notes: Note[]) {
  const statuses = notes.map(n => n.status);
  if (statuses.every(s => s === 'done')) return 'dot-done';
  if (statuses.some(s => s === 'in_progress')) return 'dot-active';
  if (statuses.some(s => s === 'pending')) return 'dot-pending';
  return 'dot-muted';
}

const dimensionLabels: Record<string, string> = {
  health: '健康', career: '事业', finance: '财务', learning: '学习',
  relationship: '关系', life: '生活', hobby: '兴趣', growth: '成长',
};

const dimensionColors: Record<string, string> = {
  health: 'var(--dim-health)', career: 'var(--dim-career)',
  finance: 'var(--dim-finance)', learning: 'var(--dim-learning)',
  relationship: 'var(--dim-relationship)', life: 'var(--dim-life)',
  hobby: 'var(--dim-hobby)', growth: 'var(--dim-growth)',
};

const dimLabel = (d: string) => dimensionLabels[d] || d;
const dimColor = (d: string) => dimensionColors[d] || 'var(--signal)';

// Preview
const previewNotes = ref<Note[]>([]);
const previewVisible = ref(false);
const previewPos = ref({ x: 0, y: 0 });
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function onDotEnter(notes: Note[], e: MouseEvent) {
  if (hideTimer) clearTimeout(hideTimer);
  previewNotes.value = notes;

  // Calculate preview dimensions (estimate)
  const previewWidth = 320;
  const previewHeight = notes.length > 1 ? Math.min(notes.length * 90 + 80, 500) : 200;

  // Calculate x position (keep within viewport)
  let x = e.clientX + 16;
  if (x + previewWidth > window.innerWidth) {
    x = e.clientX - previewWidth - 16; // Show on left side
  }
  x = Math.max(8, Math.min(x, window.innerWidth - previewWidth - 8));

  // Calculate y position (keep within viewport)
  let y = e.clientY - 80;
  if (y + previewHeight > window.innerHeight - 20) {
    y = window.innerHeight - previewHeight - 20; // Adjust to fit
  }
  y = Math.max(8, y);

  previewPos.value = { x, y };
  previewVisible.value = true;
}

function onDotLeave() {
  hideTimer = setTimeout(() => { previewVisible.value = false; }, 150);
}

// Helper functions
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

// Multi-note picker
const pickerNotes = ref<Note[]>([]);
const pickerPos = ref({ x: 0, y: 0 });

function onDotClick(notes: Note[]) {
  if (notes.length === 1) {
    emit('selectNote', notes[0].id);
  } else {
    pickerNotes.value = notes;
    pickerPos.value = { x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 - 80 };
  }
}
</script>

<style scoped>
.orbit-timeline {
  overflow: hidden;
  border-radius: 30px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

/* Ruler */
.ruler-row {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  position: sticky;
  top: 0;
  z-index: 10;
}

.ruler-spacer {
  flex-shrink: 0;
  width: 120px;
  border-right: 1px solid var(--border);
}

.ruler {
  position: relative;
  flex: 1;
  height: 48px;
}

.ruler-cell {
  position: absolute;
  top: 0;
  bottom: 0;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  border-right: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  overflow: hidden;
}

.ruler-cell.today {
  background: color-mix(in srgb, var(--signal-soft) 70%, transparent);
}

.ruler-cell.weekend {
  background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
}

.ruler-day {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.ruler-wd {
  font-size: 0.68rem;
  color: var(--text-muted);
}

/* Tracks */
.tracks-wrap {
  display: flex;
}

.labels {
  flex-shrink: 0;
  width: 120px;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
}

.label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.label:last-child { border-bottom: none; }

.label-name {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--dim-color);
}

.label-count {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dim-color) 14%, transparent);
  color: var(--dim-color);
  font-weight: 700;
}

.tracks {
  flex: 1;
  position: relative;
}

.track {
  position: relative;
  height: 56px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.track:last-child { border-bottom: none; }

.track-line {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: color-mix(in srgb, var(--dim-color) 22%, var(--border));
  transform: translateY(-50%);
}

/* Dots */
.dot {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid var(--dim-color);
  background: color-mix(in srgb, var(--dim-color) 18%, var(--surface-strong));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  z-index: 2;
}

.dot:hover {
  transform: translateY(-50%) scale(1.4);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dim-color) 22%, transparent);
  z-index: 3;
}

.dot-done {
  background: color-mix(in srgb, var(--ok) 28%, var(--surface-strong));
  border-color: var(--ok);
}

.dot-active {
  background: color-mix(in srgb, var(--warn) 28%, var(--surface-strong));
  border-color: var(--warn);
}

.dot-pending {
  background: color-mix(in srgb, var(--signal) 22%, var(--surface-strong));
  border-color: var(--signal);
}

.dot-muted {
  background: var(--surface-muted);
  border-color: var(--border-strong);
}

.dot-count {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--dim-color);
  line-height: 1;
  text-align: center;
}

/* Note picker */
.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 599;
}

.note-picker {
  position: fixed;
  z-index: 600;
  min-width: 320px;
  max-width: 420px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  box-shadow: 0 24px 56px -20px var(--shadow-strong);
  backdrop-filter: blur(18px);
  display: grid;
  gap: 6px;
}

.picker-item {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
  display: grid;
  gap: 6px;
}

.picker-item:hover {
  background: color-mix(in srgb, var(--signal-soft) 80%, transparent);
  border-color: var(--signal);
}

.picker-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.picker-status-dot.dot-pending { background: var(--signal); }
.picker-status-dot.dot-in_progress { background: var(--warn); }
.picker-status-dot.dot-done { background: var(--ok); }
.picker-status-dot.dot-cancelled { background: var(--text-muted); }

.picker-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
}

.picker-content {
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

.picker-meta {
  display: flex;
  gap: 8px;
  padding-left: 16px;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.picker-type,
.picker-date {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-muted);
}

.picker-item:hover {
  background: color-mix(in srgb, var(--signal-soft) 80%, transparent);
  border-color: var(--signal);
}

.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (max-width: 720px) {
  .labels { width: 72px; }
  .ruler-spacer { width: 72px; }
  .label-name { font-size: 0.72rem; }
  .label-count { display: none; }
}
</style>
