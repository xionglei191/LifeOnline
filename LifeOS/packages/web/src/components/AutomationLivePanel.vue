<template>
  <section class="automation-live">
    <div class="alp-header">
      <h3>⚡ 自动化实时状态</h3>
      <button class="refresh-btn" @click="refresh" :disabled="loading">↺</button>
    </div>

    <!-- Breaker Status Lights -->
    <div class="breaker-strip">
      <div v-for="b in breakers" :key="b.type" class="breaker-light" :class="b.state">
        <span class="bl-dot"></span>
        <span class="bl-type">{{ TYPE_ICONS[b.type] || '⚡' }} {{ b.type }}</span>
        <span class="bl-state">{{ STATE_LABELS[b.state] }}</span>
      </div>
      <div v-if="!breakers.length && !loading" class="breaker-empty">所有类型正常运行</div>
    </div>

    <!-- Executing Actions -->
    <div class="executing-section">
      <div v-if="executingActions.length === 0 && !loading" class="exec-empty">
        暂无正在执行的动作
      </div>
      <div v-for="action in executingActions" :key="action.id" class="exec-card" :class="`type-${action.type}`">
        <span class="exec-spinner"></span>
        <div class="exec-info">
          <strong>{{ action.title }}</strong>
          <span class="exec-desc">{{ action.description }}</span>
        </div>
        <span class="exec-elapsed">{{ formatElapsed(action.approvedAt || action.createdAt) }}</span>
      </div>
    </div>

    <!-- DAG Progress Slot (placeholder for A-Group) -->
    <div class="dag-slot">
      <span class="dag-placeholder">◇ DAG 进度条 — 等待 A 组交付后接入</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { PhysicalAction } from '@lifeos/shared';
import type { BreakerStateEntry } from '../api/client';
import { fetchBreakerStates, fetchExecutingActions } from '../api/client';

const breakers = ref<BreakerStateEntry[]>([]);
const executingActions = ref<PhysicalAction[]>([]);
const loading = ref(true);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const TYPE_ICONS: Record<string, string> = {
  calendar_event: '📅', send_email: '📧', webhook_call: '🔗', iot_command: '🏠',
};

const STATE_LABELS: Record<string, string> = {
  closed: '🟢 正常', open: '🔴 熔断', half_open: '🟡 探测中',
};

async function refresh() {
  loading.value = true;
  try {
    const [b, e] = await Promise.all([fetchBreakerStates(), fetchExecutingActions()]);
    breakers.value = b;
    executingActions.value = e;
  } catch { /* silently degrade */ }
  loading.value = false;
}

function formatElapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

onMounted(() => {
  refresh();
  pollTimer = setInterval(refresh, 10000); // poll every 10s
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.automation-live {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface) 95%, transparent);
  padding: 18px 20px;
}

.alp-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.alp-header h3 { font-size: 1rem; font-weight: 700; margin: 0; color: var(--text); }
.refresh-btn {
  width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); cursor: pointer; font-size: 0.9rem; transition: all 0.2s;
}
.refresh-btn:hover:not(:disabled) { background: var(--surface-muted); }

/* ── Breaker Strip ── */
.breaker-strip { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }

.breaker-light {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--surface); font-size: 0.82rem; transition: all 0.2s;
}

.bl-dot { width: 8px; height: 8px; border-radius: 50%; }
.breaker-light.closed .bl-dot { background: #22c55e; box-shadow: 0 0 6px #22c55e55; }
.breaker-light.open .bl-dot { background: #ef4444; box-shadow: 0 0 8px #ef444488; animation: pulseRed 1.5s infinite; }
.breaker-light.half_open .bl-dot { background: #eab308; box-shadow: 0 0 6px #eab30855; animation: pulseYellow 2s infinite; }

@keyframes pulseRed { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
@keyframes pulseYellow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

.bl-type { font-weight: 500; color: var(--text-secondary); }
.bl-state { font-size: 0.75rem; color: var(--text-muted); }
.breaker-light.open { border-color: color-mix(in srgb, #ef4444 30%, var(--border)); background: color-mix(in srgb, #ef4444 5%, transparent); }
.breaker-light.half_open { border-color: color-mix(in srgb, #eab308 30%, var(--border)); background: color-mix(in srgb, #eab308 5%, transparent); }
.breaker-empty { font-size: 0.85rem; color: var(--text-muted); padding: 4px 0; }

/* ── Executing Actions ── */
.executing-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }

.exec-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}
.exec-card.type-calendar_event { border-left: 3px solid #3b82f6; }
.exec-card.type-send_email { border-left: 3px solid #8b5cf6; }
.exec-card.type-webhook_call { border-left: 3px solid #f59e0b; }
.exec-card.type-iot_command { border-left: 3px solid #10b981; }

.exec-spinner {
  width: 16px; height: 16px; border: 2px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.8s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.exec-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.exec-info strong { font-size: 0.88rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exec-desc { font-size: 0.78rem; color: var(--text-muted); }
.exec-elapsed { font-size: 0.75rem; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.exec-empty { font-size: 0.85rem; color: var(--text-muted); padding: 4px 0; }

/* ── DAG Slot ── */
.dag-slot {
  padding: 10px 14px; border-radius: 10px; border: 1px dashed var(--border);
  background: var(--surface-muted); text-align: center;
}
.dag-placeholder { font-size: 0.8rem; color: var(--text-muted); }

@media (max-width: 640px) {
  .breaker-strip { flex-direction: column; }
}
</style>
