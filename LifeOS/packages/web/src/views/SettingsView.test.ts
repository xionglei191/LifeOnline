import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import type { PromptRecord, ReintegrationRecord, SoulAction, EventNode, ContinuityRecord } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchIndexStatus: vi.fn(),
  fetchIndexErrors: vi.fn(),
  fetchWorkerTasks: vi.fn(),
  fetchTaskSchedules: vi.fn(),
  fetchReintegrationRecords: vi.fn(),
  fetchSoulActions: vi.fn(),
  fetchEventNodes: vi.fn(),
  fetchContinuityRecords: vi.fn(),
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
  fetchEventNodes: apiMocks.fetchEventNodes,
  fetchContinuityRecords: apiMocks.fetchContinuityRecords,
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
import * as client from '../api/client';

function createSoulAction(overrides: Partial<SoulAction> & Pick<SoulAction, 'id' | 'sourceNoteId' | 'createdAt'>): SoulAction {
  return {
    id: overrides.id,
    actionKind: overrides.actionKind ?? 'promote_event_node',
    governanceStatus: overrides.governanceStatus ?? 'pending_review',
    executionStatus: overrides.executionStatus ?? 'not_dispatched',
    sourceNoteId: overrides.sourceNoteId,
    sourceReintegrationId: overrides.sourceReintegrationId ?? null,
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
  createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z', summary: 'mixed group', reviewStatus: 'pending_review' }),
];

const soulActions: SoulAction[] = [
  createSoulAction({ id: 'ready-1', sourceNoteId: 'note-ready-1', sourceReintegrationId: 'record-ready', createdAt: '2026-03-21T10:01:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
  createSoulAction({ id: 'ready-2', sourceNoteId: 'note-ready-2', sourceReintegrationId: 'record-ready', createdAt: '2026-03-21T10:02:00.000Z', governanceStatus: 'approved', executionStatus: 'not_dispatched', actionKind: 'promote_continuity_record' }),
  createSoulAction({ id: 'mixed-1', sourceNoteId: 'note-mixed-1', sourceReintegrationId: 'record-mixed', createdAt: '2026-03-20T10:01:00.000Z', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' }),
];

const eventNodes: EventNode[] = [
  {
    id: 'event:record-ready',
    sourceReintegrationId: 'record-ready',
    sourceNoteId: null,
    sourceSoulActionId: null,
    promotionSoulActionId: 'ready-1',
    eventKind: 'weekly_reflection',
    title: 'Ready event node',
    summary: 'ready group',
    threshold: 'high',
    status: 'active',
    evidence: { source: 'settings-test' },
    explanation: { reason: 'projection' },
    occurredAt: '2026-03-21T10:03:00.000Z',
    createdAt: '2026-03-21T10:03:00.000Z',
    updatedAt: '2026-03-21T10:03:00.000Z',
  },
];

const continuityRecords: ContinuityRecord[] = [
  {
    id: 'continuity:record-ready',
    sourceReintegrationId: 'record-ready',
    sourceNoteId: null,
    sourceSoulActionId: null,
    promotionSoulActionId: 'ready-2',
    continuityKind: 'daily_rhythm',
    target: 'derived_outputs',
    strength: 'medium',
    summary: 'ready continuity',
    continuity: { trend: 'stable' },
    evidence: { source: 'settings-test' },
    explanation: { reason: 'projection' },
    recordedAt: '2026-03-21T10:04:00.000Z',
    createdAt: '2026-03-21T10:04:00.000Z',
    updatedAt: '2026-03-21T10:04:00.000Z',
  },
];

function createPromptRecord(overrides: Partial<PromptRecord> & Pick<PromptRecord, 'key' | 'label' | 'description' | 'requiredPlaceholders' | 'defaultContent' | 'effectiveContent' | 'enabled' | 'isOverridden'>): PromptRecord {
  return {
    key: overrides.key,
    label: overrides.label,
    description: overrides.description,
    requiredPlaceholders: overrides.requiredPlaceholders,
    defaultContent: overrides.defaultContent,
    overrideContent: overrides.overrideContent ?? null,
    effectiveContent: overrides.effectiveContent,
    enabled: overrides.enabled,
    updatedAt: overrides.updatedAt ?? null,
    notes: overrides.notes ?? null,
    isOverridden: overrides.isOverridden,
  };
}

const promptRecords: PromptRecord[] = [
  createPromptRecord({
    key: 'classify',
    label: '笔记分类',
    description: '用于识别笔记维度、类型、优先级与标题。',
    requiredPlaceholders: ['{content}'],
    defaultContent: 'classify default {content}',
    effectiveContent: 'classify default {content}',
    enabled: true,
    isOverridden: false,
  }),
  createPromptRecord({
    key: 'suggest',
    label: '洞察建议',
    description: '用于基于近期数据生成 2-3 条可执行洞察建议。',
    requiredPlaceholders: ['{dashboardData}', '{recentNotes}'],
    defaultContent: 'suggest default {dashboardData} {recentNotes}',
    effectiveContent: 'suggest default {dashboardData} {recentNotes}',
    enabled: true,
    isOverridden: false,
  }),
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

function workerTaskCardStub() {
  return {
    props: ['task'],
    emits: ['open-detail', 'open-output', 'cancel', 'retry'],
    template: `
      <div>
        <button type="button" class="stub-retry" @click="$emit('retry', task.id)">重试任务</button>
        <button type="button" class="stub-cancel" @click="$emit('cancel', task.id)">取消任务</button>
      </div>
    `,
  };
}

function mountSettingsView(): VueWrapper {
  return mount(SettingsView, {
    global: {
      stubs: {
        NoteDetail: true,
        WorkerTaskDetail: true,
        WorkerTaskCard: workerTaskCardStub(),
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
    apiMocks.fetchEventNodes.mockResolvedValue(eventNodes);
    apiMocks.fetchContinuityRecords.mockResolvedValue(continuityRecords);
    apiMocks.fetchAiPrompts.mockResolvedValue(promptRecords);
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

    const clientMocks = vi.mocked(client);
    clientMocks.acceptReintegrationRecord.mockResolvedValue({
      record: createReintegrationRecord({
        id: 'record-mixed',
        createdAt: '2026-03-20T10:00:00.000Z',
        summary: 'mixed group',
        reviewStatus: 'accepted',
        reviewedAt: '2026-03-21T10:06:00.000Z',
      }),
      soulActions: [
        createSoulAction({
          id: 'planned-mixed-1',
          sourceNoteId: 'record-mixed',
          createdAt: '2026-03-21T10:06:00.000Z',
          governanceStatus: 'pending_review',
          executionStatus: 'not_dispatched',
        }),
      ],
    });
    clientMocks.planReintegrationPromotions.mockResolvedValue([
      createSoulAction({
        id: 'planned-ready-1',
        sourceNoteId: 'record-ready',
        createdAt: '2026-03-21T10:07:00.000Z',
        governanceStatus: 'pending_review',
        executionStatus: 'not_dispatched',
      }),
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the suggest prompt in the prompt center with its required placeholders', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();

    expect(wrapper.text()).toContain('洞察建议');
    expect(wrapper.text()).toContain('suggest');

    const promptButtons = wrapper.findAll('.prompt-list-item');
    expect(promptButtons).toHaveLength(2);
    await promptButtons[1]!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('用于基于近期数据生成 2-3 条可执行洞察建议。');
    const placeholderList = wrapper.find('.placeholder-list');
    expect(placeholderList.text()).toContain('{dashboardData}');
    expect(placeholderList.text()).toContain('{recentNotes}');
    const textarea = wrapper.find('.prompt-editor .prompt-textarea');
    expect((textarea.element as HTMLTextAreaElement).value).toContain('suggest default {dashboardData} {recentNotes}');
  });

  it('disables saving the suggest prompt when a required placeholder is missing', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    const promptButtons = wrapper.findAll('.prompt-list-item');
    await promptButtons[1]!.trigger('click');
    await flushPromises();

    const textarea = wrapper.find('.prompt-editor .prompt-textarea');
    await textarea.setValue('suggest default {dashboardData}');
    await flushPromises();

    expect(wrapper.text()).toContain('缺少占位符：{recentNotes}');
    const promptActionButtons = wrapper.findAll('.prompt-actions button');
    const saveOverrideButton = promptActionButtons.find((button) => button.text().includes('保存 override'));
    const saveDisabledButton = promptActionButtons.find((button) => button.text().includes('保存并禁用 override'));
    expect(saveOverrideButton).toBeTruthy();
    expect(saveDisabledButton).toBeTruthy();
    expect((saveOverrideButton!.element as HTMLButtonElement).disabled).toBe(true);
    expect((saveDisabledButton!.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the suggest prompt selected and refreshes status after saving an override', async () => {
    const wrapper = mountSettingsView();
    const clientMocks = vi.mocked(client);
    const updatedPromptRecords: PromptRecord[] = [
      promptRecords[0]!,
      createPromptRecord({
        key: 'suggest',
        label: '洞察建议',
        description: '用于基于近期数据生成 2-3 条可执行洞察建议。',
        requiredPlaceholders: ['{dashboardData}', '{recentNotes}'],
        defaultContent: 'suggest default {dashboardData} {recentNotes}',
        overrideContent: 'suggest override {dashboardData} {recentNotes}',
        effectiveContent: 'suggest override {dashboardData} {recentNotes}',
        enabled: true,
        isOverridden: true,
        updatedAt: '2026-03-21T10:20:00.000Z',
        notes: 'saved from settings test',
      }),
    ];

    clientMocks.updateAiPrompt.mockResolvedValue(updatedPromptRecords[1]!);
    apiMocks.fetchAiPrompts
      .mockResolvedValueOnce(promptRecords)
      .mockResolvedValueOnce(updatedPromptRecords);

    await flushPromises();
    const promptButtons = wrapper.findAll('.prompt-list-item');
    await promptButtons[1]!.trigger('click');
    await flushPromises();

    const textarea = wrapper.find('.prompt-editor .prompt-textarea');
    await textarea.setValue('suggest override {dashboardData} {recentNotes}');
    await flushPromises();

    const saveButton = wrapper.findAll('.prompt-actions button').find((button) => button.text().includes('保存 override'));
    expect(saveButton).toBeTruthy();
    await saveButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.updateAiPrompt).toHaveBeenCalledWith('suggest', {
      content: 'suggest override {dashboardData} {recentNotes}',
      enabled: true,
    });
    expect(apiMocks.fetchAiPrompts).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.prompt-list-item.active .prompt-key').text()).toBe('suggest');
    expect(wrapper.text()).toContain('Prompt override 已保存并启用');
    expect(wrapper.find('.prompt-list-item.active .prompt-status').text()).toBe('已覆盖');
    expect((wrapper.find('.prompt-editor .prompt-textarea').element as HTMLTextAreaElement).value).toBe('suggest override {dashboardData} {recentNotes}');
  });

  it('refreshes the suggest prompt status and editor content after toggling the override state', async () => {
    const wrapper = mountSettingsView();
    const clientMocks = vi.mocked(client);
    const overriddenPromptRecords: PromptRecord[] = [
      promptRecords[0]!,
      createPromptRecord({
        key: 'suggest',
        label: '洞察建议',
        description: '用于基于近期数据生成 2-3 条可执行洞察建议。',
        requiredPlaceholders: ['{dashboardData}', '{recentNotes}'],
        defaultContent: 'suggest default {dashboardData} {recentNotes}',
        overrideContent: 'suggest override {dashboardData} {recentNotes}',
        effectiveContent: 'suggest override {dashboardData} {recentNotes}',
        enabled: true,
        isOverridden: true,
        updatedAt: '2026-03-21T10:21:00.000Z',
        notes: 'saved from settings test',
      }),
    ];
    const disabledPromptRecords: PromptRecord[] = [
      promptRecords[0]!,
      createPromptRecord({
        key: 'suggest',
        label: '洞察建议',
        description: '用于基于近期数据生成 2-3 条可执行洞察建议。',
        requiredPlaceholders: ['{dashboardData}', '{recentNotes}'],
        defaultContent: 'suggest default {dashboardData} {recentNotes}',
        overrideContent: 'suggest override {dashboardData} {recentNotes}',
        effectiveContent: 'suggest default {dashboardData} {recentNotes}',
        enabled: false,
        isOverridden: true,
        updatedAt: '2026-03-21T10:22:00.000Z',
        notes: 'saved from settings test',
      }),
    ];

    clientMocks.updateAiPrompt.mockResolvedValue(disabledPromptRecords[1]!);
    apiMocks.fetchAiPrompts
      .mockResolvedValueOnce(overriddenPromptRecords)
      .mockResolvedValueOnce(disabledPromptRecords);

    await flushPromises();
    const promptButtons = wrapper.findAll('.prompt-list-item');
    await promptButtons[1]!.trigger('click');
    await flushPromises();

    const toggleButton = wrapper.findAll('.prompt-actions button').find((button) => button.text().includes('已启用 override'));
    expect(toggleButton).toBeTruthy();
    await toggleButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.updateAiPrompt).toHaveBeenCalledWith('suggest', {
      content: 'suggest override {dashboardData} {recentNotes}',
      enabled: false,
      notes: 'saved from settings test',
    });
    expect(wrapper.text()).toContain('Override 已禁用，运行时将回退默认 Prompt');
    expect(wrapper.find('.prompt-list-item.active .prompt-status').text()).toBe('已禁用覆盖');
    expect((wrapper.find('.prompt-editor .prompt-textarea').element as HTMLTextAreaElement).value).toBe('suggest override {dashboardData} {recentNotes}');
  });

  it('keeps the suggest prompt selected and restores default content after reset', async () => {
    const wrapper = mountSettingsView();
    const clientMocks = vi.mocked(client);
    const overriddenPromptRecords: PromptRecord[] = [
      promptRecords[0]!,
      createPromptRecord({
        key: 'suggest',
        label: '洞察建议',
        description: '用于基于近期数据生成 2-3 条可执行洞察建议。',
        requiredPlaceholders: ['{dashboardData}', '{recentNotes}'],
        defaultContent: 'suggest default {dashboardData} {recentNotes}',
        overrideContent: 'suggest override {dashboardData} {recentNotes}',
        effectiveContent: 'suggest override {dashboardData} {recentNotes}',
        enabled: true,
        isOverridden: true,
        updatedAt: '2026-03-21T10:22:00.000Z',
        notes: 'reset from settings test',
      }),
    ];

    clientMocks.resetAiPrompt.mockResolvedValue(undefined);
    apiMocks.fetchAiPrompts
      .mockResolvedValueOnce(overriddenPromptRecords)
      .mockResolvedValueOnce(promptRecords);

    await flushPromises();
    const promptButtons = wrapper.findAll('.prompt-list-item');
    await promptButtons[1]!.trigger('click');
    await flushPromises();

    const resetButton = wrapper.findAll('.prompt-actions button').find((button) => button.text().includes('重置为默认'));
    expect(resetButton).toBeTruthy();
    await resetButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.resetAiPrompt).toHaveBeenCalledWith('suggest');
    expect(wrapper.text()).toContain('已恢复默认 Prompt');
    expect(wrapper.find('.prompt-list-item.active .prompt-key').text()).toBe('suggest');
    expect(wrapper.find('.prompt-list-item.active .prompt-status').text()).toBe('默认');
    expect((wrapper.find('.prompt-editor .prompt-textarea').element as HTMLTextAreaElement).value).toBe('suggest default {dashboardData} {recentNotes}');
  });

  it('keeps the suggest prompt selected after prompt records load', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    const promptButtons = wrapper.findAll('.prompt-list-item');
    await promptButtons[1]!.trigger('click');

    expect(promptButtons[1]!.classes()).toContain('active');
    expect(wrapper.text()).toContain('洞察建议');
    expect(wrapper.find('.prompt-list-item.active .prompt-key').text()).toBe('suggest');
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

  it('renders promotion projections after initial load and refreshes them on websocket updates', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();

    expect(wrapper.text()).toContain('Promotion Projections');
    expect(wrapper.text()).toContain('Event Nodes');
    expect(wrapper.text()).toContain('Continuity Records');
    expect(wrapper.text()).toContain('Ready event node');
    expect(wrapper.text()).toContain('ready continuity');
    expect(wrapper.text()).toContain('Reintegration record-ready');
    expect(wrapper.text()).toContain('Promotion: ready-1');
    expect(wrapper.text()).toContain('Promotion: ready-2');
    expect(apiMocks.fetchEventNodes).toHaveBeenCalled();
    expect(apiMocks.fetchContinuityRecords).toHaveBeenCalled();

    apiMocks.fetchEventNodes.mockClear();
    apiMocks.fetchContinuityRecords.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'soul-action-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchEventNodes).toHaveBeenCalled();
    expect(apiMocks.fetchContinuityRecords).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows projection errors without breaking the rest of settings load', async () => {
    apiMocks.fetchContinuityRecords.mockRejectedValueOnce(new Error('continuity fetch failed'));

    const wrapper = mountSettingsView();

    await flushPromises();
    expect(wrapper.text()).toContain('Promotion Projections');
    expect(wrapper.text()).toContain('Ready event node');
    expect(wrapper.text()).toContain('continuity fetch failed');
    expect(wrapper.text()).toContain('Reintegration Review');
    expect(wrapper.text()).toContain('Soul Action Governance');

    wrapper.unmount();
  });

  it('keeps partial promotion projections when only event-node fetch fails', async () => {
    apiMocks.fetchEventNodes.mockRejectedValueOnce(new Error('event nodes fetch failed'));

    const wrapper = mountSettingsView();

    await flushPromises();
    expect(wrapper.text()).toContain('Promotion Projections');
    expect(wrapper.text()).toContain('ready continuity');
    expect(wrapper.text()).toContain('event nodes fetch failed');
    expect(wrapper.text()).toContain('暂无 event nodes');

    wrapper.unmount();
  });

  it('reloads promotion projections when the panel emits refresh', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.fetchEventNodes.mockClear();
    apiMocks.fetchContinuityRecords.mockClear();

    const refreshButton = wrapper.findAll('button').find((button) => button.text() === '刷新' && button.element.closest('.projection-card'));
    expect(refreshButton).toBeTruthy();
    await refreshButton!.trigger('click');
    await flushPromises();

    expect(apiMocks.fetchEventNodes).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchContinuityRecords).toHaveBeenCalledTimes(1);

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
      reason: 'Batch approved from settings reintegration governance panel for Reintegration record-mixed (source note note-mixed-1)',
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
      reason: 'Batch approved from settings reintegration governance panel for Reintegration record-mixed (source note note-mixed-1)',
    });
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchReintegrationRecords).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量批准 1/1 条 soul actions');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('groupActionId')).toBe(null);

    wrapper.unmount();
  });

  it('keeps batch approve feedback visible across consecutive worker-task and soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const pendingGroup = groups.find((group) => group.sourceNoteId === 'record-mixed');
    expect(pendingGroup).toBeTruthy();

    panel.vm.$emit('approve-group', pendingGroup);
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量批准 1/1 条 soul actions');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量批准 1/1 条 soul actions');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量批准 1/1 条 soul actions');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');

    wrapper.unmount();
  });

  it('keeps reintegration accept feedback visible across consecutive worker-task, reintegration-record, and soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.acceptReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const reintegrationButtons = wrapper.findAll('.reintegration-card .btn-worker');
    const acceptButton = reintegrationButtons.find((button) => button.attributes('disabled') === undefined);
    expect(acceptButton).toBeTruthy();

    await acceptButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.acceptReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:06:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已接受并自动规划 1 条 promotion actions');

    wrapper.unmount();
  });

  it('keeps manual reintegration planning feedback visible across consecutive worker-task, reintegration-record, and soul-action websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValue([
      createReintegrationRecord({
        id: 'record-ready',
        createdAt: '2026-03-21T10:00:00.000Z',
        summary: 'ready group',
        reviewStatus: 'accepted',
        reviewedAt: '2026-03-21T10:05:00.000Z',
      }),
      createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z', summary: 'mixed group' }),
    ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.planReintegrationPromotions.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const planButton = wrapper.findAll('button').find((button) => button.text() === '手动补规划');
    expect(planButton).toBeTruthy();

    await planButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.planReintegrationPromotions).toHaveBeenCalledWith('record-ready');
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已规划 1 条 promotion actions');

    wrapper.unmount();
  });

  it('keeps manual reintegration planning feedback visible across reintegration-record-updated websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
        createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z', summary: 'mixed group' }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.planReintegrationPromotions.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const planButton = wrapper.findAll('button').find((button) => button.text() === '手动补规划');
    expect(planButton).toBeTruthy();

    await planButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.planReintegrationPromotions).toHaveBeenCalledWith('record-ready');
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已规划 1 条 promotion actions');

    wrapper.unmount();
  });

  it('keeps manual reintegration planning feedback visible across consecutive reintegration-record and soul-action websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
        createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z', summary: 'mixed group' }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.planReintegrationPromotions.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const planButton = wrapper.findAll('button').find((button) => button.text() === '手动补规划');
    expect(planButton).toBeTruthy();

    await planButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.planReintegrationPromotions).toHaveBeenCalledWith('record-ready');
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已规划 1 条 promotion actions');

    wrapper.unmount();
  });

  it('keeps manual reintegration planning feedback visible across consecutive reintegration-record and soul-action websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
        createReintegrationRecord({ id: 'record-mixed', createdAt: '2026-03-20T10:00:00.000Z', summary: 'mixed group' }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.planReintegrationPromotions.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const planButton = wrapper.findAll('button').find((button) => button.text() === '手动补规划');
    expect(planButton).toBeTruthy();

    await planButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.planReintegrationPromotions).toHaveBeenCalledWith('record-ready');
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:05:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已规划 1 条 promotion actions');

    wrapper.unmount();
  });

  it('keeps reintegration reject feedback visible across consecutive worker-task, reintegration-record, and soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.rejectReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const rejectButton = wrapper.findAll('.reintegration-card .btn-cancel').find((button) => button.attributes('disabled') === undefined);
    expect(rejectButton).toBeTruthy();

    await rejectButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.rejectReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
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
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: 'not now',
          reviewedAt: '2026-03-21T10:08:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
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
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已拒绝该 reintegration record');

    wrapper.unmount();
  });

  it('keeps reintegration reject feedback visible across reintegration-record-updated websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
        }),
        createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: 'not now',
          reviewedAt: '2026-03-21T10:08:00.000Z',
        }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.rejectReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const rejectButton = wrapper.findAll('.reintegration-card .btn-cancel').find((button) => button.attributes('disabled') === undefined);
    expect(rejectButton).toBeTruthy();

    await rejectButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.rejectReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: 'not now',
          reviewedAt: '2026-03-21T10:08:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已拒绝该 reintegration record');

    wrapper.unmount();
  });

  it('keeps reintegration reject feedback visible across reintegration-record-updated websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
        }),
        createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: '不符合当前 promotion 条件',
          reviewedAt: '2026-03-21T10:07:00.000Z',
        }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.rejectReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const rejectButton = wrapper.findAll('.reintegration-card .btn-cancel').find((button) => button.attributes('disabled') === undefined);
    expect(rejectButton).toBeTruthy();

    await rejectButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.rejectReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: '不符合当前 promotion 条件',
          reviewedAt: '2026-03-21T10:07:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已拒绝该 reintegration record');

    wrapper.unmount();
  });

  it('keeps reintegration reject feedback visible across consecutive reintegration-record and soul-action websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
        }),
        createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: '不符合当前 promotion 条件',
          reviewedAt: '2026-03-21T10:07:00.000Z',
        }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.rejectReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const rejectButton = wrapper.findAll('.reintegration-card .btn-cancel').find((button) => button.attributes('disabled') === undefined);
    expect(rejectButton).toBeTruthy();

    await rejectButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.rejectReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'rejected',
          reviewReason: '不符合当前 promotion 条件',
          reviewedAt: '2026-03-21T10:07:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
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
    expect(wrapper.text()).toContain('已拒绝该 reintegration record');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已拒绝该 reintegration record');

    wrapper.unmount();
  });

  it('keeps reintegration accept feedback visible across reintegration-record-updated websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
        }),
        createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:06:00.000Z',
        }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.acceptReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const reintegrationButtons = wrapper.findAll('.reintegration-card .btn-worker');
    const acceptButton = reintegrationButtons.find((button) => button.attributes('disabled') === undefined);
    expect(acceptButton).toBeTruthy();

    await acceptButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.acceptReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:06:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已接受并自动规划 1 条 promotion actions');

    wrapper.unmount();
  });

  it('keeps reintegration accept feedback visible across consecutive reintegration-record and soul-action websocket refreshes', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce(reintegrationRecords)
      .mockResolvedValueOnce([
        createReintegrationRecord({
          id: 'record-ready',
          createdAt: '2026-03-21T10:00:00.000Z',
          summary: 'ready group',
        }),
        createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:06:00.000Z',
        }),
      ]);

    const wrapper = mountSettingsView();

    await flushPromises();
    const clientMocks = vi.mocked(client);
    clientMocks.acceptReintegrationRecord.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const reintegrationButtons = wrapper.findAll('.reintegration-card .btn-worker');
    const acceptButton = reintegrationButtons.find((button) => button.attributes('disabled') === undefined);
    expect(acceptButton).toBeTruthy();

    await acceptButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.acceptReintegrationRecord).toHaveBeenCalledWith('record-mixed', { reason: undefined });
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'reintegration-record-updated',
        data: createReintegrationRecord({
          id: 'record-mixed',
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'mixed group',
          reviewStatus: 'accepted',
          reviewedAt: '2026-03-21T10:06:00.000Z',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalled();
    expect(apiMocks.fetchSoulActions).toHaveBeenCalled();
    expect(apiMocks.fetchWorkerTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
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
    expect(wrapper.text()).toContain('已接受并自动规划 1 条 promotion actions');
    expect(wrapper.find('.reintegration-card .message.success').text()).toBe('已接受并自动规划 1 条 promotion actions');

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

  it('keeps batch dispatch feedback visible across consecutive worker-task and soul-action websocket refreshes', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.dispatchSoulAction.mockClear();
    apiMocks.fetchSoulActions.mockClear();
    apiMocks.fetchReintegrationRecords.mockClear();
    apiMocks.fetchWorkerTasks.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const groups = panel.props('groups') as Array<{ sourceNoteId: string; actions: SoulAction[] }>;
    const readyGroup = groups.find((group) => group.sourceNoteId === 'record-ready');
    expect(readyGroup).toBeTruthy();

    panel.vm.$emit('dispatch-group', readyGroup);
    await flushPromises();

    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量派发 2/2 条 soul actions');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量派发 2/2 条 soul actions');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('已批量派发 2/2 条 soul actions');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');

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
      reason: 'Approved from settings reintegration governance panel for Reintegration record-mixed (source note note-mixed-1)',
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

  it('falls back to source note wording when approving a soul action without reintegration source', async () => {
    const wrapper = mountSettingsView();

    await flushPromises();
    apiMocks.approveSoulAction.mockClear();

    const panel = wrapper.findComponent(SoulActionGovernancePanel);
    const standaloneAction = createSoulAction({
      id: 'standalone-note-action',
      sourceNoteId: 'note-standalone',
      sourceReintegrationId: null,
      createdAt: '2026-03-21T11:00:00.000Z',
    });

    panel.vm.$emit('approve-action', standaloneAction);
    await flushPromises();

    expect(apiMocks.approveSoulAction).toHaveBeenCalledWith('standalone-note-action', {
      reason: 'Approved from settings reintegration governance panel for source note note-standalone',
    });

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
    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
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

    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
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

    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');

    wrapper.unmount();
  });

  it('keeps dispatch worker task feedback visible across consecutive worker-task and soul-action websocket refreshes', async () => {
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

    expect(panel.props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
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
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('message')).toBe('dispatched（Worker Task: worker-task-ready-1 · 人格快照更新 · 等待执行 · LifeOS）');
    expect(wrapper.findComponent(SoulActionGovernancePanel).props('messageType')).toBe('success');

    wrapper.unmount();
  });

  it('shows localized worker-task metadata after retrying and cancelling worker tasks', async () => {
    const client = await import('../api/client');
    const retryWorkerTaskMock = vi.mocked(client.retryWorkerTask);
    const cancelWorkerTaskMock = vi.mocked(client.cancelWorkerTask);

    apiMocks.fetchWorkerTasks.mockResolvedValue([
      {
        id: 'worker-task-retry',
        taskType: 'extract_tasks',
        worker: 'lifeos',
        status: 'failed',
        input: { noteId: 'note-1' },
        outputNotes: [],
        resultSummary: null,
        error: null,
        sourceNoteId: 'note-1',
        createdAt: '2026-03-21T10:03:00.000Z',
        updatedAt: '2026-03-21T10:03:00.000Z',
        startedAt: null,
        finishedAt: null,
      },
      {
        id: 'worker-task-cancel',
        taskType: 'openclaw_task',
        worker: 'openclaw',
        status: 'running',
        input: { noteId: 'note-2' },
        outputNotes: [],
        resultSummary: null,
        error: null,
        sourceNoteId: 'note-2',
        createdAt: '2026-03-21T10:04:00.000Z',
        updatedAt: '2026-03-21T10:04:00.000Z',
        startedAt: '2026-03-21T10:04:30.000Z',
        finishedAt: null,
      },
    ]);
    retryWorkerTaskMock.mockResolvedValue({
      id: 'worker-task-retry',
      taskType: 'extract_tasks',
      worker: 'lifeos',
      status: 'pending',
      input: { noteId: 'note-1' },
      outputNotes: [],
      resultSummary: null,
      error: null,
      sourceNoteId: 'note-1',
      createdAt: '2026-03-21T10:03:00.000Z',
      updatedAt: '2026-03-21T10:05:00.000Z',
      startedAt: null,
      finishedAt: null,
    });
    cancelWorkerTaskMock.mockResolvedValue({
      id: 'worker-task-cancel',
      taskType: 'openclaw_task',
      worker: 'openclaw',
      status: 'cancelled',
      input: { noteId: 'note-2' },
      outputNotes: [],
      resultSummary: null,
      error: null,
      sourceNoteId: 'note-2',
      createdAt: '2026-03-21T10:04:00.000Z',
      updatedAt: '2026-03-21T10:05:00.000Z',
      startedAt: '2026-03-21T10:04:30.000Z',
      finishedAt: '2026-03-21T10:05:00.000Z',
    });

    const wrapper = mountSettingsView();
    await flushPromises();

    const retryButton = wrapper.find('.stub-retry');
    await retryButton.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');

    const cancelButton = wrapper.find('.stub-cancel');
    await cancelButton.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已取消任务 worker-task-cancel · OpenClaw 任务 · 已取消 · OpenClaw');

    wrapper.unmount();
  });

  it('keeps worker-task retry feedback visible across websocket refreshes', async () => {
    const client = await import('../api/client');
    const retryWorkerTaskMock = vi.mocked(client.retryWorkerTask);

    apiMocks.fetchWorkerTasks
      .mockResolvedValueOnce([
        {
          id: 'worker-task-retry',
          taskType: 'extract_tasks',
          worker: 'lifeos',
          status: 'failed',
          input: { noteId: 'note-1' },
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: 'note-1',
          createdAt: '2026-03-21T10:03:00.000Z',
          updatedAt: '2026-03-21T10:03:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'worker-task-retry',
          taskType: 'extract_tasks',
          worker: 'lifeos',
          status: 'pending',
          input: { noteId: 'note-1' },
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: 'note-1',
          createdAt: '2026-03-21T10:03:00.000Z',
          updatedAt: '2026-03-21T10:05:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'worker-task-retry',
          taskType: 'extract_tasks',
          worker: 'lifeos',
          status: 'pending',
          input: { noteId: 'note-1' },
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: 'note-1',
          createdAt: '2026-03-21T10:03:00.000Z',
          updatedAt: '2026-03-21T10:05:30.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ]);
    retryWorkerTaskMock.mockResolvedValue({
      id: 'worker-task-retry',
      taskType: 'extract_tasks',
      worker: 'lifeos',
      status: 'pending',
      input: { noteId: 'note-1' },
      outputNotes: [],
      resultSummary: null,
      error: null,
      sourceNoteId: 'note-1',
      createdAt: '2026-03-21T10:03:00.000Z',
      updatedAt: '2026-03-21T10:05:00.000Z',
      startedAt: null,
      finishedAt: null,
    });

    const wrapper = mountSettingsView();
    await flushPromises();

    await wrapper.find('.stub-retry').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(wrapper.text()).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('keeps worker-task cancel feedback visible across websocket refreshes', async () => {
    const client = await import('../api/client');
    const cancelWorkerTaskMock = vi.mocked(client.cancelWorkerTask);

    apiMocks.fetchWorkerTasks
      .mockResolvedValueOnce([
        {
          id: 'worker-task-cancel',
          taskType: 'openclaw_task',
          worker: 'openclaw',
          status: 'running',
          input: { noteId: 'note-2' },
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: 'note-2',
          createdAt: '2026-03-21T10:04:00.000Z',
          updatedAt: '2026-03-21T10:04:00.000Z',
          startedAt: '2026-03-21T10:04:30.000Z',
          finishedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'worker-task-cancel',
          taskType: 'openclaw_task',
          worker: 'openclaw',
          status: 'cancelled',
          input: { noteId: 'note-2' },
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: 'note-2',
          createdAt: '2026-03-21T10:04:00.000Z',
          updatedAt: '2026-03-21T10:05:00.000Z',
          startedAt: '2026-03-21T10:04:30.000Z',
          finishedAt: '2026-03-21T10:05:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'worker-task-cancel',
          taskType: 'openclaw_task',
          worker: 'openclaw',
          status: 'cancelled',
          input: { noteId: 'note-2' },
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: 'note-2',
          createdAt: '2026-03-21T10:04:00.000Z',
          updatedAt: '2026-03-21T10:05:30.000Z',
          startedAt: '2026-03-21T10:04:30.000Z',
          finishedAt: '2026-03-21T10:05:00.000Z',
        },
      ]);
    cancelWorkerTaskMock.mockResolvedValue({
      id: 'worker-task-cancel',
      taskType: 'openclaw_task',
      worker: 'openclaw',
      status: 'cancelled',
      input: { noteId: 'note-2' },
      outputNotes: [],
      resultSummary: null,
      error: null,
      sourceNoteId: 'note-2',
      createdAt: '2026-03-21T10:04:00.000Z',
      updatedAt: '2026-03-21T10:05:00.000Z',
      startedAt: '2026-03-21T10:04:30.000Z',
      finishedAt: '2026-03-21T10:05:00.000Z',
    });

    const wrapper = mountSettingsView();
    await flushPromises();

    await wrapper.find('.stub-cancel').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已取消任务 worker-task-cancel · OpenClaw 任务 · 已取消 · OpenClaw');
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(wrapper.text()).toContain('已取消任务 worker-task-cancel · OpenClaw 任务 · 已取消 · OpenClaw');

    wrapper.unmount();
  });

  it('shows typed classify-inbox create feedback and keeps it visible across websocket refreshes', async () => {
    const classifyInboxMock = vi.mocked(client.classifyInbox);

    apiMocks.fetchWorkerTasks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'worker-task-classify',
          taskType: 'classify_inbox',
          worker: 'lifeos',
          status: 'pending',
          input: {},
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: null,
          createdAt: '2026-03-21T10:08:00.000Z',
          updatedAt: '2026-03-21T10:08:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'worker-task-classify',
          taskType: 'classify_inbox',
          worker: 'lifeos',
          status: 'pending',
          input: {},
          outputNotes: [],
          resultSummary: null,
          error: null,
          sourceNoteId: null,
          createdAt: '2026-03-21T10:08:00.000Z',
          updatedAt: '2026-03-21T10:08:30.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ]);
    classifyInboxMock.mockResolvedValue({
      id: 'worker-task-classify',
      taskType: 'classify_inbox',
      worker: 'lifeos',
      status: 'pending',
      input: {},
      outputNotes: [],
      resultSummary: null,
      error: null,
      sourceNoteId: null,
      createdAt: '2026-03-21T10:08:00.000Z',
      updatedAt: '2026-03-21T10:08:00.000Z',
      startedAt: null,
      finishedAt: null,
    });

    const wrapper = mountSettingsView();
    await flushPromises();

    const classifyButton = wrapper.findAll('button').find((button) => button.text().includes('手动整理 Inbox'));
    expect(classifyButton).toBeTruthy();
    await classifyButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('已创建任务 worker-task-classify · Inbox 整理 · 等待执行 · LifeOS');
    apiMocks.fetchWorkerTasks.mockClear();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'worker-task-updated' },
    }));
    await flushPromises();

    expect(apiMocks.fetchWorkerTasks).toHaveBeenCalled();
    expect(wrapper.text()).toContain('已创建任务 worker-task-classify · Inbox 整理 · 等待执行 · LifeOS');

    wrapper.unmount();
  });
});
