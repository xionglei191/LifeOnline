<template>
  <div class="soul-action-detail-view">
    <div class="detail-header">
      <router-link to="/governance" class="back-link">← 治理中心</router-link>
      <h2>SoulAction Detail</h2>
    </div>

    <div v-if="loading" class="loading-state">加载中…</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <template v-else-if="action">
      <!-- ── Header Card ── -->
      <div class="settings-card header-card">
        <div class="header-top">
          <span class="action-kind-badge" :class="actionKindClass">{{ kindLabel }}</span>
          <span class="governance-badge" :class="'gov-' + action.governanceStatus">{{ governanceLabel }}</span>
          <span class="execution-badge" :class="'exec-' + action.executionStatus">{{ executionLabel }}</span>
        </div>
        <div class="header-id">
          <span class="mono">{{ action.id }}</span>
        </div>
      </div>

      <!-- ── Lifecycle Timeline ── -->
      <div class="settings-card timeline-card">
        <h3>生命周期</h3>
        <div class="timeline">
          <div class="timeline-node" :class="{ active: true }">
            <div class="timeline-dot done"></div>
            <div class="timeline-content">
              <span class="timeline-label">创建</span>
              <span class="timeline-time">{{ formatTime(action.createdAt) }}</span>
            </div>
          </div>
          <div class="timeline-node" :class="{ active: !!action.approvedAt }">
            <div class="timeline-dot" :class="action.approvedAt ? 'done' : action.deferredAt ? 'deferred' : action.discardedAt ? 'discarded' : 'pending'"></div>
            <div class="timeline-content">
              <template v-if="action.approvedAt">
                <span class="timeline-label">批准</span>
                <span class="timeline-time">{{ formatTime(action.approvedAt) }}</span>
              </template>
              <template v-else-if="action.deferredAt">
                <span class="timeline-label">延后</span>
                <span class="timeline-time">{{ formatTime(action.deferredAt) }}</span>
              </template>
              <template v-else-if="action.discardedAt">
                <span class="timeline-label">丢弃</span>
                <span class="timeline-time">{{ formatTime(action.discardedAt) }}</span>
              </template>
              <template v-else>
                <span class="timeline-label">治理决策</span>
                <span class="timeline-time hint">等待中</span>
              </template>
            </div>
          </div>
          <div class="timeline-node" :class="{ active: !!action.startedAt }">
            <div class="timeline-dot" :class="action.startedAt ? 'done' : 'pending'"></div>
            <div class="timeline-content">
              <span class="timeline-label">执行开始</span>
              <span class="timeline-time" v-if="action.startedAt">{{ formatTime(action.startedAt) }}</span>
              <span class="timeline-time hint" v-else>—</span>
            </div>
          </div>
          <div class="timeline-node" :class="{ active: !!action.finishedAt }">
            <div class="timeline-dot" :class="action.finishedAt ? (action.error ? 'error' : 'done') : 'pending'"></div>
            <div class="timeline-content">
              <span class="timeline-label">{{ action.error ? '执行失败' : '执行完成' }}</span>
              <span class="timeline-time" v-if="action.finishedAt">{{ formatTime(action.finishedAt) }}</span>
              <span class="timeline-time hint" v-else>—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Governance Section ── -->
      <div class="settings-card governance-card">
        <h3>治理信息</h3>
        <div class="detail-field" v-if="action.governanceReason">
          <span class="field-label">治理原因</span>
          <p class="field-value">{{ action.governanceReason }}</p>
        </div>

        <div class="governance-actions" v-if="action.governanceStatus === 'pending_review'">
          <div class="reason-input-row">
            <input
              v-model="governanceReason"
              type="text"
              placeholder="审批理由（可选）"
              class="reason-input"
            />
          </div>
          <div class="action-buttons">
            <button class="btn-approve" :disabled="operating" @click="handleApprove">✓ 批准</button>
            <button class="btn-defer" :disabled="operating" @click="handleDefer">⏸ 延后</button>
            <button class="btn-discard" :disabled="operating" @click="handleDiscard">✕ 丢弃</button>
          </div>
        </div>

        <div class="governance-actions" v-if="action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched'">
          <button class="btn-dispatch" :disabled="operating" @click="handleDispatch">▶ 派发执行</button>
        </div>
      </div>

      <!-- ── Followup Answer Section ── -->
      <div class="settings-card followup-card" v-if="action.actionKind === 'ask_followup_question' && action.executionStatus === 'pending'">
        <h3>💬 系统追问</h3>
        <div class="followup-question">
          <p class="field-value">{{ action.governanceReason }}</p>
        </div>
        <div class="followup-answer-form">
          <textarea
            v-model="followupAnswer"
            placeholder="在此输入您的回答…"
            class="answer-textarea"
            rows="4"
          ></textarea>
          <button class="btn-approve" :disabled="operating || !followupAnswer.trim()" @click="handleAnswer">📝 提交回答</button>
        </div>
      </div>

      <!-- ── Execution Section ── -->
      <div class="settings-card execution-card" v-if="action.executionStatus !== 'not_dispatched' || action.workerTaskId || action.resultSummary || action.error">
        <h3>执行结果</h3>
        <div class="detail-field" v-if="action.workerTaskId">
          <span class="field-label">Worker Task</span>
          <span class="field-value mono">{{ action.workerTaskId }}</span>
        </div>
        <div class="detail-field" v-if="action.executionSummary">
          <span class="field-label">执行摘要</span>
          <div class="execution-summary">
            <span v-if="action.executionSummary.objectType" class="worker-pill">{{ action.executionSummary.objectType }}</span>
            <span v-if="action.executionSummary.operation" class="worker-pill">{{ action.executionSummary.operation }}</span>
            <span v-if="action.executionSummary.objectId" class="mono hint">{{ action.executionSummary.objectId }}</span>
          </div>
          <p class="field-value" v-if="action.executionSummary.summary">{{ action.executionSummary.summary }}</p>
        </div>
        <div class="detail-field" v-if="action.resultSummary">
          <span class="field-label">结果摘要</span>
          <p class="field-value">{{ action.resultSummary }}</p>
        </div>
        <div class="detail-field error-field" v-if="action.error">
          <span class="field-label">错误</span>
          <p class="field-value error-text">{{ action.error }}</p>
        </div>
      </div>

      <!-- ── Promotion Section ── -->
      <div class="settings-card promotion-card" v-if="action.promotionSummary">
        <h3>提升信息</h3>
        <div class="detail-field" v-if="action.promotionSummary.projectionKind">
          <span class="field-label">投射类型</span>
          <span class="field-value">{{ action.promotionSummary.projectionKind === 'event' ? 'Event Node' : 'Continuity Record' }}</span>
        </div>
        <div class="detail-field" v-if="action.promotionSummary.sourceSummary">
          <span class="field-label">来源摘要</span>
          <p class="field-value">{{ action.promotionSummary.sourceSummary }}</p>
        </div>
        <div class="detail-field" v-if="action.promotionSummary.primaryReason">
          <span class="field-label">主要原因</span>
          <p class="field-value">{{ action.promotionSummary.primaryReason }}</p>
        </div>
        <div class="detail-field" v-if="action.promotionSummary.rationale">
          <span class="field-label">依据</span>
          <p class="field-value">{{ action.promotionSummary.rationale }}</p>
        </div>
        <div class="promotion-badges">
          <span v-if="action.promotionSummary.reviewBacked" class="worker-pill">review-backed</span>
        </div>
      </div>

      <!-- ── Source Section ── -->
      <div class="settings-card source-card">
        <h3>来源</h3>
        <div class="detail-field">
          <span class="field-label">Source Note</span>
          <span class="field-value mono">{{ action.sourceNoteId }}</span>
        </div>
        <div class="detail-field" v-if="action.sourceReintegrationId">
          <span class="field-label">Source Reintegration</span>
          <span class="field-value mono">{{ action.sourceReintegrationId }}</span>
        </div>
        <div class="detail-field">
          <span class="field-label">最后更新</span>
          <span class="field-value">{{ formatTime(action.updatedAt) }}</span>
        </div>
      </div>

      <!-- ── Reintegration Card ── -->
      <div v-if="reintegrationRecord" class="settings-card reintegration-card">
        <h3>Source Reintegration</h3>
        <div class="detail-field">
          <span class="field-label">ID</span>
          <span class="field-value mono">{{ reintegrationRecord.id }}</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Signal Kind</span>
          <span class="field-value">{{ formatReintegrationSignalKindLabel(reintegrationRecord) }}</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Review Status</span>
          <span class="field-value">{{ reintegrationRecord.reviewStatus }}</span>
        </div>
        <div class="detail-field" v-if="reintegrationRecord.summary">
          <span class="field-label">Summary</span>
          <span class="field-value">{{ reintegrationRecord.summary }}</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Evidence</span>
          <pre class="evidence-pre">{{ JSON.stringify(reintegrationRecord.evidence, null, 2) }}</pre>
        </div>
      </div>

      <!-- ── Related Actions Card ── -->
      <div v-if="relatedActions.length" class="settings-card related-actions-card">
        <h3>同源行动项 (Related Actions)</h3>
        <div class="related-actions-list">
          <router-link v-for="relAction in relatedActions" :key="relAction.id" :to="`/governance/soul-action/${relAction.id}`" class="related-action-item">
            <span class="action-kind-badge" :class="getRelatedActionClass(relAction.actionKind)">{{ formatSoulActionKindLabel(relAction.actionKind) }}</span>
            <span class="governance-badge" :class="`gov-${relAction.governanceStatus}`">{{ GOVERNANCE_LABELS[relAction.governanceStatus] || relAction.governanceStatus }}</span>
            <span class="execution-badge" :class="`exec-${relAction.executionStatus}`">{{ EXECUTION_LABELS[relAction.executionStatus] || relAction.executionStatus }}</span>
            <span class="mono hint">{{ relAction.id.replace('soul:', '') }}</span>
          </router-link>
        </div>
      </div>

      <!-- ── Operation Message ── -->
      <div v-if="opMessage" class="message" :class="opMessageType">{{ opMessage }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchSoulAction, approveSoulAction, dispatchSoulAction, deferSoulAction, discardSoulAction, answerFollowupQuestion, fetchReintegrationRecords, fetchSoulActions } from '../api/client';
import { formatSoulActionKindLabel, formatReintegrationSignalKindLabel } from '@lifeos/shared';
import type { SoulAction, ReintegrationRecord } from '@lifeos/shared';

const route = useRoute();
const router = useRouter();

const action = ref<SoulAction | null>(null);
const loading = ref(true);
const error = ref('');
const operating = ref(false);
const opMessage = ref('');
const opMessageType = ref<'success' | 'error'>('success');
const governanceReason = ref('');
const followupAnswer = ref('');

const actionId = computed(() => route.params.id as string);
const kindLabel = computed(() => action.value ? formatSoulActionKindLabel(action.value.actionKind) : '');

const PROMOTION_KINDS = ['create_event_node', 'promote_event_node', 'promote_continuity_record'];
const WORKER_KINDS = ['extract_tasks', 'launch_daily_report', 'launch_weekly_report', 'launch_openclaw_task'];

const reintegrationRecord = ref<ReintegrationRecord | null>(null);
const relatedActions = ref<SoulAction[]>([]);

function getRelatedActionClass(kind: string) {
  if (PROMOTION_KINDS.includes(kind)) return 'kind-promotion';
  if (WORKER_KINDS.includes(kind)) return 'kind-worker';
  return 'kind-default';
}

const actionKindClass = computed(() => {
  if (!action.value) return '';
  if (PROMOTION_KINDS.includes(action.value.actionKind)) return 'kind-promotion';
  if (WORKER_KINDS.includes(action.value.actionKind)) return 'kind-worker';
  return 'kind-default';
});

const GOVERNANCE_LABELS: Record<string, string> = {
  pending_review: '待审核',
  approved: '已批准',
  deferred: '已延后',
  discarded: '已丢弃',
};

const EXECUTION_LABELS: Record<string, string> = {
  not_dispatched: '未派发',
  pending: '等待执行',
  running: '执行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const governanceLabel = computed(() => GOVERNANCE_LABELS[action.value?.governanceStatus ?? ''] ?? action.value?.governanceStatus ?? '');
const executionLabel = computed(() => EXECUTION_LABELS[action.value?.executionStatus ?? ''] ?? action.value?.executionStatus ?? '');

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function loadAction() {
  loading.value = true;
  error.value = '';  try {
    action.value = await fetchSoulAction(actionId.value);
    reintegrationRecord.value = null;
    relatedActions.value = [];
    if (action.value.sourceReintegrationId) {
      try {
        const [recs, acts] = await Promise.all([
          fetchReintegrationRecords({ sourceNoteId: action.value.sourceNoteId }),
          fetchSoulActions({ sourceReintegrationId: action.value.sourceReintegrationId })
        ]);
        reintegrationRecord.value = recs.find(r => r.id === action.value!.sourceReintegrationId) || null;
        relatedActions.value = acts.filter(a => a.id !== action.value!.id);
      } catch (err) {
        console.warn('Failed to load related data:', err);
      }
    }
  } catch (e: any) {    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleApprove() {
  operating.value = true;
  opMessage.value = '';
  try {
    action.value = await approveSoulAction(actionId.value, { reason: governanceReason.value || undefined });
    opMessage.value = '已批准';
    opMessageType.value = 'success';
    governanceReason.value = '';
  } catch (e: any) {
    opMessage.value = e.message || '批准失败';
    opMessageType.value = 'error';
  } finally {
    operating.value = false;
  }
}

async function handleDispatch() {
  operating.value = true;
  opMessage.value = '';
  try {
    const result = await dispatchSoulAction(actionId.value);
    action.value = result.soulAction;
    opMessage.value = result.result.reason || '已派发';
    opMessageType.value = 'success';
  } catch (e: any) {
    opMessage.value = e.message || '派发失败';
    opMessageType.value = 'error';
  } finally {
    operating.value = false;
  }
}

async function handleDefer() {
  operating.value = true;
  opMessage.value = '';
  try {
    action.value = await deferSoulAction(actionId.value, { reason: governanceReason.value || undefined });
    opMessage.value = '已延后';
    opMessageType.value = 'success';
    governanceReason.value = '';
  } catch (e: any) {
    opMessage.value = e.message || '延后失败';
    opMessageType.value = 'error';
  } finally {
    operating.value = false;
  }
}

async function handleDiscard() {
  operating.value = true;
  opMessage.value = '';
  try {
    action.value = await discardSoulAction(actionId.value, { reason: governanceReason.value || undefined });
    opMessage.value = '已丢弃';
    opMessageType.value = 'success';
    governanceReason.value = '';
  } catch (e: any) {
    opMessage.value = e.message || '丢弃失败';
    opMessageType.value = 'error';
  } finally {
    operating.value = false;
  }
}

async function handleAnswer() {
  operating.value = true;
  opMessage.value = '';
  try {
    action.value = await answerFollowupQuestion(actionId.value, followupAnswer.value);
    opMessage.value = '回答已提交，已追加到源笔记';
    opMessageType.value = 'success';
    followupAnswer.value = '';
  } catch (e: any) {
    opMessage.value = e.message || '提交回答失败';
    opMessageType.value = 'error';
  } finally {
    operating.value = false;
  }
}

watch(actionId, () => loadAction());
onMounted(() => loadAction());
</script>

<style scoped>
.soul-action-detail-view {
  max-width: 800px;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: 20px;
}

.back-link {
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
  display: inline-block;
  margin-bottom: 8px;
}

.back-link:hover {
  color: #409eff;
}

.detail-header h2 {
  font-size: 22px;
  margin: 0;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.error-state {
  color: #f56c6c;
}

/* ─── Shared card styles ─── */
.settings-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px var(--shadow);
}

.settings-card h3 {
  font-size: 16px;
  margin-bottom: 16px;
  color: var(--text);
}

.hint { font-size: 12px; color: var(--text-muted); }
.mono { font-family: monospace; font-size: 12px; }

/* ─── Header Card ─── */
.header-card {
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(66% 0.05 150) 22%);
  background: linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(97% 0.015 150) 8%), var(--card-bg));
}

.header-top {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.header-id {
  color: var(--text-muted);
  font-size: 12px;
}

.action-kind-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.kind-default { background: oklch(95% 0.02 150); color: oklch(40% 0.1 150); }
.kind-promotion { background: oklch(95% 0.03 280); color: oklch(45% 0.12 280); }
.kind-worker { background: oklch(95% 0.03 250); color: oklch(45% 0.1 250); }

.governance-badge, .execution-badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--border);
}

.gov-pending_review { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
.gov-approved { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.gov-deferred { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.gov-discarded { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

.exec-not_dispatched { background: #f9fafb; color: #6b7280; }
.exec-pending { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.exec-running { background: #eff6ff; color: #2563eb; border-color: #93c5fd; }
.exec-succeeded { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.exec-failed { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.exec-cancelled { background: #f9fafb; color: #9ca3af; }

/* ─── Timeline ─── */
.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--border);
}

.timeline-node {
  position: relative;
  padding-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.timeline-node:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--card-bg);
  flex-shrink: 0;
  margin-left: -24px;
  z-index: 1;
}

.timeline-dot.done { background: #16a34a; border-color: #16a34a; }
.timeline-dot.pending { background: var(--card-bg); border-color: #d1d5db; }
.timeline-dot.deferred { background: #7c3aed; border-color: #7c3aed; }
.timeline-dot.discarded { background: #dc2626; border-color: #dc2626; }
.timeline-dot.error { background: #dc2626; border-color: #dc2626; }

.timeline-content {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.timeline-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.timeline-time {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
}

.timeline-node:not(.active) .timeline-label {
  color: var(--text-muted);
}

/* ─── Detail Fields ─── */
.detail-field {
  margin-bottom: 14px;
}

.detail-field:last-child {
  margin-bottom: 0;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}

.field-value {
  font-size: 14px;
  color: var(--text);
  line-height: 1.55;
  margin: 0;
}

.error-text {
  color: #dc2626;
}

/* ─── Governance Actions ─── */
.governance-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.reason-input-row {
  margin-bottom: 12px;
}

.reason-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  font-size: 14px;
  box-sizing: border-box;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-approve, .btn-dispatch {
  padding: 8px 20px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  background: #16a34a;
  color: white;
  transition: background 0.2s;
}

.btn-approve:hover:not(:disabled), .btn-dispatch:hover:not(:disabled) { background: #15803d; }

.btn-defer {
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid #ddd6fe;
  cursor: pointer;
  font-size: 13px;
  background: #f5f3ff;
  color: #7c3aed;
  transition: all 0.2s;
}

.btn-defer:hover:not(:disabled) { background: #ede9fe; }

.btn-discard {
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid #fecaca;
  cursor: pointer;
  font-size: 13px;
  background: #fef2f2;
  color: #dc2626;
  transition: all 0.2s;
}

.btn-discard:hover:not(:disabled) { background: #fee2e2; }

.btn-approve:disabled, .btn-dispatch:disabled, .btn-defer:disabled, .btn-discard:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ─── Execution Summary ─── */
.execution-summary {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.worker-pill {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  font-family: monospace;
}

/* ─── Promotion ─── */
.promotion-badges {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

/* ─── Message ─── */
.message {
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 14px;
  margin-top: 12px;
}

.message.success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
.message.error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }

/* ─── Followup Answer ─── */
.followup-card {
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(66% 0.08 50) 22%);
  background: linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(97% 0.02 50) 8%), var(--card-bg));
}

.followup-question {
  padding: 12px 16px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--meta-bg) 85%, oklch(95% 0.02 50) 15%);
  margin-bottom: 14px;
}

.followup-answer-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.answer-textarea:focus {
  outline: none;
  border-color: #409eff;
}

.evidence-pre {
  margin: 0;
  padding: 10px;
  background: var(--meta-bg);
  border-radius: 6px;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
}

.related-actions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.related-action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
  background: color-mix(in oklch, var(--card-bg) 95%, oklch(98% 0.01 250) 5%);
  border: 1px solid var(--border);
  text-decoration: none;
  transition: background 0.2s;
}

.related-action-item:hover {
  background: var(--meta-bg);
}

.related-action-item .hint {
  margin-left: auto;
  font-size: 11px;
}

/* ─── Mobile Responsive for DetailView ─── */
@media (max-width: 640px) {
  .soul-action-detail-view {
    padding: 0 16px;
  }
  .settings-card {
    padding: 16px;
  }
  .header-top {
    flex-wrap: wrap;
    gap: 12px;
  }
  .action-buttons {
    flex-direction: column;
  }
  .action-buttons button {
    width: 100%;
  }
}
</style>
