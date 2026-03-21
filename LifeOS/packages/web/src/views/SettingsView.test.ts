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
});
