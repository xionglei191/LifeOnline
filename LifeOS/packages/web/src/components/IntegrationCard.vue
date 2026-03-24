<template>
  <div class="integration-card" :class="{ connected: integration.connected }">
    <div class="intg-info">
      <span class="intg-icon">{{ providerIcon }}</span>
      <div class="intg-details">
        <strong>{{ integration.provider }}</strong>
        <span class="intg-status">
          {{ integration.connected ? '已连接' : '未连接' }}
          <template v-if="integration.connected && integration.lastSyncAt">
            · 最后同步 {{ formatTime(integration.lastSyncAt) }}
          </template>
        </span>
      </div>
    </div>
    <button
      v-if="integration.connected"
      class="btn-disconnect"
      @click="$emit('disconnect', integration.provider)"
    >
      断开连接
    </button>
    <button
      v-else
      class="btn-connect"
      @click="$emit('connect', integration.provider)"
    >
      授权连接
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IntegrationStatus } from '@lifeos/shared';

const props = defineProps<{
  integration: IntegrationStatus;
}>();

defineEmits<{
  (e: 'connect', provider: string): void;
  (e: 'disconnect', provider: string): void;
}>();

const PROVIDER_ICONS: Record<string, string> = {
  'Google Calendar': '📅',
  'Email (SMTP)': '📧',
  'Webhook': '🔗',
};

const providerIcon = computed(() => PROVIDER_ICONS[props.integration.provider] || '🔌');

function formatTime(ts: string) {
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.integration-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  transition: border-color 0.2s;
}

.integration-card.connected {
  border-color: color-mix(in srgb, var(--ok) 30%, var(--border));
}

.intg-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.intg-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
}

.intg-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.intg-details strong {
  font-size: 0.95rem;
  color: var(--text);
}

.intg-status {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.connected .intg-status {
  color: var(--ok);
}

.btn-connect, .btn-disconnect {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-connect {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

.btn-connect:hover {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.btn-disconnect {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 20%, var(--border));
}

.btn-disconnect:hover {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
}
</style>
