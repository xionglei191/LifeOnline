<template>
  <div class="pa-card" :class="[`type-${action.type}`, { expanded }]">
    <div class="pa-header" @click="expanded = !expanded">
      <span class="pa-type-icon">{{ typeIcon }}</span>
      <div class="pa-info">
        <strong class="pa-title">
          {{ action.title }}
          <span v-if="conflictCount > 0" class="conflict-badge">⚠️ 冲突({{ conflictCount }})</span>
        </strong>
        <span class="pa-desc">{{ action.description }}</span>
      </div>
      <span class="pa-expand-icon">{{ expanded ? '▾' : '▸' }}</span>
    </div>

    <template v-if="expanded">
      <DryRunPreview v-if="action.dryRunPreview" :preview="action.dryRunPreview" :action-type="action.type" />
      
      <div v-if="conflictLoading" class="conflict-panel loading">
        <span class="conflict-label">正在检查日程冲突...</span>
      </div>

      <div v-else-if="conflictCount > 0" class="conflict-panel">
        <div class="conflict-header">
          <span class="conflict-icon">⚠️</span>
          <span class="conflict-label">日程冲突警告 (那天你已有安排)</span>
        </div>

        <!-- Mini Timeline Bar -->
        <div class="timeline-bar-container">
          <div class="timeline-bar">
            <div class="timeline-hours">
              <span v-for="h in timelineHours" :key="h" class="hour-tick" :style="{ left: hourToPercent(h) + '%' }">
                {{ h }}:00
              </span>
            </div>
            <div class="timeline-track">
              <!-- Existing events (blue) -->
              <div
                v-for="c in conflicts"
                :key="'existing-' + c.id"
                class="timeline-block existing"
                :style="blockStyle(c.startTime, c.endTime)"
                :title="c.title + ' · ' + formatTime(c.startTime) + '-' + formatTime(c.endTime)"
              ></div>
              <!-- Proposed event (orange, or red if overlapping) -->
              <div
                v-if="proposedStart && proposedEnd"
                class="timeline-block proposed"
                :class="{ overlapping: conflictCount > 0 }"
                :style="blockStyle(proposedStart, proposedEnd)"
                :title="action.title + ' (待审批)'"
              ></div>
            </div>
          </div>
          <div class="timeline-legend">
            <span class="legend-item"><span class="dot existing"></span> 已有日程</span>
            <span class="legend-item"><span class="dot proposed"></span> 待审批</span>
            <span class="legend-item"><span class="dot overlapping"></span> 时间冲突</span>
          </div>
        </div>

        <div class="conflict-list">
          <div v-for="c in conflicts" :key="c.id" class="conflict-item">
            <span class="c-time">{{ formatTime(c.startTime) }} - {{ formatTime(c.endTime) }}</span>
            <span class="c-title">{{ c.title }}</span>
          </div>
        </div>
      </div>
    </template>

    <div class="pa-actions">
      <label class="auto-approve-check">
        <input type="checkbox" v-model="autoApproveNext" />
        <span>下次同类自动放行</span>
      </label>
      <div class="pa-btns">
        <button class="btn-reject" @click="$emit('reject', action.id)" :disabled="acting">🚫 拒绝</button>
        <button class="btn-approve" @click="$emit('approve', action.id, autoApproveNext)" :disabled="acting">✅ 授权</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PhysicalAction, CalendarEventPayload } from '@lifeos/shared';
import type { ConflictEvent } from '../api/client';
import { fetchConflictsForAction } from '../api/client';
import DryRunPreview from './DryRunPreview.vue';

const props = defineProps<{
  action: PhysicalAction;
  acting?: boolean;
}>();

defineEmits<{
  (e: 'approve', id: string, autoApproveNext: boolean): void;
  (e: 'reject', id: string): void;
}>();

const expanded = ref(false);
const autoApproveNext = ref(false);
const conflicts = ref<ConflictEvent[]>([]);
const conflictLoading = ref(false);

const TYPE_ICONS: Record<string, string> = {
  calendar_event: '📅',
  send_email: '📧',
  webhook_call: '🔗',
  iot_command: '🏠',
};
const typeIcon = TYPE_ICONS[props.action.type] || '⚡';

// ── Conflict Detection via API ────────────────────────────
watch(expanded, async (isExpanded) => {
  if (isExpanded && props.action.type === 'calendar_event' && conflicts.value.length === 0) {
    conflictLoading.value = true;
    try {
      conflicts.value = await fetchConflictsForAction(props.action.id);
    } catch {
      conflicts.value = [];
    } finally {
      conflictLoading.value = false;
    }
  }
});

const conflictCount = computed(() => conflicts.value.length);

// ── Timeline Math ─────────────────────────────────────────
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 23;
const timelineHours = computed(() => {
  const hours: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h += 2) hours.push(h);
  return hours;
});

function hourToPercent(hour: number): number {
  return ((hour - TIMELINE_START_HOUR) / (TIMELINE_END_HOUR - TIMELINE_START_HOUR)) * 100;
}

function timeToPercent(timestamp: string): number {
  const d = new Date(timestamp);
  const hours = d.getHours() + d.getMinutes() / 60;
  const clamped = Math.max(TIMELINE_START_HOUR, Math.min(TIMELINE_END_HOUR, hours));
  return hourToPercent(clamped);
}

function blockStyle(start: string, end: string): Record<string, string> {
  const left = timeToPercent(start);
  const right = timeToPercent(end);
  const width = Math.max(1, right - left);
  return { left: left + '%', width: width + '%' };
}

const proposedStart = computed(() => {
  if (props.action.type !== 'calendar_event') return null;
  return (props.action.payload as CalendarEventPayload).startTime || null;
});

const proposedEnd = computed(() => {
  if (props.action.type !== 'calendar_event') return null;
  return (props.action.payload as CalendarEventPayload).endTime || null;
});

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.pa-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.pa-card:hover {
  box-shadow: 0 4px 16px -4px var(--shadow);
}

.pa-card.type-calendar_event { border-left: 3px solid #3b82f6; }
.pa-card.type-send_email { border-left: 3px solid #8b5cf6; }
.pa-card.type-webhook_call { border-left: 3px solid #f59e0b; }
.pa-card.type-iot_command { border-left: 3px solid #10b981; }

.pa-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.pa-header:hover {
  background: color-mix(in srgb, var(--surface-muted) 50%, transparent);
}

.pa-type-icon { font-size: 1.6rem; flex-shrink: 0; }
.pa-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.pa-title { font-size: 0.95rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pa-desc { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pa-expand-icon { color: var(--text-muted); font-size: 0.9rem; flex-shrink: 0; }

.pa-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
}

.auto-approve-check { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary); cursor: pointer; }
.auto-approve-check input { accent-color: var(--ok); }
.pa-btns { display: flex; gap: 8px; }

.btn-approve, .btn-reject {
  padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border);
  font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.btn-approve { background: color-mix(in srgb, var(--ok) 12%, transparent); color: var(--ok); border-color: color-mix(in srgb, var(--ok) 30%, var(--border)); }
.btn-approve:hover:not(:disabled) { background: color-mix(in srgb, var(--ok) 20%, transparent); }
.btn-reject { background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 24%, var(--border)); }
.btn-reject:hover:not(:disabled) { background: color-mix(in srgb, var(--danger) 18%, transparent); }
.btn-approve:disabled, .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Conflict Map Styles ── */
.conflict-badge {
  display: inline-flex; align-items: center; margin-left: 8px; padding: 1px 6px;
  background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger);
  border-radius: 4px; font-size: 0.75rem; font-weight: 600; vertical-align: middle;
}

.conflict-panel {
  margin: 0 16px 12px; border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: 12px; background: color-mix(in srgb, var(--danger) 5%, transparent);
  overflow: hidden; animation: fadeSlide 0.25s ease;
}
.conflict-panel.loading {
  padding: 16px; text-align: center; border-color: var(--border); background: var(--surface-muted);
}

@keyframes fadeSlide { 0% { opacity: 0; max-height: 0; } 100% { opacity: 1; max-height: 500px; } }

.conflict-header {
  padding: 10px 14px; font-size: 0.8rem; font-weight: 600; color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent); display: flex; align-items: center; gap: 8px;
}

/* ── Mini Timeline Bar ── */
.timeline-bar-container { padding: 12px 14px 8px; }

.timeline-bar { position: relative; }

.timeline-hours {
  position: relative; height: 16px; font-size: 0.65rem; color: var(--text-muted); font-variant-numeric: tabular-nums;
}
.hour-tick { position: absolute; transform: translateX(-50%); }

.timeline-track {
  position: relative; height: 28px; background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
  border-radius: 6px; border: 1px solid var(--border); overflow: hidden;
}

.timeline-block {
  position: absolute; top: 3px; bottom: 3px; border-radius: 4px;
  opacity: 0.85; transition: opacity 0.2s;
}
.timeline-block:hover { opacity: 1; }
.timeline-block.existing { background: #3b82f6; }
.timeline-block.proposed { background: #f59e0b; }
.timeline-block.proposed.overlapping { background: #ef4444; animation: pulseRed 1.5s ease infinite; }

@keyframes pulseRed { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }

.timeline-legend {
  display: flex; gap: 14px; margin-top: 6px; font-size: 0.7rem; color: var(--text-muted);
}
.legend-item { display: flex; align-items: center; gap: 4px; }
.dot { width: 8px; height: 8px; border-radius: 2px; }
.dot.existing { background: #3b82f6; }
.dot.proposed { background: #f59e0b; }
.dot.overlapping { background: #ef4444; }

.conflict-list { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
.conflict-item { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: var(--text-secondary); }
.c-time { font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: 0.8rem; }
.c-title { font-weight: 500; color: var(--text); }
</style>
