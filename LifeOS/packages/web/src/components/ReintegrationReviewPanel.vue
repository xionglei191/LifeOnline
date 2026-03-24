<template>
  <div class="settings-card reintegration-card">
    <div class="reintegration-head">
      <div>
        <h3>Reintegration Review</h3>
        <p class="hint reintegration-subtitle">复核终态 worker 回流记录，accept 时自动规划 PR6 promotion actions。</p>
      </div>
      <div class="reintegration-head-actions">
        <select :value="filterStatus" class="worker-filter" @change="emit('update:filterStatus', ($event.target as HTMLSelectElement).value)">
          <option value="">全部状态</option>
          <option value="pending_review">待复核</option>
          <option value="accepted">已接受</option>
          <option value="rejected">已拒绝</option>
        </select>
        <button class="btn-link" @click="emit('refresh')">刷新</button>
      </div>
    </div>

    <div class="reintegration-summary-strip">
      <div class="reintegration-summary-item">
        <span>待复核</span>
        <strong>{{ statusSummary.pending_review }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>已接受</span>
        <strong>{{ statusSummary.accepted }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>已拒绝</span>
        <strong>{{ statusSummary.rejected }}</strong>
      </div>
    </div>

    <div v-if="message" :class="['message', messageType]">{{ message }}</div>

    <div v-if="loading" class="worker-empty-state">加载中...</div>
    <div v-else-if="records.length" class="reintegration-list">
      <article v-for="record in records" :key="record.id" class="reintegration-item">
        <div class="reintegration-item-top">
          <div class="reintegration-item-title-row">
            <strong>{{ taskTypeLabel(record.taskType) }}</strong>
            <span class="prompt-status" :class="reintegrationStatusClass(record.reviewStatus)">{{ reintegrationStatusText(record.reviewStatus) }}</span>
            <span class="worker-pill">{{ formatReintegrationSignalKindLabel(record) }}</span>
            <span class="worker-pill">强度 {{ formatReintegrationStrengthLabel(record) }}</span>
          </div>
          <button class="btn-link" @click="emit('toggle-expanded', record.id)">
            {{ expandedIds.includes(record.id) ? '收起详情' : '展开详情' }}
          </button>
        </div>

        <p class="reintegration-summary-text">{{ record.summary }}</p>

        <div class="reintegration-meta-grid">
          <span>Worker: {{ record.workerTaskId }}</span>
          <span>Target: {{ formatReintegrationTargetLabel(record) }}</span>
          <span>创建于 {{ formatTime(record.createdAt) }}</span>
          <span v-if="record.reviewedAt">复核于 {{ formatTime(record.reviewedAt) }}</span>
        </div>

        <div v-if="record.taskType === 'extract_tasks' && recordStripRows(record).length" class="reintegration-next-action-strip">
          <template v-for="row in recordStripRows(record)" :key="`${record.id}-${row.label}`">
            <span v-if="row.label === '产出行动项'" class="worker-pill">{{ row.label }} {{ row.value }}</span>
            <span v-else>{{ row.label }}：{{ row.value }}</span>
          </template>
        </div>

        <div v-if="recordNoPlanReasonText(record)" class="reintegration-no-plan-reason">
          {{ recordNoPlanReasonText(record) }}
        </div>

        <div class="reintegration-reason-row">
          <input
            :value="reasonDrafts[record.id] ?? ''"
            type="text"
            class="reintegration-reason-input"
            placeholder="可选：输入 accept/reject 理由"
            :disabled="actionId === record.id"
            @input="emit('update:reasonDraft', record.id, ($event.target as HTMLInputElement).value)"
          />
          <button
            class="btn-worker"
            :disabled="actionId === record.id || record.reviewStatus !== 'pending_review'"
            @click="emit('accept', record)"
          >
            {{ actionId === record.id ? '处理中...' : '接受并自动规划' }}
          </button>
          <button
            class="btn-cancel"
            :disabled="actionId === record.id || record.reviewStatus !== 'pending_review'"
            @click="emit('reject', record)"
          >
            拒绝
          </button>
          <button
            class="btn-link"
            :disabled="actionId === record.id || record.reviewStatus !== 'accepted'"
            @click="emit('plan', record)"
          >
            手动补规划
          </button>
        </div>

        <div v-if="record.reviewReason" class="reintegration-review-reason">
          复核理由：{{ record.reviewReason }}
        </div>

        <div v-if="expandedIds.includes(record.id)" class="reintegration-expanded">
          <div v-if="record.taskType === 'extract_tasks' && getReintegrationExtractTaskItems(record).length" class="reintegration-evidence-block">
            <div class="reintegration-section-label">Next-action evidence</div>
            <div class="reintegration-task-list">
              <div v-for="item in getReintegrationExtractTaskItems(record)" :key="item.filePath" class="reintegration-task-item">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="reintegration-action-meta">{{ item.dimension }} · {{ item.priority }}<span v-if="item.due"> · due {{ item.due }}</span></div>
                </div>
                <div class="reintegration-action-meta">{{ item.outputNoteId || item.filePath }}</div>
              </div>
            </div>
          </div>

          <div v-if="record.displaySummary" class="reintegration-evidence-block">
            <div class="reintegration-section-label">Display summary</div>
            <div class="reintegration-display-summary">
              <div v-for="row in recordDisplaySummaryRows(record)" :key="`${row.label}-${row.value}`">{{ row.label }}：{{ row.value }}</div>
            </div>
          </div>

          <div class="reintegration-evidence-block">
            <div class="reintegration-section-label">Evidence</div>
            <pre>{{ JSON.stringify(record.evidence, null, 2) }}</pre>
          </div>

          <div v-if="plannedActions[record.id]?.length" class="reintegration-actions-block">
            <div class="reintegration-section-label">Planned promotion actions</div>
            <div class="reintegration-actions-list">
              <div v-for="action in plannedActions[record.id]" :key="action.id" class="reintegration-action-item">
                <div>
                  <strong>{{ promotionActionLabel(action.actionKind) }}</strong>
                  <div class="reintegration-action-meta">{{ action.id }}</div>
                  <div v-if="formatSoulActionPromotionSummary(action)" class="reintegration-action-meta">
                    {{ formatSoulActionPromotionSummary(action) }}
                  </div>
                </div>
                <span class="prompt-status default">{{ action.governanceStatus }}</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="worker-empty-state">
      当前筛选下没有 reintegration records
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';
import {
  formatReintegrationSignalKindLabel,
  formatReintegrationStrengthLabel,
  formatReintegrationTargetLabel,
  formatSoulActionKindLabel,
  formatSoulActionPromotionSummary,
  getReintegrationExtractTaskItems,
  getReintegrationOutcomeDetailRows,
  getReintegrationOutcomeNoPlanReason,
  getReintegrationOutcomeStripRows,
} from '@lifeos/shared';

defineProps<{
  records: ReintegrationRecord[];
  filterStatus: '' | ReintegrationRecord['reviewStatus'];
  loading: boolean;
  message: string;
  messageType: 'success' | 'error';
  actionId: string | null;
  reasonDrafts: Record<string, string>;
  plannedActions: Record<string, SoulAction[]>;
  expandedIds: string[];
  statusSummary: Record<ReintegrationRecord['reviewStatus'], number>;
  formatTime: (ts: string) => string;
  taskTypeLabel: (taskType: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:filterStatus', value: string): void;
  (event: 'refresh'): void;
  (event: 'accept', record: ReintegrationRecord): void;
  (event: 'reject', record: ReintegrationRecord): void;
  (event: 'plan', record: ReintegrationRecord): void;
  (event: 'toggle-expanded', id: string): void;
  (event: 'update:reasonDraft', id: string, value: string): void;
}>();

function reintegrationStatusText(status: ReintegrationRecord['reviewStatus']) {
  if (status === 'pending_review') return '待复核';
  if (status === 'accepted') return '已接受';
  return '已拒绝';
}

function reintegrationStatusClass(status: ReintegrationRecord['reviewStatus']) {
  if (status === 'accepted') return 'overridden';
  if (status === 'rejected') return 'disabled';
  return 'warning';
}

function recordStripRows(record: ReintegrationRecord) {
  return getReintegrationOutcomeStripRows(record.displaySummary ?? null);
}

function recordDisplaySummaryRows(record: ReintegrationRecord) {
  return getReintegrationOutcomeDetailRows(record.displaySummary ?? null);
}

function recordNoPlanReasonText(record: ReintegrationRecord): string | null {
  return getReintegrationOutcomeNoPlanReason(record.displaySummary ?? null);
}

function promotionActionLabel(actionKind: SoulAction['actionKind']) {
  return formatSoulActionKindLabel(actionKind);
}
</script>

<style scoped>
/* ─── Shared styles ─── */
.settings-card { background: var(--card-bg); border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px var(--shadow); }
.settings-card h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.message { padding: 10px 14px; border-radius: 4px; font-size: 14px; margin-top: 12px; }
.message.success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
.message.error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }
.btn-worker { padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-worker:hover:not(:disabled) { background: #337ecc; }
.btn-worker:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-link { border: none; background: transparent; color: #409eff; cursor: pointer; padding: 0; }
.btn-cancel { padding: 8px 18px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; font-size: 14px; transition: all 0.2s; background: var(--surface-muted); color: var(--text-secondary); }
.worker-filter { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.worker-pill { padding: 3px 8px; border-radius: 999px; background: var(--card-bg); border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-family: monospace; }
.worker-empty-state { margin-top: 12px; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; background: var(--meta-bg); color: var(--text-muted); font-size: 13px; text-align: center; }
.prompt-status { font-size: 12px; border-radius: 999px; padding: 2px 8px; }
.prompt-status.default { background: #f3f4f6; color: #6b7280; }
.prompt-status.overridden { background: #ecfdf3; color: #16a34a; }
.prompt-status.disabled { background: #fff7ed; color: #ea580c; }
.prompt-status.warning { background: #fef3c7; color: #b45309; }

/* ─── Reintegration Card ─── */
.reintegration-card { border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(62% 0.06 250) 22%); background: linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(96% 0.01 250) 8%), var(--card-bg)); }
.reintegration-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
.reintegration-subtitle { margin-top: 4px; max-width: 56ch; }
.reintegration-head-actions { display: flex; align-items: center; gap: 10px; }
.reintegration-summary-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 14px; }
.reintegration-summary-item { padding: 10px 12px; border-radius: 10px; background: color-mix(in oklch, var(--meta-bg) 88%, oklch(97% 0.015 250) 12%); border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 82%, transparent); display: flex; align-items: baseline; justify-content: space-between; gap: 10px; color: var(--text-secondary); }
.reintegration-summary-item strong { font-size: 18px; color: var(--text); }
.reintegration-list { display: flex; flex-direction: column; gap: 12px; }
.reintegration-item { padding: 14px 16px; border-radius: 12px; border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 84%, transparent); background: color-mix(in oklch, var(--card-bg) 94%, oklch(98% 0.01 250) 6%); }
.reintegration-item-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.reintegration-item-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.reintegration-summary-text { margin: 10px 0 8px; color: var(--text); line-height: 1.55; }
.reintegration-meta-grid { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 12px; color: var(--text-muted); }
.reintegration-reason-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px; margin-top: 12px; }
.reintegration-reason-input { min-width: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid color-mix(in oklch, var(--border-color, #d1d5db) 85%, transparent); background: var(--card-bg); color: var(--text); }
.reintegration-no-plan-reason, .reintegration-review-reason { margin-top: 10px; font-size: 13px; color: var(--text-secondary); }
.reintegration-no-plan-reason { color: var(--warning-text, #9a6700); }
.reintegration-expanded { margin-top: 12px; display: grid; gap: 12px; }
.reintegration-evidence-block, .reintegration-actions-block { padding: 12px; border-radius: 10px; background: var(--meta-bg); }
.reintegration-section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
.reintegration-display-summary { display: flex; flex-direction: column; gap: 6px; color: var(--text-secondary); font-size: 13px; }
.reintegration-evidence-block pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.45; color: var(--text-secondary); }
.reintegration-actions-list { display: flex; flex-direction: column; gap: 8px; }
.reintegration-action-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px 12px; border-radius: 8px; background: color-mix(in oklch, var(--card-bg) 90%, oklch(98% 0.01 250) 10%); }
.reintegration-action-meta { margin-top: 4px; font-size: 12px; color: var(--text-muted); word-break: break-all; }
.reintegration-next-action-strip { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--text-secondary); }

/* ─── Mobile Responsive ─── */
@media (max-width: 640px) {
  .settings-card { padding: 16px; }
  .reintegration-head { flex-direction: column; }
  .reintegration-head-actions { flex-wrap: wrap; }
  .reintegration-reason-row { grid-template-columns: 1fr; }
  .reintegration-item-top { flex-direction: column; gap: 8px; }
}
</style>
