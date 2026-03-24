<template>
  <div class="dryrun-panel">
    <div class="dryrun-header">
      <span class="dryrun-icon">🔮</span>
      <span class="dryrun-label">执行预览 (Dry-Run)</span>
    </div>
    <div class="dryrun-body">
      <p class="dryrun-text">{{ preview }}</p>
      <div class="dryrun-meta">
        <span class="meta-pill">{{ actionTypeLabel }}</span>
        <span class="meta-pill reversible">可撤销</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PhysicalActionType } from '@lifeos/shared';

const props = defineProps<{
  preview: string;
  actionType: PhysicalActionType;
}>();

const ACTION_LABELS: Record<string, string> = {
  calendar_event: '日历事件',
  send_email: '邮件发送',
  webhook_call: 'Webhook 调用',
  iot_command: 'IoT 设备指令',
};

const actionTypeLabel = computed(() => ACTION_LABELS[props.actionType] || props.actionType);
</script>

<style scoped>
.dryrun-panel {
  margin: 0 16px 12px;
  border: 1px dashed color-mix(in srgb, var(--signal) 30%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--signal) 4%, transparent);
  overflow: hidden;
  animation: fadeSlide 0.25s ease;
}

@keyframes fadeSlide {
  0% { opacity: 0; max-height: 0; }
  100% { opacity: 1; max-height: 300px; }
}

.dryrun-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--signal);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dryrun-icon {
  font-size: 1rem;
}

.dryrun-body {
  padding: 0 14px 14px;
}

.dryrun-text {
  margin: 0 0 12px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.dryrun-meta {
  display: flex;
  gap: 8px;
}

.meta-pill {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  background: var(--surface-muted);
  color: var(--text-muted);
}

.meta-pill.reversible {
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  color: var(--ok);
}
</style>
