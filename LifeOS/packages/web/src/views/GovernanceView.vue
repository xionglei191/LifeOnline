<template>
  <div class="governance-view">
    <h2>治理中心</h2>

    <nav class="gov-tabs" aria-label="治理中心面板切换">
      <button
        :class="['gov-tab', { active: activeTab === 'governance' }]"
        @click="activeTab = 'governance'"
      >
        ⚖ 治理审批
      </button>
      <button
        :class="['gov-tab', { active: activeTab === 'projection' }]"
        @click="switchTab('projection')"
      >
        ◈ 投射分析
      </button>
      <button
        :class="['gov-tab', { active: activeTab === 'insights' }]"
        @click="switchTab('insights')"
      >
        ✧ 智能洞察
      </button>
    </nav>

    <!-- Tab 1: 治理审批 -->
    <div v-if="activeTab === 'governance'">
      <!-- PhysicalAction 授权审批 -->
      <section v-if="physicalActions.length" class="pa-section">
        <h3 class="section-title">⚡ 物理动作待授权 <span class="badge">{{ physicalActions.length }}</span></h3>
        <div class="pa-list">
          <PhysicalActionCard
            v-for="pa in physicalActions"
            :key="pa.id"
            :action="pa"
            :acting="paActingId === pa.id"
            @approve="handleApprovePA"
            @reject="handleRejectPA"
          />
        </div>
      </section>

      <ReintegrationReviewPanel
        :records="reintegrationRecords"
        :filter-status="reintegrationFilterStatus"
        :loading="reintegrationLoading"
        :message="reintegrationMessage"
        :message-type="reintegrationMessageType"
        :action-id="reintegrationActionId"
        :reason-drafts="reintegrationReasonDrafts"
        :planned-actions="reintegrationPlannedActions"
        :expanded-ids="reintegrationExpandedIds"
        :status-summary="reintegrationStatusSummary"
        :format-time="formatTime"
        :task-type-label="taskTypeLabel"
        @update:filterStatus="reintegrationFilterStatus = $event as '' | 'pending_review' | 'accepted' | 'rejected'"
        @refresh="loadReintegrationRecords"
        @accept="handleAcceptReintegration"
        @reject="handleRejectReintegration"
        @plan="handlePlanReintegration"
        @toggle-expanded="toggleReintegrationExpanded"
        @update:reasonDraft="(id, value) => reintegrationReasonDrafts[id] = value"
      />

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
        @answer-followup="handleAnswerFollowup"
      />
    </div>

    <!-- Tab 2: 投射分析 -->
    <div v-if="activeTab === 'projection'">
      <PromotionProjectionPanel
        :event-nodes="eventNodes"
        :continuity-records="continuityRecords"
        :loading="projectionLoading"
        :message="projectionMessage"
        :message-type="projectionMessageType"
        :format-time="formatTime"
        @refresh="loadPromotionProjections"
      />
    </div>

    <!-- Tab 3: 智能洞察 -->
    <div v-if="activeTab === 'insights'">
      <BrainstormSessionPanel
        :sessions="brainstormSessions"
        :loading="brainstormLoading"
        :format-time="formatTime"
        @refresh="loadBrainstormSessions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { defineAsyncComponent } from 'vue';

type GovTab = 'governance' | 'projection' | 'insights';
const activeTab = ref<GovTab>('governance');

function switchTab(tab: GovTab) {
  activeTab.value = tab;
  if (tab === 'projection' && !eventNodes.value.length && !projectionLoading.value) loadPromotionProjections();
  if (tab === 'insights' && !brainstormSessions.value.length && !brainstormLoading.value) loadBrainstormSessions();
}
const ReintegrationReviewPanel = defineAsyncComponent(() => import('../components/ReintegrationReviewPanel.vue'));
const SoulActionGovernancePanel = defineAsyncComponent(() => import('../components/SoulActionGovernancePanel.vue'));
const PromotionProjectionPanel = defineAsyncComponent(() => import('../components/PromotionProjectionPanel.vue'));
const BrainstormSessionPanel = defineAsyncComponent(() => import('../components/BrainstormSessionPanel.vue'));
import { fetchReintegrationRecords, acceptReintegrationRecord, rejectReintegrationRecord, planReintegrationPromotions, fetchSoulActions, approveSoulAction, deferSoulAction, discardSoulAction, dispatchSoulAction, answerFollowupQuestion, fetchEventNodeProjectionList, fetchContinuityProjectionList, fetchBrainstormSessions, fetchPendingPhysicalActions, approvePhysicalAction, rejectPhysicalAction } from '../api/client';
import type { ReintegrationRecord, SoulAction, EventNode, ContinuityRecord, WsEvent, BrainstormSession, PhysicalAction } from '@lifeos/shared';
import PhysicalActionCard from '../components/PhysicalActionCard.vue';
import { formatSoulActionKindLabel, formatSoulActionSourceLabel, getDispatchExecutionMessage, getReintegrationReviewMessage, getSoulActionGovernanceMessage } from '@lifeos/shared';
import { workerTaskStatusLabel, workerTaskTypeLabel, workerTaskWorkerLabel } from '../utils/workerTaskLabels';
import { useWebSocket } from '../composables/useWebSocket';
import { buildSoulActionGroups, getSoulActionGroupCount, getSoulActionGroupQuickFilterLabel, getSoulActionGroupQuickFilterStats, type SoulActionGroupQuickFilter } from '../utils/soulActionGroups';

useWebSocket(); // to initialize listener but no local state needed here

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

// ── PhysicalAction State ──────────────────────────────────
const physicalActions = ref<PhysicalAction[]>([]);
const paActingId = ref<string | null>(null);

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

function buildDispatchedWorkerTaskSuffix(result: Awaited<ReturnType<typeof dispatchSoulAction>> | null): string {
  if (!result) return '';
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
    const lastResult = dispatchResults[dispatchResults.length - 1] ?? null;
    const suffix = lastResult ? buildDispatchedWorkerTaskSuffix(lastResult) : '';
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

async function handleAnswerFollowup(action: SoulAction, answer: string) {
  if (!answer.trim()) {
    soulActionMessage.value = '请输入回答内容';
    soulActionMessageType.value = 'error';
    return;
  }
  soulActionActionId.value = action.id;
  soulActionMessage.value = '';
  try {
    await answerFollowupQuestion(action.id, answer.trim());
    soulActionMessage.value = '回答已提交，已追加到源笔记';
    soulActionMessageType.value = 'success';
    await loadSoulActions({ preserveMessage: true });
  } catch (e: any) {
    soulActionMessage.value = e.message || '回答提交失败';
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

async function loadPhysicalActions() {
  try {
    physicalActions.value = await fetchPendingPhysicalActions();
  } catch { /* silently fail if endpoint not ready */ }
}

async function handleApprovePA(id: string, autoApproveNext: boolean) {
  paActingId.value = id;
  try {
    await approvePhysicalAction(id, autoApproveNext);
    physicalActions.value = physicalActions.value.filter(a => a.id !== id);
  } catch { /* noop */ }
  paActingId.value = null;
}

async function handleRejectPA(id: string) {
  paActingId.value = id;
  try {
    await rejectPhysicalAction(id);
    physicalActions.value = physicalActions.value.filter(a => a.id !== id);
  } catch { /* noop */ }
  paActingId.value = null;
}

onMounted(async () => {
  loadPhysicalActions();
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

.gov-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  padding: 4px;
  background: color-mix(in srgb, var(--surface) 50%, transparent);
  border-radius: 14px;
  border: 1px solid var(--border);
}

.gov-tab {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.gov-tab:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--surface-strong) 50%, transparent);
}

.gov-tab.active {
  color: var(--accent-strong);
  background: var(--surface-strong);
  box-shadow: 0 2px 8px -2px var(--shadow);
}

.pa-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
}

.pa-list {
  display: grid;
  gap: 10px;
}

@media (max-width: 640px) {
  .governance-view {
    padding: 0 16px;
  }
  .gov-tab {
    font-size: 0.8rem;
    padding: 8px 6px;
  }
}
</style>
