<template>
  <div class="timeline-view">
    <div class="page-shell">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Life Tracks</p>
          <h2>把分散的人生事件拉回<span>同一条时间坐标</span>。</h2>
          <p class="hero-summary">
            当前窗口覆盖 {{ spanDays }} 天，共检索到 {{ totalNotes }} 条事件记录，
            {{ busiestLabel }} 有 {{ busiestCount }} 条记录，是这段时间记录最密集的维度。
          </p>
        </div>

        <div class="hero-metrics">
          <article class="metric">
            <span class="metric-label">窗口跨度</span>
            <strong>{{ spanDays }}</strong>
            <span class="metric-meta">当前视图覆盖天数</span>
          </article>
          <article class="metric">
            <span class="metric-label">总事件数</span>
            <strong>{{ totalNotes }}</strong>
            <span class="metric-meta">窗口内检索到的记录</span>
          </article>
          <article class="metric accent">
            <span class="metric-label">记录最密集维度</span>
            <strong>{{ busiestLabel }}</strong>
            <span class="metric-meta">{{ busiestCount }} 条记录</span>
          </article>
        </div>
      </section>

      <section class="controls-panel">
        <div class="controls-copy">
          <p class="eyebrow">Time Window</p>
          <h3>调整观测窗口</h3>
        </div>

        <div class="controls">
          <label class="field">
            <span>起点</span>
            <input type="date" v-model="startDate" />
          </label>
          <label class="field">
            <span>终点</span>
            <input type="date" v-model="endDate" />
          </label>
          <button class="refresh-btn" @click="loadData">刷新轨道</button>
        </div>
      </section>

      <StateDisplay v-if="loading" type="loading" message="正在校准生命轨道..." />
      <StateDisplay v-else-if="error" type="error" :message="error.message" />
      <TimelineTrack
        v-else-if="data"
        :tracks="data.tracks"
        :start-date="data.startDate"
        :end-date="data.endDate"
        @select-note="handleSelectNote"
      />
    </div>

    <NoteDetail :note-id="selectedNoteId" @close="selectedNoteId = null" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTimeline } from '../composables/useTimeline';
import TimelineTrack from '../components/TimelineTrack.vue';
import NoteDetail from '../components/NoteDetail.vue';
import StateDisplay from '../components/StateDisplay.vue';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import { getDimensionLabel } from '../utils/dimensions';

const { data, loading, error, load } = useTimeline();

const now = new Date();
const startDate = ref(formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
const endDate = ref(formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
const selectedNoteId = ref<string | null>(null);

watch([startDate, endDate], ([start, end], [prevStart, prevEnd]) => {
  if (start === prevStart && end === prevEnd) return;
  selectedNoteId.value = null;
  load(start, end);
}, { immediate: true });

const spanDays = computed(() => {
  if (!data.value) return 0;
  const start = parseLocalDate(data.value.startDate);
  const end = parseLocalDate(data.value.endDate);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
});

const totalNotes = computed(() => {
  return data.value?.tracks.reduce((sum, track) => sum + track.notes.length, 0) ?? 0;
});

const busiestTrack = computed(() => {
  const tracks = data.value?.tracks ?? [];
  return tracks.reduce((best, track) => {
    if (!best || track.notes.length > best.notes.length) return track;
    return best;
  }, tracks[0]);
});

const busiestLabel = computed(() => {
  if (!busiestTrack.value) return '暂无';
  return getDimensionLabel(busiestTrack.value.dimension);
});

const busiestCount = computed(() => busiestTrack.value?.notes.length ?? 0);

function loadData() {
  load(startDate.value, endDate.value);
}

function handleSelectNote(noteId: string) {
  selectedNoteId.value = noteId;
}

async function handleDeleted() {
  selectedNoteId.value = null;
  await load(startDate.value, endDate.value);
}
</script>

<style scoped>
.timeline-view {
  padding: 8px 0 32px;
}

.page-shell {
  display: grid;
  gap: 20px;
}

.hero-panel,
.controls-panel,
.timeline-panel,
.state-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.9fr);
  gap: 22px;
  padding: 28px;
  border-radius: 32px;
  background:
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--accent-soft) 82%, transparent), transparent 18%),
    linear-gradient(140deg, color-mix(in srgb, var(--signal-soft) 52%, transparent), transparent 32%),
    color-mix(in srgb, var(--surface-strong) 92%, transparent);
}

.hero-copy {
  display: grid;
  gap: 14px;
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero-copy h2,
.controls-copy h3 {
  margin: 0;
  font-family: "Avenir Next Condensed", "DIN Alternate", "PingFang SC", sans-serif;
}

.hero-copy h2 {
  max-width: 17ch;
  font-size: clamp(1.62rem, 1.34rem + 1.1vw, 2.3rem);
  line-height: 1.08;
  font-weight: 650;
}

.hero-copy h2 span {
  color: var(--signal);
}

.hero-summary {
  margin: 0;
  max-width: 56ch;
  color: var(--text-secondary);
  font-size: 0.97rem;
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

.controls-panel {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 22px 24px;
  border-radius: 28px;
}

.controls-copy {
  display: grid;
  gap: 4px;
}

.controls {
  display: flex;
  gap: 12px;
  align-items: end;
  flex-wrap: wrap;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.field input {
  min-width: 168px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--text);
}

.refresh-btn {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid color-mix(in srgb, var(--signal) 34%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--signal-soft) 78%, transparent);
  color: var(--signal);
  font-weight: 600;
  cursor: pointer;
}

.timeline-panel {
  overflow: hidden;
  border-radius: 30px;
}


@media (max-width: 1024px) {
  .hero-panel,
  .controls-panel {
    grid-template-columns: 1fr;
    display: grid;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero-panel,
  .controls-panel {
    padding: 20px;
    border-radius: 24px;
  }

  .field input {
    min-width: 0;
    width: 100%;
  }

  .controls {
    width: 100%;
  }
}
</style>
