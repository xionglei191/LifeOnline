<template>
  <div class="pa-card" :class="[`type-${action.type}`, { expanded }]">
    <div class="pa-header" @click="expanded = !expanded">
      <span class="pa-type-icon">{{ typeIcon }}</span>
      <div class="pa-info">
        <strong class="pa-title">{{ action.title }}</strong>
        <span class="pa-desc">{{ action.description }}</span>
      </div>
      <span class="pa-expand-icon">{{ expanded ? '▾' : '▸' }}</span>
    </div>

    <DryRunPreview v-if="expanded && action.dryRunPreview" :preview="action.dryRunPreview" :action-type="action.type" />

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
import { ref } from 'vue';
import type { PhysicalAction } from '@lifeos/shared';
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
</style>
