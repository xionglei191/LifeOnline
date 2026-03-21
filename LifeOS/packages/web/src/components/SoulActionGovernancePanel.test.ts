import { describe, expect, it } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { mount } from '@vue/test-utils';
import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';
import SoulActionGovernancePanel from './SoulActionGovernancePanel.vue';
import { buildSoulActionGroups, getSoulActionGroupCount, getSoulActionGroupQuickFilterLabel, getSoulActionGroupQuickFilterStats, type SoulActionGroupQuickFilter } from '../utils/soulActionGroups';

function createSoulAction(overrides: Partial<SoulAction> & Pick<SoulAction, 'id' | 'sourceNoteId' | 'createdAt'>): SoulAction {
  return {
    id: overrides.id,
    actionKind: overrides.actionKind ?? 'promote_event_node',
    governanceStatus: overrides.governanceStatus ?? 'pending_review',
    executionStatus: overrides.executionStatus ?? 'not_dispatched',
    status: overrides.status ?? overrides.executionStatus ?? 'not_dispatched',
    sourceNoteId: overrides.sourceNoteId,
    sourceReintegrationId: overrides.sourceReintegrationId ?? null,
    workerTaskId: overrides.workerTaskId ?? null,
    governanceReason: overrides.governanceReason ?? null,
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    approvedAt: overrides.approvedAt ?? null,
    deferredAt: overrides.deferredAt ?? null,
    discardedAt: overrides.discardedAt ?? null,
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
}

function createReintegrationRecord(overrides: Partial<ReintegrationRecord> & Pick<ReintegrationRecord, 'id' | 'createdAt'>): ReintegrationRecord {
  return {
    id: overrides.id,
    workerTaskId: overrides.workerTaskId ?? 'task-1',
    sourceNoteId: overrides.sourceNoteId ?? 'note-1',
    signalKind: overrides.signalKind ?? 'daily_report_reintegration',
    taskType: overrides.taskType ?? 'daily_report',
    summary: overrides.summary ?? `${overrides.id} summary`,
    reviewStatus: overrides.reviewStatus ?? 'accepted',
    payload: overrides.payload ?? {},
    result: overrides.result ?? null,
    reviewReason: overrides.reviewReason ?? null,
    evidence: overrides.evidence ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    reviewedAt: overrides.reviewedAt ?? null,
    reviewedBy: overrides.reviewedBy ?? null,
  };
}

const reintegrationRecords: ReintegrationRecord[] = [
  createReintegrationRecord({ id: 'record-ready', createdAt: '2026-03-21T10:00:00.000Z', summary: 'ready group' }),
  createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z', summary: 'mixed group' }),
  createReintegrationRecord({ id: 'record-done', createdAt: '2026-03-19T10:00:00.000Z', summary: 'done group' }),
];

const soulActions: SoulAction[] = [
  createSoulAction({ id: 'ready-1', sourceNoteId: 'note-ready-1', sourceReintegrationId: 'record-ready', createdAt: '2026-03-21T10:01:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
  createSoulAction({ id: 'ready-2', sourceNoteId: 'note-ready-2', sourceReintegrationId: 'record-ready', createdAt: '2026-03-21T10:02:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched', actionKind: 'promote_continuity_record' }),
  createSoulAction({ id: 'mixed-1', sourceNoteId: 'note-mixed-1', sourceReintegrationId: 'record-mixed', createdAt: '2026-03-20T10:01:00.000Z', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' }),
  createSoulAction({ id: 'mixed-2', sourceNoteId: 'note-mixed-2', sourceReintegrationId: 'record-mixed', createdAt: '2026-03-20T10:02:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched', actionKind: 'promote_continuity_record' }),
  createSoulAction({ id: 'done-1', sourceNoteId: 'note-done-1', sourceReintegrationId: 'record-done', createdAt: '2026-03-19T10:01:00.000Z', governanceStatus: 'approved', executionStatus: 'succeeded' }),
];

const readyGroup = buildSoulActionGroups(soulActions, reintegrationRecords, 'dispatch_ready_only')[0]!;
const mixedGroup = buildSoulActionGroups(soulActions, reintegrationRecords, 'pending_only')[0]!;

function mountPanel(quickFilter: SoulActionGroupQuickFilter, overrides?: Partial<InstanceType<typeof SoulActionGovernancePanel>['$props']>): VueWrapper {
  return mount(SoulActionGovernancePanel, {
    props: {
      filterStatus: 'pending_review',
      executionFilter: 'not_dispatched',
      quickFilter,
      quickFilterLabel: getSoulActionGroupQuickFilterLabel(quickFilter),
      quickFilterStats: getSoulActionGroupQuickFilterStats(soulActions, reintegrationRecords, quickFilter),
      groupCount: getSoulActionGroupCount(soulActions),
      groups: buildSoulActionGroups(soulActions, reintegrationRecords, quickFilter),
      summary: {
        pendingReview: soulActions.filter((action) => action.governanceStatus === 'pending_review').length,
        approved: soulActions.filter((action) => action.governanceStatus === 'approved').length,
        dispatched: soulActions.filter((action) => action.executionStatus === 'succeeded').length,
      },
      loading: false,
      message: '',
      messageType: 'success',
      actionId: null,
      groupActionId: null,
      groupDispatchId: null,
      collapsedGroupIds: [],
      taskTypeLabel: () => 'Daily Report',
      reintegrationStatusText: () => '已接受',
      promotionActionLabel: (actionKind: SoulAction['actionKind']) => actionKind,
      soulActionStatusClass: () => 'default',
      soulActionStatusText: (action: SoulAction) => action.governanceStatus,
      formatTime: () => '2026/03/21',
      ...overrides,
    },
  });
}

describe('SoulActionGovernancePanel', () => {
  it('renders all groups and summary text in all mode', () => {
    const wrapper = mountPanel('all');

    expect(wrapper.text()).toContain('当前分组视图：全部分组');
    expect(wrapper.text()).toContain('3 / 3 分组命中');
    expect(wrapper.text()).toContain('当前分组');
    expect(wrapper.text()).toContain('3 / 3');
    expect(wrapper.findAll('.soul-action-group')).toHaveLength(3);
  });

  it('renders reintegration source labels and source note metadata for grouped promotion actions', () => {
    const wrapper = mountPanel('dispatch_ready_only');

    expect(wrapper.text()).toContain('Reintegration record-ready');
    expect(wrapper.text()).toContain('Source note: note-1');
    expect(wrapper.text()).not.toContain('note-ready-1');
    expect(wrapper.text()).not.toContain('note-ready-2');
  });

  it('renders only pending groups with synced label and stats in pending_only mode', () => {
    const wrapper = mountPanel('pending_only');

    expect(wrapper.text()).toContain('当前分组视图：仅待治理分组');
    expect(wrapper.text()).toContain('1 / 3 分组命中');
    expect(wrapper.findAll('.soul-action-group')).toHaveLength(1);
    expect(wrapper.text()).toContain('record-mixed');
    expect(wrapper.text()).not.toContain('record-ready');
  });

  it('renders only fully dispatch-ready groups in dispatch_ready_only mode', () => {
    const wrapper = mountPanel('dispatch_ready_only');

    expect(wrapper.text()).toContain('当前分组视图：仅可派发分组');
    expect(wrapper.text()).toContain('1 / 3 分组命中');
    expect(wrapper.findAll('.soul-action-group')).toHaveLength(1);
    expect(wrapper.text()).toContain('record-ready');
    expect(wrapper.text()).not.toContain('record-mixed');
    expect(wrapper.text()).toContain('派发本组已批准项 (2)');
  });

  it('emits filter-status and execution-filter updates when those filters change', async () => {
    const wrapper = mountPanel('all');

    const selects = wrapper.findAll('select');
    await selects[0]!.setValue('approved');
    await selects[1]!.setValue('succeeded');

    expect(wrapper.emitted('update:filterStatus')).toEqual([['approved']]);
    expect(wrapper.emitted('update:executionFilter')).toEqual([['succeeded']]);
  });

  it('emits refresh when the refresh button is clicked', async () => {
    const wrapper = mountPanel('all');

    await wrapper.find('.soul-action-filters .btn-link').trigger('click');

    expect(wrapper.emitted('refresh')).toEqual([[]]);
  });

  it('emits toggle-collapsed with the selected group id', async () => {
    const wrapper = mountPanel('dispatch_ready_only');

    const toggleButton = wrapper.findAll('.soul-action-group-toolbar .btn-link')[0]!;
    await toggleButton.trigger('click');

    expect(wrapper.emitted('toggle-collapsed')).toEqual([['record-ready']]);
  });

  it('disables group dispatch unless the whole group is dispatch-ready', () => {
    const mixedWrapper = mountPanel('pending_only');
    const mixedButton = mixedWrapper.find('.soul-action-group-toolbar .btn-cancel');
    expect(mixedButton.attributes('disabled')).toBeDefined();

    const readyWrapper = mountPanel('dispatch_ready_only');
    const readyButton = readyWrapper.find('.soul-action-group-toolbar .btn-cancel');
    expect(readyButton.attributes('disabled')).toBeUndefined();
  });

  it('emits the selected group payload for approve-group actions', async () => {
    const wrapper = mountPanel('pending_only');

    const approveButton = wrapper.find('.soul-action-group-toolbar .btn-worker');
    await approveButton.trigger('click');

    expect(wrapper.emitted('approve-group')).toEqual([[mixedGroup]]);
  });

  it('emits the selected group payload for dispatch-group actions', async () => {
    const wrapper = mountPanel('dispatch_ready_only');

    const dispatchButton = wrapper.find('.soul-action-group-toolbar .btn-cancel');
    await dispatchButton.trigger('click');

    expect(wrapper.emitted('dispatch-group')).toEqual([[readyGroup]]);
  });

  it('emits the selected action payload for approve, defer, discard, and dispatch controls', async () => {
    const wrapper = mountPanel('pending_only');

    const actionRows = wrapper.findAll('.soul-action-item');
    await actionRows[0]!.find('.btn-worker').trigger('click');
    await actionRows[0]!.find('.btn-secondary').trigger('click');
    await actionRows[0]!.find('.btn-danger-sm').trigger('click');
    await actionRows[1]!.find('.btn-cancel').trigger('click');

    expect(wrapper.emitted('approve-action')).toEqual([[mixedGroup.actions[0]]]);
    expect(wrapper.emitted('defer-action')).toEqual([[mixedGroup.actions[0]]]);
    expect(wrapper.emitted('discard-action')).toEqual([[mixedGroup.actions[0]]]);
    expect(wrapper.emitted('dispatch-action')).toEqual([[mixedGroup.actions[1]]]);
  });

  it('hides action rows when the group is passed as collapsed', () => {
    const wrapper = mountPanel('dispatch_ready_only', {
      collapsedGroupIds: ['record-ready'],
    });

    expect(wrapper.findAll('.soul-action-item')).toHaveLength(0);
    expect(wrapper.text()).toContain('展开分组');
  });

  it('keeps action rows visible when the group is not collapsed', () => {
    const wrapper = mountPanel('dispatch_ready_only');

    expect(wrapper.findAll('.soul-action-item')).toHaveLength(2);
    expect(wrapper.text()).toContain('收起分组');
  });

  it('renders a loading state before groups are shown', () => {
    const wrapper = mountPanel('all', {
      loading: true,
    });

    expect(wrapper.text()).toContain('加载中...');
    expect(wrapper.findAll('.soul-action-group')).toHaveLength(0);
  });

  it('renders the empty state hint when no groups match the current view', () => {
    const wrapper = mountPanel('all', {
      groups: [],
    });

    expect(wrapper.text()).toContain('当前筛选下没有 soul actions');
    expect(wrapper.text()).toContain('可尝试切换为“全部分组”或检查是否还有已批准但未派发的分组。');
  });

  it('disables single-action controls and shows loading text while the matching action is processing', () => {
    const wrapper = mountPanel('dispatch_ready_only', {
      actionId: 'ready-1',
    });

    const actionRows = wrapper.findAll('.soul-action-item');
    const processingRow = actionRows[0]!;
    expect(processingRow.find('.btn-worker').attributes('disabled')).toBeDefined();
    expect(processingRow.find('.btn-cancel').attributes('disabled')).toBeDefined();
    expect(processingRow.text()).toContain('处理中...');
  });

  it('keeps approve disabled for already approved actions and dispatch disabled for pending actions', () => {
    const wrapper = mountPanel('pending_only');

    const actionRows = wrapper.findAll('.soul-action-item');
    const pendingRow = actionRows[0]!;
    const approvedRow = actionRows[1]!;

    expect(pendingRow.find('.btn-worker').attributes('disabled')).toBeUndefined();
    expect(pendingRow.find('.btn-cancel').attributes('disabled')).toBeDefined();
    expect(approvedRow.find('.btn-worker').attributes('disabled')).toBeDefined();
    expect(approvedRow.find('.btn-cancel').attributes('disabled')).toBeUndefined();
  });

  it('disables dispatch for actions that are already finished', () => {
    const wrapper = mountPanel('all');

    const actionRows = wrapper.findAll('.soul-action-item');
    const doneRow = actionRows[actionRows.length - 1]!;
    expect(doneRow.find('.btn-cancel').attributes('disabled')).toBeDefined();
  });

  it('disables group dispatch while the matching group is processing', () => {
    const wrapper = mountPanel('dispatch_ready_only', {
      groupDispatchId: 'record-ready',
    });

    const readyButton = wrapper.find('.soul-action-group-toolbar .btn-cancel');
    expect(readyButton.attributes('disabled')).toBeDefined();
    expect(readyButton.text()).toContain('处理中...');
  });
});
