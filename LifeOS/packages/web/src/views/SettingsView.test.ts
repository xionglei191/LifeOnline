import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchIndexStatus: vi.fn(),
  fetchIndexErrors: vi.fn(),
  fetchWorkerTasks: vi.fn(),
  fetchTaskSchedules: vi.fn(),
  fetchReintegrationRecords: vi.fn(),
  fetchSoulActions: vi.fn(),
  fetchAiPrompts: vi.fn(),
  fetchAiProviderSettings: vi.fn(),
  approveSoulAction: vi.fn(),
  dispatchSoulAction: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchConfig: apiMocks.fetchConfig,
  updateConfig: vi.fn(),
  triggerIndex: vi.fn(),
  fetchIndexStatus: apiMocks.fetchIndexStatus,
  fetchIndexErrors: apiMocks.fetchIndexErrors,
  classifyInbox: vi.fn(),
  createWorkerTask: vi.fn(),
  fetchWorkerTasks: apiMocks.fetchWorkerTasks,
  retryWorkerTask: vi.fn(),
  cancelWorkerTask: vi.fn(),
  clearFinishedWorkerTasks: vi.fn(),
  createTaskSchedule: vi.fn(),
  fetchTaskSchedules: apiMocks.fetchTaskSchedules,
  updateTaskSchedule: vi.fn(),
  deleteTaskSchedule: vi.fn(),
  runTaskScheduleNow: vi.fn(),
  fetchAiPrompts: apiMocks.fetchAiPrompts,
  updateAiPrompt: vi.fn(),
  resetAiPrompt: vi.fn(),
  fetchAiProviderSettings: apiMocks.fetchAiProviderSettings,
  updateAiProviderSettings: vi.fn(),
  testAiProviderConnection: vi.fn(),
  fetchReintegrationRecords: apiMocks.fetchReintegrationRecords,
  acceptReintegrationRecord: vi.fn(),
  rejectReintegrationRecord: vi.fn(),
  planReintegrationPromotions: vi.fn(),
  fetchSoulActions: apiMocks.fetchSoulActions,
  approveSoulAction: apiMocks.approveSoulAction,
  dispatchSoulAction: apiMocks.dispatchSoulAction,
}));

vi.mock('../composables/useWebSocket', () => ({
  useWebSocket: () => ({ isConnected: { value: true } }),
  isIndexRefreshEvent: () => false,
}));

vi.mock('../composables/usePrivacy', () => ({
  usePrivacy: () => ({
    privacyMode: { value: 'masked' },
    pinEnabled: { value: false },
    togglePrivacyMode: vi.fn(),
    setupPin: vi.fn(),
    clearPin: vi.fn(),
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import SettingsView from './SettingsView.vue';
import SoulActionGovernancePanel from '../components/SoulActionGovernancePanel.vue';

function createSoulAction(overrides: Partial<SoulAction> & Pick<SoulAction, 'id' | 'sourceNoteId' | 'createdAt'>): SoulAction {
  return {
    id: overrides.id,
    actionKind: overrides.actionKind ?? 'promote_event_node',
    governanceStatus: overrides.governanceStatus ?? 'pending_review',
    executionStatus: overrides.executionStatus ?? 'not_dispatched',
    sourceNoteId: overrides.sourceNoteId,
    workerTaskId: overrides.workerTaskId ?? null,
    governanceReason: overrides.governanceReason ?? null,
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    approvedAt: overrides.approvedAt ?? null,
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
];

const soulActions: SoulAction[] = [
  createSoulAction({ id: 'ready-1', sourceNoteId: 'record-ready', createdAt: '2026-03-21T10:01:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
  createSoulAction({ id: 'ready-2', sourceNoteId: 'record-ready', createdAt: '2026-03-21T10:02:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched', actionKind: 'promote_continuity_record' }),
  createSoulAction({ id: 'mixed-1', sourceNoteId: 'record-mixed', createdAt: '2026-03-20T10:01:00.000Z', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' }),
];

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountSettingsView(): VueWrapper {
  return mount(SettingsView, {
    global: {
      stubs: {
        NoteDetail: true,
        WorkerTaskDetail: true,
        WorkerTaskCard: true,
        PrivacyMask: true,
      },
    },
  });
}

describe('SettingsView soul action governance wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    apiMocks.fetchConfig.mockResolvedValue({ vaultPath: '/vault' });
    apiMocks.fetchIndexStatus.mockResolvedValue({
      isIndexing: false,
      queued: 0,
      lastIndexedAt: null,
      currentFile: null,
    });
    apiMocks.fetchIndexErrors.mockResolvedValue([]);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.fetchTaskSchedules.mockResolvedValue([]);
    apiMocks.fetchReintegrationRecords.mockResolvedValue(reintegrationRecords);
    apiMocks.fetchSoulActions.mockResolvedValue(soulActions);
    apiMocks.fetchAiPrompts.mockResolvedValue([]);
    apiMocks.fetchAiProviderSettings.mockResolvedValue({
      baseUrl: 'http://localhost:3000',
      model: 'test-model',
      enabled: true,
      hasApiKey: true,
      apiKeySource: 'database',
    });
    apiMocks.approveSoulAction.mockResolvedValue({});
    apiMocks.dispatchSoulAction.mockResolvedValue({
      result: {
        dispatched: true,
        reason: 'dispatched',
        workerTaskId: 'worker-task-ready-1',
      },
      task: {
        id: 'worker-task-ready-1',
        taskType: 'update_persona_snapshot',
        worker: 'lifeos',
        status: 'pending',
        input: { noteId: 'record-ready' },
        result: null,
        error: null,
        sourceNoteId: 'record-ready',
        createdAt: '2026-03-21T10:03:00.000Z',
        updatedAt: '2026-03-21T10:03:00.000Z',
        startedAt: null,
        finishedAt: null,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes grouped governance props into the panel after initial load', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    expect(panel.exists()).toBe(true);
    expect(panel.props('filterStatus')).toBe('pending_review');
    expect(panel.props('executionFilter')).toBe('not_dispatched');
    expect(panel.props('quickFilter')).toBe('all');
    expect(panel.props('quickFilterLabel')).toBe('全部分组');
    expect(panel.props('quickFilterStats')).toBe('2 / 2 分组命中');
    expect(panel.props('groupCount')).toBe(2);
    expect(panel.props('groups')).toHaveLength(2);
    expect(panel.props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    wrapper.unmount();
  });

  it('keeps collapsed group ids in sync when the panel toggles grouped governance sections', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    expect(panel.props('collapsedGroupIds')).toEqual([]);

    panel.vm.$emit('toggle-collapsed', 'record-ready');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);

    panel.vm.$emit('toggle-collapsed', 'record-mixed');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready', 'record-mixed']);

    panel.vm.$emit('toggle-collapsed', 'record-ready');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-mixed']);

    wrapper.unmount();
  });

  it('keeps collapsed group ids stable across worker-task websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('toggle-collapsed', 'record-ready');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);

    wrapper.unmount();
  });

  it('keeps collapsed group ids stable across soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('toggle-collapsed', 'record-ready');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'soul-action-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);

    wrapper.unmount();
  });

  it('keeps grouped governance state stable across index refresh websocket events', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchIndexStatus.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('toggle-collapsed', 'record-ready');
    await flushPromises();
    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();
    panel.vm.$emit('update:filterStatus', 'approved');
    await flushPromises();
    panel.vm.$emit('update:executionFilter', 'not_dispatched');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupCount')).toBe(2);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('filterStatus')).toBe('approved');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('executionFilter')).toBe('not_dispatched');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'index-queue-complete' },
    }));
    await flushPromises();

    expect(apiMocks.fetchIndexStatus).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).not.toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('collapsedGroupIds')).toEqual(['record-ready']);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupCount')).toBe(2);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('filterStatus')).toBe('approved');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('executionFilter')).toBe('not_dispatched');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    wrapper.unmount();
  });

  it('keeps grouped governance summary and filtered groups coherent across soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupCount')).toBe(2);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'soul-action-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupCount')).toBe(2);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    wrapper.unmount();
  });

  it('keeps grouped governance summary and filtered groups coherent across worker-task websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupCount')).toBe(2);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupCount')).toBe(2);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('summary')).toEqual({
      pendingReview: 1,
      approved: 2,
      dispatched: 0,
    });

    wrapper.unmount();
  });

  it('wires panel refresh and filter updates back to parent loaders', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);

    panel.vm.$emit('update:filterStatus', 'approved');
    await flushPromises();
    expect(panel.props('filterStatus')).toBe('approved');

    panel.vm.$emit('update:executionFilter', 'succeeded');
    await flushPromises();
    expect(panel.props('executionFilter')).toBe('succeeded');

    panel.vm.$emit('refresh');
    await flushPromises();

    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchSoulActions).toHaveBeenLastCalledWith({
      governanceStatus: 'approved',
      executionStatus: 'succeeded',
    });

    wrapper.unmount();
  });

  it('keeps quick filter props and grouped stats in sync when the panel updates quick-filter', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);

    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterLabel')).toBe('仅可派发分组');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);

    panel.vm.$emit('update:quickFilter', 'pending_only');
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('pending_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterLabel')).toBe('仅待治理分组');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterStats')).toBe('1 / 2 分组命中');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);

    wrapper.unmount();
  });

  it('keeps quick filter and governance filters aligned after round-trip updates and refresh', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchSoulActions.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);

    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);

    panel.vm.$emit('update:filterStatus', 'approved');
    await flushPromises();
    panel.vm.$emit('update:executionFilter', 'not_dispatched');
    await flushPromises();
    panel.vm.$emit('refresh');
    await flushPromises();

    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchSoulActions).toHaveBeenLastCalledWith({
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
    });
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilterLabel')).toBe('仅可派发分组');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('filterStatus')).toBe('approved');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('executionFilter')).toBe('not_dispatched');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);

    wrapper.unmount();
  });

  it('routes approve-group emits through the parent batch approve handler', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const pendingGroup = groups.find((group) => group.sourceNoteId === 'record-mixed');
    expect(pendingGroup).toBeTruthy();

    panel.vm.$emit('approve-group', pendingGroup);
    await flushPromises();

    expect(apiMocks.approveSoulAction).toHaveBeenCalledTimes(1);
    expect(apiMocks.approveSoulAction).toHaveBeenCalledWith('mixed-1', {
      reason: 'Batch approved from settings reintegration governance panel for record-mixed',
    });
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('routes dispatch-group emits through the parent batch dispatch handler and refreshes related views', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const readyGroup = groups.find((group) => group.sourceNoteId === 'record-ready');
    expect(readyGroup).toBeTruthy();

    panel.vm.$emit('dispatch-group', readyGroup);
    await flushPromises();

    expect(apiMocks.dispatchSoulAction).toHaveBeenCalledTimes(2);
    expect(apiMocks.dispatchSoulAction.mock.calls.map(([id]) => id)).toEqual(['ready-1', 'ready-2']);
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('keeps grouped governance filters stable across worker-task websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchIndexStatus.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();
    panel.vm.$emit('update:filterStatus', 'approved');
    await flushPromises();
    panel.vm.$emit('update:executionFilter', 'not_dispatched');
    await flushPromises();

    apiMocks.fetchSoulActions.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchIndexStatus).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenLastCalledWith({
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
    });
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('filterStatus')).toBe('approved');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('executionFilter')).toBe('not_dispatched');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);

    wrapper.unmount();
  });

  it('keeps grouped governance filters stable across soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchIndexStatus.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    panel.vm.$emit('update:quickFilter', 'dispatch_ready_only');
    await flushPromises();
    panel.vm.$emit('update:filterStatus', 'approved');
    await flushPromises();
    panel.vm.$emit('update:executionFilter', 'not_dispatched');
    await flushPromises();

    apiMocks.fetchSoulActions.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'soul-action-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchIndexStatus).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenLastCalledWith({
      governanceStatus: 'approved',
      executionStatus: 'not_dispatched',
    });
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('quickFilter')).toBe('dispatch_ready_only');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('filterStatus')).toBe('approved');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('executionFilter')).toBe('not_dispatched');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groups')).toHaveLength(1);

    wrapper.unmount();
  });

  it('refreshes reintegration records and soul actions on soul-action websocket updates', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchIndexStatus.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'soul-action-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchIndexStatus).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('refreshes worker tasks alongside grouped governance data on worker-task websocket updates', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchIndexStatus.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();
    apiMocks.fetchTaskSchedules.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchIndexStatus).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchTaskSchedules).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows batch approve feedback and refreshes soul actions after approve-group emits', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const pendingGroup = groups.find((group) => group.sourceNoteId === 'record-mixed');
    expect(pendingGroup).toBeTruthy();

    panel.vm.$emit('approve-group', pendingGroup);
    await flushPromises();

    expect(apiMocks.approveSoulAction).toHaveBeenCalledWith('mixed-1', {
      reason: 'Batch approved from settings reintegration governance panel for record-mixed',
    });
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchReintegrationRecords).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量批准 1/1 条 soul actions');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupActionId')).toBe(null);

    wrapper.unmount();
  });

  it('shows error feedback without refreshing soul actions when approve-group fails', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockRejectedValueOnce(new Error('batch approve failed'));
    apiMocks.fetchSoulActions.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const pendingGroup = groups.find((group) => group.sourceNoteId === 'record-mixed');
    expect(pendingGroup).toBeTruthy();

    panel.vm.$emit('approve-group', pendingGroup);
    await flushPromises();

    expect(apiMocks.fetchSoulActions).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('batch approve failed');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('error');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupActionId')).toBe(null);

    wrapper.unmount();
  });

  it('shows batch dispatch feedback and refreshes related views after dispatch-group emits', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const readyGroup = groups.find((group) => group.sourceNoteId === 'record-ready');
    expect(readyGroup).toBeTruthy();

    panel.vm.$emit('dispatch-group', readyGroup);
    await flushPromises();

    expect(apiMocks.dispatchSoulAction.mock.calls.map(([id]) => id)).toEqual(['ready-1', 'ready-2']);
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量派发 2/2 条 soul actions');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupDispatchId')).toBe(null);

    wrapper.unmount();
  });

  it('shows error feedback without refreshing related views when dispatch-group fails', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockRejectedValueOnce(new Error('batch dispatch failed'));
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const readyGroup = groups.find((group) => group.sourceNoteId === 'record-ready');
    expect(readyGroup).toBeTruthy();

    panel.vm.$emit('dispatch-group', readyGroup);
    await flushPromises();

    expect(apiMocks.fetchSoulActions).not.toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('batch dispatch failed');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('error');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupDispatchId')).toBe(null);

    wrapper.unmount();
  });

  it('passes the active groupActionId into the panel while approve-group is still in flight', async () => {
    const deferred = createDeferred<Record<string, never>>();
    apiMocks.approveSoulAction.mockImplementationOnce(() => deferred.promise);

    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const pendingGroup = groups.find((group) => group.sourceNoteId === 'record-mixed');
    expect(pendingGroup).toBeTruthy();

    panel.vm.$emit('approve-group', pendingGroup);
    await Promise.resolve();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupActionId')).toBe('record-mixed');

    deferred.resolve({});
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupActionId')).toBe(null);

    wrapper.unmount();
  });

  it('passes the active groupDispatchId into the panel while dispatch-group is still in flight', async () => {
    const deferred = createDeferred<{ result: { dispatched: boolean; reason: string } }>();
    apiMocks.dispatchSoulAction.mockImplementationOnce(() => deferred.promise);

    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const readyGroup = groups.find((group) => group.sourceNoteId === 'record-ready');
    expect(readyGroup).toBeTruthy();

    panel.vm.$emit('dispatch-group', readyGroup);
    await Promise.resolve();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupDispatchId')).toBe('record-ready');

    deferred.resolve({
      result: {
        dispatched: true,
        reason: 'dispatched later',
      },
    });
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupDispatchId')).toBe(null);

    wrapper.unmount();
  });

  it('passes the active actionId into the panel while approve-action is still in flight', async () => {
    const deferred = createDeferred<Record<string, never>>();
    apiMocks.approveSoulAction.mockImplementationOnce(() => deferred.promise);

    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const pendingAction = soulActions.find((action) => action.id === 'mixed-1');
    expect(pendingAction).toBeTruthy();

    panel.vm.$emit('approve-action', pendingAction);
    await Promise.resolve();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('actionId')).toBe('mixed-1');

    deferred.resolve({});
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('actionId')).toBe(null);

    wrapper.unmount();
  });

  it('passes the active actionId into the panel while dispatch-action is still in flight', async () => {
    const deferred = createDeferred<{ result: { dispatched: boolean; reason: string } }>();
    apiMocks.dispatchSoulAction.mockImplementationOnce(() => deferred.promise);

    const wrapper = mountSettingsView();

    await flushPromises();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const readyAction = soulActions.find((action) => action.id === 'ready-1');
    expect(readyAction).toBeTruthy();

    panel.vm.$emit('dispatch-action', readyAction);
    await Promise.resolve();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('actionId')).toBe('ready-1');

    deferred.resolve({
      result: {
        dispatched: true,
        reason: 'dispatched later',
      },
    });
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('actionId')).toBe(null);

    wrapper.unmount();
  });

  it('shows success feedback and refreshes soul actions after approve-action emits', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const pendingAction = soulActions.find((action) => action.id === 'mixed-1');
    expect(pendingAction).toBeTruthy();

    panel.vm.$emit('approve-action', pendingAction);
    await flushPromises();

    expect(apiMocks.approveSoulAction).toHaveBeenCalledWith('mixed-1', {
      reason: 'Approved from settings reintegration governance panel for record-mixed',
    });
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchReintegrationRecords).not.toHaveBeenCalled();
    expect(panel.props('message')).toBe('Soul action 已批准');
    expect(panel.props('messageType')).toBe('success');
    expect(panel.props('actionId')).toBe(null);

    wrapper.unmount();
  });

  it('shows error feedback without refreshing soul actions when approve-action fails', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockRejectedValueOnce(new Error('approve failed'));
    apiMocks.fetchSoulActions.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const pendingAction = soulActions.find((action) => action.id === 'mixed-1');
    expect(pendingAction).toBeTruthy();

    panel.vm.$emit('approve-action', pendingAction);
    await flushPromises();

    expect(apiMocks.fetchSoulActions).not.toHaveBeenCalled();
    expect(panel.props('message')).toBe('approve failed');
    expect(panel.props('messageType')).toBe('error');
    expect(panel.props('actionId')).toBe(null);

    wrapper.unmount();
  });

  it('shows dispatch result feedback and refreshes related views after dispatch-action emits', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const readyAction = soulActions.find((action) => action.id === 'ready-1');
    expect(readyAction).toBeTruthy();

    panel.vm.$emit('dispatch-action', readyAction);
    await flushPromises();

    expect(apiMocks.dispatchSoulAction).toHaveBeenCalledWith('ready-1');
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledTimes(1);
    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新）');
    expect(panel.props('messageType')).toBe('success');
    expect(panel.props('actionId')).toBe(null);

    wrapper.unmount();
  });

  it('keeps dispatch worker task feedback visible across worker-task websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const readyAction = soulActions.find((action) => action.id === 'ready-1');
    expect(readyAction).toBeTruthy();

    panel.vm.$emit('dispatch-action', readyAction);
    await flushPromises();

    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新）');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新）');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');

    wrapper.unmount();
  });

  it('keeps dispatch worker task feedback visible across soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const readyAction = soulActions.find((action) => action.id === 'ready-1');
    expect(readyAction).toBeTruthy();

    panel.vm.$emit('dispatch-action', readyAction);
    await flushPromises();

    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新）');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'soul-action-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新）');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');

    wrapper.unmount();
  });

  it('shows error feedback without refreshing related views when dispatch-action fails', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockRejectedValueOnce(new Error('dispatch failed'));
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const readyAction = soulActions.find((action) => action.id === 'ready-1');
    expect(readyAction).toBeTruthy();

    panel.vm.$emit('dispatch-action', readyAction);
    await flushPromises();

    expect(apiMocks.fetchSoulActions).not.toHaveBeenCalled();
    expect(apiMocks.fetchReintegrationRecords).not.toHaveBeenCalled();
    expect(panel.props('message')).toBe('dispatch failed');
    expect(panel.props('messageType')).toBe('error');
    expect(panel.props('actionId')).toBe(null);

    wrapper.unmount();
  });
});
