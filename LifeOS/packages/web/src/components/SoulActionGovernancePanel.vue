<template>
  <div class="settings-card soul-action-card">
    <div class="reintegration-head">
      <div>
        <h3>Soul Action Governance</h3>
        <p class="hint reintegration-subtitle">管理所有治理动作（promotion 与 worker-backed），在 web 端完成 approve / dispatch。</p>
      </div>
      <div class="reintegration-head-actions soul-action-filters">
        <select :value="filterStatus" class="worker-filter" @change="emit('update:filterStatus', ($event.target as HTMLSelectElement).value)">
          <option value="">全部治理状态</option>
          <option value="pending_review">待治理</option>
          <option value="approved">已批准</option>
          <option value="deferred">已延后</option>
          <option value="discarded">已丢弃</option>
        </select>
        <select :value="executionFilter" class="worker-filter" @change="emit('update:executionFilter', ($event.target as HTMLSelectElement).value)">
          <option value="">全部执行状态</option>
          <option value="not_dispatched">未派发</option>
          <option value="pending">已入队</option>
          <option value="running">执行中</option>
          <option value="succeeded">已执行</option>
          <option value="failed">执行失败</option>
          <option value="cancelled">已取消</option>
        </select>
        <select :value="quickFilter" class="worker-filter" @change="emit('update:quickFilter', ($event.target as HTMLSelectElement).value as SoulActionGroupQuickFilter)">
          <option value="all">全部分组</option>
          <option value="pending_only">仅待治理分组</option>
          <option value="dispatch_ready_only">仅可派发分组</option>
        </select>
        <select :value="actionKindFilter" class="worker-filter" @change="emit('update:actionKindFilter', ($event.target as HTMLSelectElement).value)">
          <option value="">全部动作类型</option>
          <option value="extract_tasks">提取任务</option>
          <option value="update_persona_snapshot">更新 Persona</option>
          <option value="create_event_node">创建 Event Node</option>
          <option value="promote_event_node">提升 Event Node</option>
          <option value="promote_continuity_record">提升 Continuity</option>
          <option value="launch_daily_report">生成日报</option>
          <option value="launch_weekly_report">生成周报</option>
          <option value="launch_openclaw_task">执行 OpenClaw</option>
          <option value="ask_followup_question">提出追问</option>
          <option value="persist_continuity_markdown">持久化连续性洞察</option>
          <option value="sync_continuity_to_r2">同步到 R2</option>
        </select>
        <button class="btn-link" @click="emit('refresh')">刷新</button>
      </div>
    </div>

    <div class="reintegration-filter-state soul-action-filter-state">
      当前分组视图：{{ quickFilterLabel }}
      <span class="worker-pill soul-action-filter-pill">{{ quickFilterStats }}</span>
    </div>

    <div class="reintegration-summary-strip soul-action-summary-strip">
      <div class="reintegration-summary-item">
        <span>待治理</span>
        <strong>{{ summary.pendingReview }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>已批准</span>
        <strong>{{ summary.approved }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>已执行</span>
        <strong>{{ summary.dispatched }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>当前分组</span>
        <strong>{{ groups.length }} / {{ groupCount }}</strong>
      </div>
    </div>

    <div v-if="message" :class="['message', messageType]">{{ message }}</div>

    <div v-if="loading" class="worker-empty-state">加载中...</div>
    <div v-else-if="groups.length" class="reintegration-list soul-action-group-list">
      <section v-for="group in groups" :key="group.groupKey" class="reintegration-item soul-action-group">
        <div class="reintegration-item-top">
          <div class="reintegration-item-title-row">
            <strong>{{ group.reintegrationRecord ? taskTypeLabel(group.reintegrationRecord.taskType) : 'Promotion actions' }}</strong>
            <span class="worker-pill">{{ group.actions.length }} actions</span>
            <span class="worker-pill">pending {{ group.pendingCount }}</span>
            <span class="worker-pill">ready {{ group.dispatchReadyCount }}</span>
            <span class="worker-pill source-pill">Reintegration {{ group.groupKey }}</span>
            <span v-if="group.recentActivityAt" class="worker-pill">{{ group.recentActivityLabel }} {{ formatTime(group.recentActivityAt) }}</span>
          </div>
          <div class="reintegration-head-actions soul-action-group-toolbar">
            <button
              class="btn-worker"
              :disabled="groupActionId === group.groupKey || group.pendingCount === 0"
              @click="emit('approve-group', group)"
            >
              {{ groupActionId === group.groupKey ? '处理中...' : `批准本组待治理项 (${group.pendingCount})` }}
            </button>
            <button
              class="btn-cancel"
              :disabled="groupDispatchId === group.groupKey || group.dispatchReadyCount !== group.actions.length || group.dispatchReadyCount === 0"
              @click="emit('dispatch-group', group)"
            >
              {{ groupDispatchId === group.groupKey ? '处理中...' : `派发本组已批准项 (${group.dispatchReadyCount})` }}
            </button>
            <button class="btn-link" @click="emit('toggle-collapsed', group.groupKey)">
              {{ collapsedGroupIds.includes(group.groupKey) ? '展开分组' : '收起分组' }}
            </button>
          </div>
        </div>

        <div class="reintegration-meta-grid soul-action-group-meta">
          <span v-if="group.reintegrationRecord">Reintegration: {{ group.reintegrationRecord.summary }}</span>
          <span v-if="group.reintegrationRecord?.sourceNoteId">Source note: {{ group.reintegrationRecord.sourceNoteId }}</span>
          <span v-if="group.reintegrationRecord">Signal: {{ group.reintegrationRecord.signalKind }}</span>
          <span v-if="group.reintegrationRecord">Review: {{ reintegrationStatusText(group.reintegrationRecord.reviewStatus) }}</span>
        </div>

        <div v-if="!collapsedGroupIds.includes(group.groupKey)" class="soul-action-group-actions">
          <article v-for="action in group.actions" :key="action.id" class="reintegration-item soul-action-item">
            <div class="reintegration-item-top">
              <div class="reintegration-item-title-row">
                <router-link :to="{ name: 'soul-action-detail', params: { id: action.id } }" class="action-detail-link"><strong>{{ promotionActionLabel(action.actionKind) }}</strong></router-link>
                <span class="prompt-status" :class="soulActionStatusClass(action)">{{ soulActionStatusText(action) }}</span>
                <span class="worker-pill" :class="{ 'action-kind-worker': isWorkerBackedAction(action) }">{{ action.actionKind }}</span>
                <span class="worker-pill">{{ action.executionStatus }}</span>
              </div>
            </div>

            <div class="reintegration-meta-grid soul-action-meta-grid">
              <span>治理: {{ action.governanceStatus }}</span>
              <span v-if="action.workerTaskId">Worker: {{ action.workerTaskId }}</span>
              <span>创建于 {{ formatTime(action.createdAt) }}</span>
              <span v-if="action.approvedAt">批准于 {{ formatTime(action.approvedAt) }}</span>
              <span v-if="action.finishedAt">完成于 {{ formatTime(action.finishedAt) }}</span>
            </div>

            <div v-if="promotionExplanationRows(action).length || action.governanceReason || formatSoulActionOutcomeSummary(action) || action.error" class="soul-action-detail-grid">
              <template v-if="promotionExplanationRows(action).length">
                <div v-for="row in promotionExplanationRows(action)" :key="`${action.id}-${row.label}`" class="reintegration-review-reason">
                  {{ row.label }}：{{ row.value }}
                </div>
              </template>
              <div v-else-if="action.governanceReason" class="reintegration-review-reason">
                治理理由：{{ action.governanceReason }}
              </div>
              <div v-if="formatSoulActionOutcomeSummary(action)" class="reintegration-review-reason">
                执行摘要：{{ formatSoulActionOutcomeSummary(action) }}
              </div>
            </div>

            <div class="soul-action-controls">
              <button
                class="btn-worker"
                :disabled="actionId === action.id || action.governanceStatus !== 'pending_review'"
                @click="emit('approve-action', action)"
              >
                {{ actionId === action.id ? '处理中...' : '批准' }}
              </button>
              <button
                class="btn-secondary"
                :disabled="actionId === action.id || action.governanceStatus !== 'pending_review'"
                @click="emit('defer-action', action)"
              >
                {{ actionId === action.id ? '处理中...' : '延后' }}
              </button>
              <button
                class="btn-danger-sm"
                :disabled="actionId === action.id || action.governanceStatus !== 'pending_review'"
                @click="emit('discard-action', action)"
              >
                {{ actionId === action.id ? '处理中...' : '丢弃' }}
              </button>
              <button
                class="btn-cancel"
                :disabled="actionId === action.id || action.governanceStatus !== 'approved' || action.executionStatus !== 'not_dispatched'"
                @click="emit('dispatch-action', action)"
              >
                {{ actionId === action.id ? '处理中...' : '派发执行' }}
              </button>
            </div>

            <!-- ask_followup_question answer UI -->
            <div
              v-if="action.actionKind === 'ask_followup_question' && action.executionStatus === 'pending'"
              class="followup-answer-section"
            >
              <div class="followup-question-display">
                <span class="followup-label">🤔 追问：</span>
                <span>{{ action.governanceReason }}</span>
              </div>
              <div class="followup-input-row">
                <textarea
                  :id="`followup-${action.id}`"
                  class="followup-textarea"
                  placeholder="在此输入回答…"
                  rows="2"
                ></textarea>
                <button
                  class="btn-worker followup-submit"
                  :disabled="actionId === action.id"
                  @click="emit('answer-followup', action, ($event.target as HTMLElement).closest('.followup-input-row')?.querySelector('textarea')?.value ?? '')"
                >
                  {{ actionId === action.id ? '提交中...' : '回答' }}
                </button>
              </div>
            </div>

          </article>
        </div>
      </section>
    </div>
    <div v-else class="worker-empty-state">
      当前筛选下没有 soul actions
      <span class="worker-empty-hint">可尝试切换为“全部分组”或检查是否还有已批准但未派发的分组。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatSoulActionOutcomeSummary, getPromotionExplanationRows } from '@lifeos/shared';
import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';
import type { SoulActionGroup, SoulActionGroupQuickFilter } from '../utils/soulActionGroups';

defineProps<{
  filterStatus: '' | SoulAction['governanceStatus'];
  executionFilter: '' | SoulAction['executionStatus'];
  actionKindFilter: '' | SoulAction['actionKind'];
  quickFilter: SoulActionGroupQuickFilter;
  quickFilterLabel: string;
  quickFilterStats: string;
  groupCount: number;
  groups: SoulActionGroup[];
  summary: {
    pendingReview: number;
    approved: number;
    dispatched: number;
  };
  loading: boolean;
  message: string;
  messageType: 'success' | 'error';
  actionId: string | null;
  groupActionId: string | null;
  groupDispatchId: string | null;
  collapsedGroupIds: string[];
  taskTypeLabel: (taskType: string) => string;
  reintegrationStatusText: (status: ReintegrationRecord['reviewStatus']) => string;
  promotionActionLabel: (actionKind: SoulAction['actionKind']) => string;
  soulActionStatusClass: (action: SoulAction) => string;
  soulActionStatusText: (action: SoulAction) => string;
  formatTime: (ts: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:filterStatus', value: string): void;
  (event: 'update:executionFilter', value: string): void;
  (event: 'update:actionKindFilter', value: string): void;
  (event: 'update:quickFilter', value: SoulActionGroupQuickFilter): void;
  (event: 'refresh'): void;
  (event: 'approve-group', group: SoulActionGroup): void;
  (event: 'dispatch-group', group: SoulActionGroup): void;
  (event: 'toggle-collapsed', groupKey: string): void;
  (event: 'approve-action', action: SoulAction): void;
  (event: 'defer-action', action: SoulAction): void;
  (event: 'discard-action', action: SoulAction): void;
  (event: 'dispatch-action', action: SoulAction): void;
  (event: 'answer-followup', action: SoulAction, answer: string): void;
}>();

function promotionExplanationRows(action: SoulAction) {
  return getPromotionExplanationRows(action);
}

function isWorkerBackedAction(action: SoulAction): boolean {
  return action.actionKind.startsWith('launch_');
}
</script>

<style scoped>
.followup-answer-section {
  margin-top: 10px;
  padding: 12px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--card-bg, #fff) 92%, oklch(95% 0.04 200) 8%);
  border: 1px solid color-mix(in oklch, var(--border, #e5e7eb) 80%, oklch(70% 0.06 200) 20%);
}

.followup-question-display {
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.followup-label {
  font-weight: 600;
}

.followup-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.followup-textarea {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  min-height: 48px;
  font-family: inherit;
  background: var(--card-bg, #fff);
}

.followup-textarea:focus {
  outline: none;
  border-color: oklch(60% 0.15 220);
  box-shadow: 0 0 0 2px oklch(60% 0.15 220 / 0.15);
}

.followup-submit {
  white-space: nowrap;
  align-self: flex-end;
}
</style>
