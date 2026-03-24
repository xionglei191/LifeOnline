<template>
  <div class="audit-view">
    <div class="header">
      <h2>自动化审计日志 (Automation Audit)</h2>
      <p class="subtitle">追溯系统代你执行的真实世界物理动作历史。</p>
    </div>

    <div class="filters">
      <button :class="['filter-btn', { active: filter === 'all' }]" @click="filter = 'all'">全部</button>
      <button :class="['filter-btn', { active: filter === 'success' }]" @click="filter = 'success'">✅ 成功</button>
      <button :class="['filter-btn', { active: filter === 'failed' }]" @click="filter = 'failed'">❌ 失败</button>
    </div>

    <div v-if="loading" class="loading-state">↺ 加载历史记录...</div>
    <div v-else-if="filteredHistory.length === 0" class="empty-state">暂无符合条件的审计记录</div>
    <div v-else class="timeline-container">
      <div v-for="action in filteredHistory" :key="action.id" class="audit-item">
        <div class="audit-time">{{ formatTime(action.executedAt || action.updatedAt) }}</div>
        
        <div class="audit-card" :class="[`status-${action.status}`, `type-${action.type}`]">
          <div class="audit-header">
            <span class="a-icon">{{ TYPE_ICONS[action.type] || '⚡' }}</span>
            <div class="a-info">
              <strong class="a-title">{{ action.title }}</strong>
              <span class="a-desc">{{ action.description }}</span>
            </div>
            <span class="a-status-badge">{{ STATUS_LABELS[action.status] || action.status }}</span>
          </div>
          
          <div v-if="action.status === 'failed' && action.errorMessage" class="a-error">
            <strong>失败原因：</strong> {{ action.errorMessage }}
          </div>
          <div v-else-if="action.status === 'completed' && action.executionLog" class="a-log">
            <strong>执行日志：</strong> {{ action.executionLog }}
          </div>

          <div class="a-footer">
            <span class="a-policy">{{ POLICY_LABELS[action.approvalPolicy] || action.approvalPolicy }}</span>
            <button v-if="action.sourceNoteId" class="btn-trace" @click="traceSource(action.sourceNoteId)">
              溯源笔记 ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { PhysicalAction } from '@lifeos/shared';
import { fetchPhysicalActionHistory } from '../api/client';

const router = useRouter();
const history = ref<PhysicalAction[]>([]);
const loading = ref(true);
const filter = ref<'all' | 'success' | 'failed'>('all');

const TYPE_ICONS: Record<string, string> = {
  calendar_event: '📅', send_email: '📧', webhook_call: '🔗', iot_command: '🏠',
};

const STATUS_LABELS: Record<string, string> = {
  completed: '✅ 已完成', failed: '❌ 执行失败', rejected: '🚫 已拒绝'
};

const POLICY_LABELS: Record<string, string> = {
  always_ask: '👤 手动授权', auto_after_first: '🤖 自动放行', auto_approve: '🤖 始终自动'
};

const filteredHistory = computed(() => {
  if (filter.value === 'all') return history.value;
  if (filter.value === 'success') return history.value.filter(a => a.status === 'completed');
  if (filter.value === 'failed') return history.value.filter(a => a.status === 'failed' || a.status === 'rejected');
  return history.value;
});

async function loadHistory() {
  loading.value = true;
  try {
    history.value = await fetchPhysicalActionHistory();
  } catch (e) {
    console.error('Failed to load history', e);
  } finally {
    loading.value = false;
  }
}

function traceSource(noteId: string) {
  router.push(`/note/${encodeURIComponent(noteId)}`);
}

function formatTime(timestamp: string) {
  if (!timestamp) return '未知时间';
  return new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(() => {
  loadHistory();
});
</script>

<style scoped>
.audit-view { max-width: 800px; margin: 0 auto; padding-bottom: 40px; }
.header { margin-bottom: 24px; }
.header h2 { font-size: 1.6rem; margin: 0 0 8px; color: var(--text); }
.subtitle { color: var(--text-muted); font-size: 0.95rem; margin: 0; }

.filters { display: flex; gap: 10px; margin-bottom: 30px; }
.filter-btn { padding: 6px 16px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary); font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
.filter-btn:hover { background: var(--surface-muted); }
.filter-btn.active { background: var(--text); color: var(--surface); border-color: var(--text); }

.loading-state, .empty-state { text-align: center; padding: 40px; color: var(--text-muted); background: var(--surface-muted); border-radius: 16px; }

.timeline-container { display: flex; flex-direction: column; gap: 24px; position: relative; }
.timeline-container::before { content: ''; position: absolute; left: 110px; top: 10px; bottom: 10px; width: 2px; background: var(--border); }

.audit-item { display: flex; gap: 24px; position: relative; }
.audit-item::before { content: ''; position: absolute; left: 106px; top: 16px; width: 10px; height: 10px; border-radius: 50%; background: var(--border); border: 2px solid var(--surface); z-index: 1; }

.audit-time { width: 90px; flex-shrink: 0; text-align: right; padding-top: 12px; font-size: 0.85rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }

.audit-card { flex: 1; border: 1px solid var(--border); border-radius: 16px; background: color-mix(in srgb, var(--surface) 94%, transparent); overflow: hidden; }
.audit-card.status-failed { border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.audit-card.status-completed { border-color: color-mix(in srgb, var(--ok) 30%, var(--border)); }

.audit-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: color-mix(in srgb, var(--surface-muted) 30%, transparent); }
.a-icon { font-size: 1.6rem; }
.a-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.a-title { font-size: 0.95rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.a-desc { font-size: 0.82rem; color: var(--text-muted); }
.a-status-badge { font-size: 0.75rem; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: var(--surface-strong); color: var(--text-secondary); }

.status-completed .a-status-badge { color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, transparent); }
.status-failed .a-status-badge { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }

.a-error { padding: 10px 16px; margin: 0 16px 12px; font-size: 0.85rem; color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); border-radius: 8px; border: 1px dashed color-mix(in srgb, var(--danger) 30%, transparent); }
.a-log { padding: 10px 16px; margin: 0 16px 12px; font-size: 0.85rem; color: var(--text-secondary); background: var(--surface-muted); border-radius: 8px; font-family: monospace; }

.a-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-top: 1px solid var(--border); font-size: 0.8rem; }
.a-policy { color: var(--text-muted); background: var(--surface-muted); padding: 2px 8px; border-radius: 4px; }
.btn-trace { color: var(--accent); background: transparent; border: none; cursor: pointer; font-weight: 600; padding: 4px 8px; border-radius: 6px; transition: background 0.2s; }
.btn-trace:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }

@media (max-width: 640px) {
  .timeline-container::before { left: 16px; }
  .audit-item::before { left: 12px; }
  .audit-item { flex-direction: column; gap: 8px; }
  .audit-time { width: auto; text-align: left; padding-left: 36px; padding-top: 0; font-weight: 600; }
  .audit-card { margin-left: 36px; }
}
</style>
