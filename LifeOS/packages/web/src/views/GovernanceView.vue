<template>
  <div class="governance-view">
    <h2>治理中心</h2>

    <!-- Reintegration Review -->
    <div class="settings-card reintegration-card">
      <div class="reintegration-head">
        <div>
          <h3>Reintegration Review</h3>
          <p class="hint reintegration-subtitle">复核终态 worker 回流记录，accept 时自动规划 PR6 promotion actions。</p>
        </div>
        <div class="reintegration-head-actions">
          <select v-model="reintegrationFilterStatus" class="worker-filter" @change="loadReintegrationRecords">
            <option value="">全部状态</option>
            <option value="pending_review">待复核</option>
            <option value="accepted">已接受</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button class="btn-link" @click="loadReintegrationRecords">刷新</button>
        </div>
      </div>

      <div class="reintegration-summary-strip">
        <div class="reintegration-summary-item">
          <span>待复核</span>
          <strong>{{ reintegrationStatusSummary.pending_review }}</strong>
        </div>
        <div class="reintegration-summary-item">
          <span>已接受</span>
          <strong>{{ reintegrationStatusSummary.accepted }}</strong>
        </div>
        <div class="reintegration-summary-item">
          <span>已拒绝</span>
          <strong>{{ reintegrationStatusSummary.rejected }}</strong>
        </div>
      </div>

      <div v-if="reintegrationMessage" :class="['message', reintegrationMessageType]">{{ reintegrationMessage }}</div>

      <div v-if="reintegrationLoading" class="worker-empty-state">加载中...</div>
      <div v-else-if="reintegrationRecords.length" class="reintegration-list">
        <article v-for="record in reintegrationRecords" :key="record.id" class="reintegration-item">
          <div class="reintegration-item-top">
            <div class="reintegration-item-title-row">
              <strong>{{ taskTypeLabel(record.taskType) }}</strong>
              <span class="prompt-status" :class="reintegrationStatusClass(record.reviewStatus)">{{ reintegrationStatusText(record.reviewStatus) }}</span>
              <span class="worker-pill">{{ formatReintegrationSignalKindLabel(record) }}</span>
              <span class="worker-pill">强度 {{ formatReintegrationStrengthLabel(record) }}</span>
            </div>
            <button class="btn-link" @click="toggleReintegrationExpanded(record.id)">
              {{ reintegrationExpandedIds.includes(record.id) ? '收起详情' : '展开详情' }}
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
              v-model="reintegrationReasonDrafts[record.id]"
              type="text"
              class="reintegration-reason-input"
              placeholder="可选：输入 accept/reject 理由"
              :disabled="reintegrationActionId === record.id"
            />
            <button
              class="btn-worker"
              :disabled="reintegrationActionId === record.id || record.reviewStatus !== 'pending_review'"
              @click="handleAcceptReintegration(record)"
            >
              {{ reintegrationActionId === record.id ? '处理中...' : '接受并自动规划' }}
            </button>
            <button
              class="btn-cancel"
              :disabled="reintegrationActionId === record.id || record.reviewStatus !== 'pending_review'"
              @click="handleRejectReintegration(record)"
            >
              拒绝
            </button>
            <button
              class="btn-link"
              :disabled="reintegrationActionId === record.id || record.reviewStatus !== 'accepted'"
              @click="handlePlanReintegration(record)"
            >
              手动补规划
            </button>
          </div>

          <div v-if="record.reviewReason" class="reintegration-review-reason">
            复核理由：{{ record.reviewReason }}
          </div>

          <div v-if="reintegrationExpandedIds.includes(record.id)" class="reintegration-expanded">
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

            <div v-if="reintegrationPlannedActions[record.id]?.length" class="reintegration-actions-block">
              <div class="reintegration-section-label">Planned promotion actions</div>
              <div class="reintegration-actions-list">
                <div v-for="action in reintegrationPlannedActions[record.id]" :key="action.id" class="reintegration-action-item">
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

    <!-- Soul Action Governance -->
    <SoulActionGovernancePanel
      :filter-status="soulActionFilterStatus"
      :execution-filter="soulActionExecutionFilter"
      :action-kind-filter="soulActionActionKindFilter"
      :quick-filter="soulActionGroupQuickFilter"
      :quick-filter-label="soulActionGroupQuickFilterLabel"
      :quick-filter-stats="soulActionGroupQuickFilterStats"
      :group-count="soulActionGroupCount"
      :groups="soulActionGroups"
      :summary="soulActionSummary"
      :loading="soulActionLoading"
      :message="soulActionMessage"
      :message-type="soulActionMessageType"
      :action-id="soulActionActionId"
      :group-action-id="soulActionGroupActionId"
      :group-dispatch-id="soulActionGroupDispatchId"
      :collapsed-group-ids="soulActionCollapsedGroupIds"
      :task-type-label="taskTypeLabel"
      :reintegration-status-text="reintegrationStatusText"
      :promotion-action-label="promotionActionLabel"
      :soul-action-status-class="soulActionStatusClass"
      :soul-action-status-text="soulActionStatusText"
      :format-time="formatTime"
      @update:filterStatus="soulActionFilterStatus = $event as '' | SoulAction['governanceStatus']"
      @update:executionFilter="soulActionExecutionFilter = $event as '' | SoulAction['executionStatus']"
      @update:actionKindFilter="soulActionActionKindFilter = $event as '' | SoulAction['actionKind']"
      @update:quickFilter="soulActionGroupQuickFilter = $event"
      @refresh="loadSoulActions"
      @approve-group="handleApproveSoulActionGroup"
      @dispatch-group="handleDispatchSoulActionGroup"
      @toggle-collapsed="toggleSoulActionGroupCollapsed"
      @approve-action="handleApproveSoulAction"
      @defer-action="handleDeferSoulAction"
      @discard-action="handleDiscardSoulAction"
      @dispatch-action="handleDispatchSoulAction"
    />

    <!-- Projection Panel -->
    <PromotionProjectionPanel
      :event-nodes="eventNodes"
      :continuity-records="continuityRecords"
      :loading="projectionLoading"
      :message="projectionMessage"
      :message-type="projectionMessageType"
      :format-time="formatTime"
      @refresh="loadPromotionProjections"
    />

    <!-- Brainstorm Sessions -->
    <div class="settings-card brainstorm-card">
      <div class="reintegration-head">
        <div>
          <h3>认知分析 (BrainstormSession)</h3>
          <p class="hint reintegration-subtitle">每次笔记更新后，系统自动提炼的结构化认知快照。</p>
        </div>
        <button class="btn-link" @click="loadBrainstormSessions">刷新</button>
      </div>

      <div v-if="brainstormLoading" class="worker-empty-state">加载中...</div>
      <div v-else-if="brainstormSessions.length" class="brainstorm-list">
        <article v-for="session in brainstormSessions" :key="session.id" class="brainstorm-item">
          <div class="brainstorm-header">
            <span class="mono hint">{{ session.sourceNoteId }}</span>
            <span class="worker-pill">{{ session.emotionalTone || '—' }}</span>
            <span class="worker-pill">可行动 {{ (session.actionability * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="session.themes.length" class="brainstorm-tags">
            <span v-for="t in session.themes" :key="t" class="brainstorm-tag theme">{{ t }}</span>
          </div>
          <div v-if="session.distilledInsights.length" class="brainstorm-insights">
            <span v-for="i in session.distilledInsights" :key="i" class="brainstorm-insight">{{ i }}</span>
          </div>
          <div v-if="session.suggestedActionKinds.length" class="brainstorm-tags">
            <span v-for="a in session.suggestedActionKinds" :key="a" class="brainstorm-tag action">{{ a }}</span>
          </div>
          <div v-if="session.continuitySignals.length" class="brainstorm-tags">
            <span v-for="c in session.continuitySignals" :key="c" class="brainstorm-tag continuity">{{ c }}</span>
          </div>
          <div class="brainstorm-preview">{{ session.rawInputPreview.slice(0, 150) }}{{ session.rawInputPreview.length > 150 ? '…' : '' }}</div>
          <div class="mono hint" style="font-size:11px">{{ formatTime(session.updatedAt) }}</div>
        </article>
      </div>
      <div v-else class="worker-empty-state">暂无认知分析记录。触发方式：新建或修改任意笔记。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import SoulActionGovernancePanel from '../components/SoulActionGovernancePanel.vue';
import PromotionProjectionPanel from '../components/PromotionProjectionPanel.vue';
import { fetchReintegrationRecords, acceptReintegrationRecord, rejectReintegrationRecord, planReintegrationPromotions, fetchSoulActions, approveSoulAction, deferSoulAction, discardSoulAction, dispatchSoulAction, fetchEventNodeProjectionList, fetchContinuityProjectionList, fetchBrainstormSessions } from '../api/client';
import type { ReintegrationRecord, SoulAction, EventNode, ContinuityRecord, WsEvent, BrainstormSession } from '@lifeos/shared';
import { formatReintegrationSignalKindLabel, formatReintegrationStrengthLabel, formatReintegrationTargetLabel, formatSoulActionKindLabel, formatSoulActionPromotionSummary, formatSoulActionSourceLabel, getDispatchExecutionMessage, getReintegrationExtractTaskItems, getReintegrationOutcomeDetailRows, getReintegrationOutcomeNoPlanReason, getReintegrationOutcomeStripRows, getReintegrationReviewMessage, getSoulActionGovernanceMessage } from '@lifeos/shared';
import { workerTaskStatusLabel, workerTaskTypeLabel, workerTaskWorkerLabel } from '../utils/workerTaskLabels';
import { useWebSocket } from '../composables/useWebSocket';
import { buildSoulActionGroups, getSoulActionGroupCount, getSoulActionGroupQuickFilterLabel, getSoulActionGroupQuickFilterStats, type SoulActionGroupQuickFilter } from '../utils/soulActionGroups';

const { isConnected } = useWebSocket();

// ── Reintegration State ────────────────────────────────
const reintegrationRecords = ref<ReintegrationRecord[]>([]);
const reintegrationFilterStatus = ref<'' | ReintegrationRecord['reviewStatus']>('pending_review');
const reintegrationLoading = ref(false);
const reintegrationMessage = ref('');
const reintegrationMessageType = ref<'success' | 'error'>('success');
const reintegrationActionId = ref<string | null>(null);
const reintegrationReasonDrafts = ref<Record<string, string>>({});
const reintegrationPlannedActions = ref<Record<string, SoulAction[]>>({});
const reintegrationExpandedIds = ref<string[]>([]);

// ── Soul Action State ──────────────────────────────────
const soulActions = ref<SoulAction[]>([]);
const soulActionLoading = ref(false);
const soulActionMessage = ref('');
const soulActionMessageType = ref<'success' | 'error'>('success');
const soulActionFilterStatus = ref<'' | SoulAction['governanceStatus']>('pending_review');
const soulActionExecutionFilter = ref<'' | SoulAction['executionStatus']>('not_dispatched');
const soulActionActionKindFilter = ref<'' | SoulAction['actionKind']>('');
const soulActionActionId = ref<string | null>(null);
const soulActionGroupActionId = ref<string | null>(null);
const soulActionGroupDispatchId = ref<string | null>(null);
const soulActionCollapsedGroupIds = ref<string[]>([]);

// ── Projection State ───────────────────────────────────
const eventNodes = ref<EventNode[]>([]);
const continuityRecords = ref<ContinuityRecord[]>([]);
const projectionLoading = ref(false);
const projectionMessage = ref('');
const projectionMessageType = ref<'success' | 'error'>('success');

// ── Brainstorm State ──────────────────────────────────────
const brainstormSessions = ref<BrainstormSession[]>([]);
const brainstormLoading = ref(false);

// ── Computed ───────────────────────────────────────────
const reintegrationStatusSummary = computed(() => {
  return reintegrationRecords.value.reduce((acc, record) => {
    acc[record.reviewStatus] += 1;
    return acc;
  }, { pending_review: 0, accepted: 0, rejected: 0 } as Record<ReintegrationRecord['reviewStatus'], number>);
});

const acceptedProjectionSourceReintegrationIds = ref<string[]>([]);
const activeProjectionSourceReintegrationIds = computed(() => {
  const plannedIds = Object.entries(reintegrationPlannedActions.value)
    .filter(([, actions]) => actions.some((action) => action.actionKind === 'create_event_node' || action.actionKind === 'promote_event_node' || action.actionKind === 'promote_continuity_record'))
    .map(([recordId]) => recordId);
  return [...new Set([...acceptedProjectionSourceReintegrationIds.value, ...plannedIds])];
});

const soulActionSummary = computed(() => {
  return soulActions.value.reduce((acc, action) => {
    acc.pendingReview += action.governanceStatus === 'pending_review' ? 1 : 0;
    acc.approved += action.governanceStatus === 'approved' ? 1 : 0;
    acc.dispatched += action.executionStatus === 'succeeded' ? 1 : 0;
    return acc;
  }, { pendingReview: 0, approved: 0, dispatched: 0 });
});

const soulActionGroupQuickFilter = ref<SoulActionGroupQuickFilter>('all');
const soulActionGroupQuickFilterLabel = computed(() => getSoulActionGroupQuickFilterLabel(soulActionGroupQuickFilter.value));
const soulActionGroupQuickFilterStats = computed(() => getSoulActionGroupQuickFilterStats(soulActions.value, reintegrationRecords.value, soulActionGroupQuickFilter.value));
const soulActionGroupCount = computed(() => getSoulActionGroupCount(soulActions.value));
const soulActionGroups = computed(() => buildSoulActionGroups(soulActions.value, reintegrationRecords.value, soulActionGroupQuickFilter.value));

// ── Data Loading ───────────────────────────────────────
async function loadReintegrationRecords(options?: { preserveMessage?: boolean }) {
  reintegrationLoading.value = true;
  if (!options?.preserveMessage) reintegrationMessage.value = '';
  try {
    const [filteredRecords, acceptedProjectionRecords] = await Promise.all([
      fetchReintegrationRecords({ reviewStatus: reintegrationFilterStatus.value || undefined }),
      fetchReintegrationRecords({ reviewStatus: 'accepted' }),
    ]);
    reintegrationRecords.value = filteredRecords;
    acceptedProjectionSourceReintegrationIds.value = acceptedProjectionRecords.map((record) => record.id);
  } catch (e: any) {
    reintegrationMessage.value = e.message || '加载 reintegration records 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationLoading.value = false;
  }
}

async function loadSoulActions(options?: { preserveMessage?: boolean }) {
  soulActionLoading.value = true;
  if (!options?.preserveMessage) soulActionMessage.value = '';
  try {
    soulActions.value = await fetchSoulActions({
      governanceStatus: soulActionFilterStatus.value || undefined,
      executionStatus: soulActionExecutionFilter.value || undefined,
      actionKind: soulActionActionKindFilter.value || undefined,
    });
  } catch (e: any) {
    soulActionMessage.value = e.message || '加载 soul actions 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionLoading.value = false;
  }
}

async function loadPromotionProjections(options?: { preserveMessage?: boolean }) {
  projectionLoading.value = true;
  if (!options?.preserveMessage) projectionMessage.value = '';
  try {
    const sourceReintegrationIds = activeProjectionSourceReintegrationIds.value;
    const [eventNodeResult, continuityResult] = await Promise.allSettled([
      fetchEventNodeProjectionList(sourceReintegrationIds),
      fetchContinuityProjectionList(sourceReintegrationIds),
    ]);

    const projectionErrors: string[] = [];

    if (eventNodeResult.status === 'fulfilled') {
      const serverScopedIds = new Set(eventNodeResult.value.filters.sourceReintegrationIds);
      eventNodes.value = eventNodeResult.value.items.filter((eventNode) => (serverScopedIds.size === 0 || serverScopedIds.has(eventNode.sourceReintegrationId)));
    } else {
      eventNodes.value = [];
      projectionErrors.push(eventNodeResult.reason?.message || '加载 event nodes 失败');
    }

    if (continuityResult.status === 'fulfilled') {
      const serverScopedIds = new Set(continuityResult.value.filters.sourceReintegrationIds);
      continuityRecords.value = continuityResult.value.items.filter((continuity) => (serverScopedIds.size === 0 || serverScopedIds.has(continuity.sourceReintegrationId)));
    } else {
      continuityRecords.value = [];
      projectionErrors.push(continuityResult.reason?.message || '加载 continuity records 失败');
    }

    if (projectionErrors.length) {
      projectionMessage.value = projectionErrors.join('；');
      projectionMessageType.value = 'error';
    }
  } finally {
    projectionLoading.value = false;
  }
}

async function loadBrainstormSessions() {
  brainstormLoading.value = true;
  try {
    const result = await fetchBrainstormSessions(30);
    brainstormSessions.value = result.sessions;
  } catch (e) {
    console.warn('Failed to load brainstorm sessions:', e);
  } finally {
    brainstormLoading.value = false;
  }
}

// ── Label / Status Helpers ─────────────────────────────
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

function soulActionStatusClass(action: SoulAction) {
  if (action.executionStatus === 'succeeded') return 'overridden';
  if (action.governanceStatus === 'approved') return 'warning';
  if (action.governanceStatus === 'discarded' || action.executionStatus === 'failed') return 'disabled';
  return 'default';
}

function soulActionStatusText(action: SoulAction) {
  if (action.executionStatus === 'succeeded') return '已执行';
  if (action.governanceStatus === 'approved') return '已批准';
  if (action.governanceStatus === 'deferred') return '已延后';
  if (action.governanceStatus === 'discarded') return '已丢弃';
  if (action.executionStatus === 'failed') return '执行失败';
  return '待治理';
}

function toggleReintegrationExpanded(id: string) {
  if (reintegrationExpandedIds.value.includes(id)) {
    reintegrationExpandedIds.value = reintegrationExpandedIds.value.filter((item) => item !== id);
    return;
  }
  reintegrationExpandedIds.value = [...reintegrationExpandedIds.value, id];
}

function toggleSoulActionGroupCollapsed(id: string) {
  if (soulActionCollapsedGroupIds.value.includes(id)) {
    soulActionCollapsedGroupIds.value = soulActionCollapsedGroupIds.value.filter((item) => item !== id);
    return;
  }
  soulActionCollapsedGroupIds.value = [...soulActionCollapsedGroupIds.value, id];
}

function taskTypeLabel(taskType: string): string {
  return workerTaskTypeLabel(taskType);
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function soulActionApprovalReasonLabel(action: Pick<SoulAction, 'sourceNoteId' | 'sourceReintegrationId'>): string {
  return formatSoulActionSourceLabel(action);
}

function buildDispatchedWorkerTaskSuffix(result: Awaited<ReturnType<typeof dispatchSoulAction>>): string {
  const wtLabel = result.task ? workerTaskTypeLabel(result.task.taskType) : null;
  const wtStatus = result.task ? workerTaskStatusLabel(result.task.status) : null;
  const wtWorker = result.task ? workerTaskWorkerLabel(result.task.worker) : null;
  const wtMeta = [wtLabel, wtStatus, wtWorker].filter(Boolean).join(' · ');
  return result.result.workerTaskId ? `（Worker Task: ${result.result.workerTaskId}${wtMeta ? ` · ${wtMeta}` : ''}）` : '';
}

// ── Action Handlers ────────────────────────────────────
async function handleAcceptReintegration(record: ReintegrationRecord) {
  reintegrationActionId.value = record.id;
  reintegrationMessage.value = '';
  try {
    const result = await acceptReintegrationRecord(record.id, { reason: reintegrationReasonDrafts.value[record.id]?.trim() || undefined });
    reintegrationPlannedActions.value = { ...reintegrationPlannedActions.value, [record.id]: result.soulActions };
    reintegrationExpandedIds.value = reintegrationExpandedIds.value.includes(record.id) ? reintegrationExpandedIds.value : [...reintegrationExpandedIds.value, record.id];
    reintegrationMessage.value = getReintegrationReviewMessage('accept', result.displaySummary);
    reintegrationMessageType.value = 'success';
    await loadReintegrationRecords({ preserveMessage: true });
    await loadSoulActions();
    await loadPromotionProjections({ preserveMessage: true });
  } catch (e: any) {
    reintegrationMessage.value = e.message || '接受 reintegration record 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationActionId.value = null;
  }
}

async function handleRejectReintegration(record: ReintegrationRecord) {
  reintegrationActionId.value = record.id;
  reintegrationMessage.value = '';
  try {
    await rejectReintegrationRecord(record.id, { reason: reintegrationReasonDrafts.value[record.id]?.trim() || undefined });
    reintegrationMessage.value = getReintegrationReviewMessage('reject');
    reintegrationMessageType.value = 'success';
    await loadReintegrationRecords({ preserveMessage: true });
  } catch (e: any) {
    reintegrationMessage.value = e.message || '拒绝 reintegration record 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationActionId.value = null;
  }
}

async function handlePlanReintegration(record: ReintegrationRecord) {
  reintegrationActionId.value = record.id;
  reintegrationMessage.value = '';
  try {
    const result = await planReintegrationPromotions(record.id);
    const sa = result.soulActions || [];
    reintegrationPlannedActions.value = { ...reintegrationPlannedActions.value, [record.id]: sa };
    reintegrationExpandedIds.value = reintegrationExpandedIds.value.includes(record.id) ? reintegrationExpandedIds.value : [...reintegrationExpandedIds.value, record.id];
    reintegrationMessage.value = getReintegrationReviewMessage('plan', result.displaySummary);
    reintegrationMessageType.value = 'success';
    await loadReintegrationRecords({ preserveMessage: true });
    await loadSoulActions();
    await loadPromotionProjections({ preserveMessage: true });
  } catch (e: any) {
    reintegrationMessage.value = e.message || '手动规划 promotion actions 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationActionId.value = null;
  }
}

async function handleApproveSoulAction(action: SoulAction) {
  soulActionActionId.value = action.id;
  soulActionMessage.value = '';
  try {
    await approveSoulAction(action.id, { reason: `Approved from governance panel for ${soulActionApprovalReasonLabel(action)}` });
    soulActionMessage.value = getSoulActionGovernanceMessage(action, 'approved');
    soulActionMessageType.value = 'success';
    await loadSoulActions({ preserveMessage: true });
  } catch (e: any) {
    soulActionMessage.value = e.message || '批准 soul action 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionActionId.value = null;
  }
}

async function handleApproveSoulActionGroup(group: { groupKey: string; actions: SoulAction[]; pendingCount: number }) {
  const pendingActions = group.actions.filter((action) => action.governanceStatus === 'pending_review');
  if (!pendingActions.length) { soulActionMessage.value = '当前分组没有待批准的 soul actions'; soulActionMessageType.value = 'error'; return; }
  soulActionGroupActionId.value = group.groupKey;
  soulActionMessage.value = '';
  try {
    for (const action of pendingActions) {
      await approveSoulAction(action.id, { reason: `Batch approved from governance panel for ${soulActionApprovalReasonLabel(action)}` });
    }
    soulActionMessage.value = `已批量批准 ${pendingActions.length}/${group.actions.length} 条 soul actions`;
    soulActionMessageType.value = 'success';
    await loadSoulActions({ preserveMessage: true });
  } catch (e: any) {
    soulActionMessage.value = e.message || '批量批准 soul actions 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionGroupActionId.value = null;
  }
}

async function handleDispatchSoulActionGroup(group: { groupKey: string; actions: SoulAction[]; dispatchReadyCount: number }) {
  const dispatchableActions = group.actions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched');
  if (!dispatchableActions.length) { soulActionMessage.value = '当前分组没有可派发的 soul actions'; soulActionMessageType.value = 'error'; return; }
  if (dispatchableActions.length !== group.actions.length) { soulActionMessage.value = '仅当本组 actions 全部已批准且未派发时才支持组级派发'; soulActionMessageType.value = 'error'; return; }
  soulActionGroupDispatchId.value = group.groupKey;
  soulActionMessage.value = '';
  try {
    const dispatchResults = [] as Awaited<ReturnType<typeof dispatchSoulAction>>[];
    for (const action of dispatchableActions) { dispatchResults.push(await dispatchSoulAction(action.id)); }
    const lastResult = dispatchResults.at(-1) ?? null;
    const suffix = buildDispatchedWorkerTaskSuffix(lastResult);
    const lastMsg = lastResult ? getDispatchExecutionMessage(lastResult.result) : null;
    soulActionMessage.value = lastMsg ? `已批量派发 ${dispatchableActions.length}/${group.actions.length} 条 soul actions · ${lastMsg}${suffix}` : `已批量派发 ${dispatchableActions.length}/${group.actions.length} 条 soul actions${suffix}`;
    soulActionMessageType.value = 'success';
    await loadSoulActions({ preserveMessage: true });
    await loadReintegrationRecords();
  } catch (e: any) {
    soulActionMessage.value = e.message || '批量派发 soul actions 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionGroupDispatchId.value = null;
  }
}

async function handleDeferSoulAction(action: SoulAction) {
  soulActionActionId.value = action.id;
  soulActionMessage.value = '';
  try {
    await deferSoulAction(action.id, { reason: `Deferred from governance panel for ${soulActionApprovalReasonLabel(action)}` });
    soulActionMessage.value = getSoulActionGovernanceMessage(action, 'deferred');
    soulActionMessageType.value = 'success';
    await loadSoulActions({ preserveMessage: true });
  } catch (e: any) {
    soulActionMessage.value = e.message || '延后 soul action 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionActionId.value = null;
  }
}

async function handleDiscardSoulAction(action: SoulAction) {
  soulActionActionId.value = action.id;
  soulActionMessage.value = '';
  try {
    await discardSoulAction(action.id, { reason: `Discarded from governance panel for ${soulActionApprovalReasonLabel(action)}` });
    soulActionMessage.value = getSoulActionGovernanceMessage(action, 'discarded');
    soulActionMessageType.value = 'success';
    await loadSoulActions({ preserveMessage: true });
  } catch (e: any) {
    soulActionMessage.value = e.message || '丢弃 soul action 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionActionId.value = null;
  }
}

async function handleDispatchSoulAction(action: SoulAction) {
  soulActionActionId.value = action.id;
  soulActionMessage.value = '';
  try {
    const result = await dispatchSoulAction(action.id);
    const suffix = buildDispatchedWorkerTaskSuffix(result);
    soulActionMessage.value = `${getDispatchExecutionMessage(result.result)}${suffix}`;
    soulActionMessageType.value = result.result.dispatched ? 'success' : 'error';
    await loadSoulActions({ preserveMessage: true });
    await loadReintegrationRecords();
  } catch (e: any) {
    soulActionMessage.value = e.message || '派发 soul action 失败';
    soulActionMessageType.value = 'error';
  } finally {
    soulActionActionId.value = null;
  }
}

// ── WebSocket ──────────────────────────────────────────
function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  const preserveSoulActionMessage = soulActionMessageType.value === 'success' && Boolean(soulActionMessage.value);
  const preserveReintegrationMessage = reintegrationMessageType.value === 'success' && Boolean(reintegrationMessage.value);
  if (wsEvent.type === 'worker-task-updated' || wsEvent.type === 'soul-action-updated' || wsEvent.type === 'reintegration-record-updated') {
    loadReintegrationRecords({ preserveMessage: preserveReintegrationMessage });
    loadSoulActions({ preserveMessage: preserveSoulActionMessage });
    if (wsEvent.type === 'soul-action-updated' || wsEvent.type === 'reintegration-record-updated') {
      loadPromotionProjections({ preserveMessage: true });
    }
  }
  if (wsEvent.type === 'event-node-updated' || wsEvent.type === 'continuity-record-updated') {
    loadPromotionProjections();
  }
}

onMounted(async () => {
  await loadReintegrationRecords();
  await loadSoulActions();
  await loadPromotionProjections({ preserveMessage: true });
  loadBrainstormSessions();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});
</script>

<style scoped>
.governance-view {
  max-width: 800px;
  margin: 0 auto;
}

.governance-view h2 {
  font-size: 22px;
  margin-bottom: 20px;
}

/* ─── Shared styles (same as SettingsView) ─── */
.settings-card { background: var(--card-bg); border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px var(--shadow); }
.settings-card h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.message { padding: 10px 14px; border-radius: 4px; font-size: 14px; margin-top: 12px; }
.message.success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
.message.error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }

/* ─── Brainstorm Panel ─── */
.brainstorm-card {
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(66% 0.06 200) 22%);
  background: linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(97% 0.015 200) 8%), var(--card-bg));
}

.brainstorm-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brainstorm-item {
  padding: 14px 16px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--card-bg) 92%, oklch(96% 0.01 200) 8%);
  border: 1px solid var(--border);
}

.brainstorm-header {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.brainstorm-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.brainstorm-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--border);
}

.brainstorm-tag.theme { background: oklch(95% 0.02 200); color: oklch(40% 0.1 200); }
.brainstorm-tag.action { background: oklch(95% 0.03 150); color: oklch(40% 0.1 150); }
.brainstorm-tag.continuity { background: oklch(95% 0.02 280); color: oklch(45% 0.08 280); }

.brainstorm-insights {
  margin-bottom: 6px;
}

.brainstorm-insight {
  display: block;
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
}

.brainstorm-preview {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 4px;
  margin-bottom: 4px;
}
.btn-worker { padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-worker:hover:not(:disabled) { background: #337ecc; }
.btn-worker:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-link { border: none; background: transparent; color: #409eff; cursor: pointer; padding: 0; }
.btn-cancel, .btn-confirm-danger { padding: 8px 18px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; font-size: 14px; transition: all 0.2s; }
.btn-cancel { background: var(--surface-muted); color: var(--text-secondary); }
.worker-filter { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.worker-pill { padding: 3px 8px; border-radius: 999px; background: var(--card-bg); border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-family: monospace; }
.worker-empty-state { margin-top: 12px; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; background: var(--meta-bg); color: var(--text-muted); font-size: 13px; text-align: center; }
.worker-empty-hint { display: block; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
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

/* ─── Soul Action ─── */
.soul-action-card { border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(66% 0.05 150) 22%); background: linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(97% 0.015 150) 8%), var(--card-bg)); }
.soul-action-filters { flex-wrap: wrap; justify-content: flex-end; }
.soul-action-summary-strip { margin-bottom: 14px; }
.soul-action-group-list { gap: 12px; }
.soul-action-group { display: grid; gap: 12px; border-style: dashed; }
.soul-action-group-meta { margin-top: 0; }
.soul-action-group-toolbar { flex-wrap: wrap; justify-content: flex-end; }
.soul-action-group-actions { display: grid; gap: 10px; }
.soul-action-item { display: grid; gap: 12px; background: color-mix(in oklch, var(--card-bg) 88%, oklch(98% 0.012 150) 12%); }
.soul-action-meta-grid { margin-top: 0; }
.soul-action-detail-grid { display: grid; gap: 6px; }
.soul-action-controls { display: flex; flex-wrap: wrap; gap: 8px; }
.soul-action-filter-state { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; font-size: 12px; color: var(--text-muted); }
.soul-action-filter-pill { font-size: 11px; }
.btn-secondary { padding: 8px 16px; background: var(--surface-muted); color: var(--text-secondary); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-danger-sm { padding: 6px 14px; border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); cursor: pointer; font-size: 12px; }
.source-pill { background: color-mix(in oklch, var(--card-bg) 85%, oklch(80% 0.04 250) 15%); }
.action-kind-worker { background: color-mix(in oklch, oklch(95% 0.03 280) 60%, var(--card-bg) 40%); color: oklch(45% 0.12 280); border-color: color-mix(in oklch, oklch(80% 0.06 280) 40%, var(--border) 60%); }
.action-detail-link { text-decoration: none; color: inherit; }
.action-detail-link:hover { color: #409eff; }
</style>
