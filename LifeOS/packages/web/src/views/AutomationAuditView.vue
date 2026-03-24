<template>
  <div class="audit-view">
    <div class="header">
      <h2>自动化审计日志 (Automation Audit)</h2>
      <p class="subtitle">追溯系统代你执行的真实世界物理动作历史。</p>
    </div>

    <!-- Insight Stats Panel -->
    <div class="insight-strip">
      <div class="stat-card">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">总执行数</span>
      </div>
      <div class="stat-card success">
        <span class="stat-value">{{ stats.successRate }}%</span>
        <span class="stat-label">成功率</span>
      </div>
      <div class="stat-card danger">
        <span class="stat-value">{{ stats.failed }}</span>
        <span class="stat-label">失败数</span>
      </div>

      <!-- Top Failing Types Bar Chart -->
      <div v-if="topFailing.length > 0" class="failing-chart">
        <div class="chart-title">失败类型分布</div>
        <div v-for="ft in topFailing" :key="ft.type" class="chart-row">
          <span class="chart-label">{{ TYPE_ICONS[ft.type] || '⚡' }} {{ ft.type }}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" :style="{ width: barWidth(ft.errorCount) }"></div>
          </div>
          <span class="chart-count">{{ ft.errorCount }}</span>
        </div>
      </div>
    </div>

    <!-- Status Filters -->
    <div class="filters">
      <button :class="['filter-btn', { active: statusFilter === 'all' }]" @click="statusFilter = 'all'">全部</button>
      <button :class="['filter-btn', { active: statusFilter === 'success' }]" @click="statusFilter = 'success'">✅ 成功</button>
      <button :class="['filter-btn', { active: statusFilter === 'failed' }]" @click="statusFilter = 'failed'">❌ 失败</button>
    </div>

    <!-- Type Filters -->
    <div class="filters type-filters">
      <button :class="['type-btn', { active: typeFilter === 'all' }]" @click="typeFilter = 'all'">全部类型</button>
      <button :class="['type-btn', { active: typeFilter === 'calendar_event' }]" @click="typeFilter = 'calendar_event'">📅 日历</button>
      <button :class="['type-btn', { active: typeFilter === 'send_email' }]" @click="typeFilter = 'send_email'">📧 邮件</button>
      <button :class="['type-btn', { active: typeFilter === 'webhook_call' }]" @click="typeFilter = 'webhook_call'">🔗 Webhook</button>
      <button :class="['type-btn', { active: typeFilter === 'iot_command' }]" @click="typeFilter = 'iot_command'">🏠 IoT</button>
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
import type { InsightStats, FailingType } from '../api/client';
import { fetchPhysicalActionHistory, fetchInsightStats, fetchTopFailingTypes } from '../api/client';

const router = useRouter();
const history = ref<PhysicalAction[]>([]);
const loading = ref(true);
const statusFilter = ref<'all' | 'success' | 'failed'>('all');
const typeFilter = ref<string>('all');
const stats = ref<InsightStats>({ total: 0, completed: 0, failed: 0, rejected: 0, pending: 0, successRate: 0, failRate: 0 });
const topFailing = ref<FailingType[]>([]);

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
  let result = history.value;

  // Status filter
  if (statusFilter.value === 'success') result = result.filter(a => a.status === 'completed');
  else if (statusFilter.value === 'failed') result = result.filter(a => a.status === 'failed' || a.status === 'rejected');

  // Type filter
  if (typeFilter.value !== 'all') result = result.filter(a => a.type === typeFilter.value);

  return result;
});

const maxFailCount = computed(() => Math.max(1, ...topFailing.value.map(f => f.errorCount)));

function barWidth(count: number): string {
  return Math.round((count / maxFailCount.value) * 100) + '%';
}

async function loadData() {
  loading.value = true;
  try {
    const [historyData, statsData, failingData] = await Promise.all([
      fetchPhysicalActionHistory(),
      fetchInsightStats(),
      fetchTopFailingTypes(),
    ]);
    history.value = historyData;
    stats.value = statsData;
    topFailing.value = failingData;
  } catch (e) {
    console.error('Failed to load audit data', e);
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
  loadData();
});
</script>

<style scoped>
.audit-view { max-width: 800px; margin: 0 auto; padding-bottom: 40px; }
.header { margin-bottom: 20px; }
.header h2 { font-size: 1.6rem; margin: 0 0 8px; color: var(--text); }
.subtitle { color: var(--text-muted); font-size: 0.95rem; margin: 0; }

/* ── Insight Stats Strip ── */
.insight-strip {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;
}

.stat-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 16px; border-radius: 14px; border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  transition: transform 0.15s, box-shadow 0.15s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px -4px var(--shadow); }
.stat-value { font-size: 1.8rem; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.stat-label { font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; }
.stat-card.success .stat-value { color: var(--ok); }
.stat-card.danger .stat-value { color: var(--danger); }

.failing-chart {
  grid-column: 1 / -1; padding: 14px 18px; border-radius: 14px; border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
}
.chart-title { font-size: 0.85rem; font-weight: 600; color: var(--text); margin-bottom: 10px; }
.chart-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.chart-label { min-width: 110px; font-size: 0.8rem; color: var(--text-secondary); }
.chart-bar-track { flex: 1; height: 10px; background: color-mix(in srgb, var(--danger) 8%, transparent); border-radius: 5px; overflow: hidden; }
.chart-bar-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f87171); border-radius: 5px; transition: width 0.5s ease; }
.chart-count { font-size: 0.75rem; font-weight: 600; color: var(--danger); min-width: 24px; text-align: right; }

/* ── Filters ── */
.filters { display: flex; gap: 10px; margin-bottom: 12px; }
.type-filters { margin-bottom: 30px; }

.filter-btn, .type-btn {
  padding: 6px 16px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text-secondary); font-size: 0.9rem; cursor: pointer; transition: all 0.2s;
}
.filter-btn:hover, .type-btn:hover { background: var(--surface-muted); }
.filter-btn.active, .type-btn.active { background: var(--text); color: var(--surface); border-color: var(--text); }

.type-btn { font-size: 0.82rem; padding: 5px 12px; }

/* ── States ── */
.loading-state, .empty-state { text-align: center; padding: 40px; color: var(--text-muted); background: var(--surface-muted); border-radius: 16px; }

/* ── Timeline ── */
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
  .insight-strip { grid-template-columns: 1fr; }
  .timeline-container::before { left: 16px; }
  .audit-item::before { left: 12px; }
  .audit-item { flex-direction: column; gap: 8px; }
  .audit-time { width: auto; text-align: left; padding-left: 36px; padding-top: 0; font-weight: 600; }
  .audit-card { margin-left: 36px; }
}
</style>
