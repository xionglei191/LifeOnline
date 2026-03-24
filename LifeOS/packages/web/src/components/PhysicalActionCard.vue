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
      
      <div v-if="conflictCount > 0" class="conflict-panel">
        <div class="conflict-header">
          <span class="conflict-icon">⚠️</span>
          <span class="conflict-label">日程冲突警告 (那天你已有安排)</span>
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
import { ref, computed } from 'vue';
import type { PhysicalAction, CalendarEventPayload } from '@lifeos/shared';
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

const TYPE_ICONS: Record<string, string> = {
  calendar_event: '📅',
  send_email: '📧',
  webhook_call: '🔗',
  iot_command: '🏠',
};
const typeIcon = TYPE_ICONS[props.action.type] || '⚡';

// ── Conflict Map Logic ────────────────────────────────────
// mock existing schedule
const MOCK_EXISTING_EVENTS = [
  { id: 'c-1', title: '全员周会', startTime: '2026-03-31T10:00:00', endTime: '2026-03-31T11:30:00' },
  { id: 'c-2', title: '晚餐：和老友聚餐', startTime: '2026-03-31T18:30:00', endTime: '2026-03-31T20:30:00' },
];

const conflicts = computed(() => {
  if (props.action.type !== 'calendar_event') return [];
  const payload = props.action.payload as CalendarEventPayload;
  if (!payload.startTime || !payload.endTime) return [];
  
  const start = new Date(payload.startTime).getTime();
  const end = new Date(payload.endTime).getTime();
  
  return MOCK_EXISTING_EVENTS.filter(e => {
    const eStart = new Date(e.startTime).getTime();
    const eEnd = new Date(e.endTime).getTime();
    return start < eEnd && end > eStart; // Overlap condition Check
  });
});

const conflictCount = computed(() => conflicts.value.length);

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

.pa-type-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
}

.pa-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pa-title {
  font-size: 0.95rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pa-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pa-expand-icon {
  color: var(--text-muted);
  font-size: 0.9rem;
  flex-shrink: 0;
}

.pa-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
}

.auto-approve-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.auto-approve-check input {
  accent-color: var(--ok);
}

.pa-btns {
  display: flex;
  gap: 8px;
}

.btn-approve, .btn-reject {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-approve {
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  color: var(--ok);
  border-color: color-mix(in srgb, var(--ok) 30%, var(--border));
}

.btn-approve:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ok) 20%, transparent);
}

.btn-reject {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 24%, var(--border));
}

.btn-reject:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
}

.btn-approve:disabled, .btn-reject:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Conflict Map Styles ── */
.conflict-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  vertical-align: middle;
}

.conflict-panel {
  margin: 0 16px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--danger) 5%, transparent);
  overflow: hidden;
  animation: fadeSlide 0.25s ease;
}

@keyframes fadeSlide {
  0% { opacity: 0; max-height: 0; }
  100% { opacity: 1; max-height: 300px; }
}

.conflict-header {
  padding: 10px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  display: flex;
  align-items: center;
  gap: 8px;
}

.conflict-list {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conflict-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.c-time {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.c-title {
  font-weight: 500;
  color: var(--text);
}
</style>
