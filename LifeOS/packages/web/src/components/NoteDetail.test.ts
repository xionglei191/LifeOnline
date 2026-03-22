import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Note, WorkerTask, ApprovalStatus, ReintegrationRecord, EventNode, ContinuityRecord, SoulAction } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchNoteById: vi.fn(),
  fetchPersonaSnapshot: vi.fn(),
  fetchReintegrationRecords: vi.fn(),
  fetchEventNodeProjectionList: vi.fn(),
  fetchContinuityProjectionList: vi.fn(),
  fetchSoulActions: vi.fn(),
  extractTasks: vi.fn(),
  updateNote: vi.fn(),
  appendNote: vi.fn(),
  deleteNote: vi.fn(),
  createWorkerTask: vi.fn(),
  fetchWorkerTasks: vi.fn(),
  retryWorkerTask: vi.fn(),
  cancelWorkerTask: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchNoteById: apiMocks.fetchNoteById,
  fetchPersonaSnapshot: apiMocks.fetchPersonaSnapshot,
  fetchReintegrationRecords: apiMocks.fetchReintegrationRecords,
  fetchEventNodeProjectionList: apiMocks.fetchEventNodeProjectionList,
  fetchContinuityProjectionList: apiMocks.fetchContinuityProjectionList,
  fetchSoulActions: apiMocks.fetchSoulActions,
  extractTasks: apiMocks.extractTasks,
  updateNote: apiMocks.updateNote,
  appendNote: apiMocks.appendNote,
  deleteNote: apiMocks.deleteNote,
  createWorkerTask: apiMocks.createWorkerTask,
  fetchWorkerTasks: apiMocks.fetchWorkerTasks,
  retryWorkerTask: apiMocks.retryWorkerTask,
  cancelWorkerTask: apiMocks.cancelWorkerTask,
}));

vi.mock('../utils/crypto', () => ({
  decryptContent: vi.fn(),
  getEncryptionKey: vi.fn(() => 'test-key'),
}));

import NoteDetail from './NoteDetail.vue';
import { SELECTABLE_DIMENSIONS, getDimensionLabel } from '../utils/dimensions';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'note-1.md',
    file_path: overrides.file_path ?? '/vault/learning/note-1.md',
    title: overrides.title ?? 'Test Note',
    content: overrides.content ?? 'hello world',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'learning',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'medium',
    tags: overrides.tags ?? [],
    date: overrides.date ?? '2026-03-22',
    due: overrides.due ?? undefined,
    source: overrides.source ?? 'web',
    created: overrides.created ?? '2026-03-22T10:00:00.000Z',
    updated: overrides.updated ?? '2026-03-22T10:00:00.000Z',
    approval_status: overrides.approval_status ?? null,
    approval_operation: overrides.approval_operation ?? null,
    approval_action: overrides.approval_action ?? null,
    approval_risk: overrides.approval_risk ?? null,
    approval_scope: overrides.approval_scope ?? null,
    encrypted: overrides.encrypted ?? false,
    privacy: overrides.privacy ?? 'private',
    indexed_at: overrides.indexed_at ?? '2026-03-22T10:00:00.000Z',
    file_modified_at: overrides.file_modified_at ?? '2026-03-22T10:00:00.000Z',
  };
}

function createApprovalNote(status: ApprovalStatus = 'pending'): Note {
  return createNote({
    approval_status: status,
    approval_operation: 'openclaw_execute',
    approval_action: 'legacy_openclaw_execute',
    approval_risk: 'high',
    approval_scope: 'vault write',
    due: '2026-03-23T12:00:00.000Z',
    content: 'Need approval body',
  });
}

function createTask(overrides: Partial<WorkerTask> = {}): WorkerTask {
  return {
    id: overrides.id ?? 'worker-task-1',
    taskType: overrides.taskType ?? 'update_persona_snapshot',
    worker: overrides.worker ?? 'lifeos',
    status: overrides.status ?? 'pending',
    input: overrides.input ?? { noteId: 'note-1.md' },
    outputNotes: overrides.outputNotes ?? [],
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    sourceNoteId: overrides.sourceNoteId ?? 'note-1.md',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
}

function createReintegrationRecord(overrides: Partial<ReintegrationRecord> = {}): ReintegrationRecord {
  return {
    id: overrides.id ?? 'record-1',
    workerTaskId: overrides.workerTaskId ?? 'worker-task-1',
    sourceNoteId: overrides.sourceNoteId ?? 'note-1.md',
    soulActionId: overrides.soulActionId ?? 'soul-action-1',
    taskType: overrides.taskType ?? 'extract_tasks',
    terminalStatus: overrides.terminalStatus ?? 'succeeded',
    signalKind: overrides.signalKind ?? 'candidate_task',
    reviewStatus: overrides.reviewStatus ?? 'accepted',
    target: overrides.target ?? 'task_record',
    strength: overrides.strength ?? 'medium',
    summary: overrides.summary ?? 'Projection source',
    evidence: overrides.evidence ?? {},
    reviewReason: overrides.reviewReason ?? null,
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    reviewedAt: overrides.reviewedAt ?? '2026-03-22T10:00:00.000Z',
  };
}

function createEventNode(overrides: Partial<EventNode> = {}): EventNode {
  return {
    id: overrides.id ?? 'event-1',
    sourceReintegrationId: overrides.sourceReintegrationId ?? 'record-1',
    sourceNoteId: overrides.sourceNoteId ?? 'note-1.md',
    sourceSoulActionId: overrides.sourceSoulActionId ?? 'soul-action-1',
    promotionSoulActionId: overrides.promotionSoulActionId ?? 'promotion-1',
    eventKind: overrides.eventKind ?? 'milestone_report',
    title: overrides.title ?? 'Ready event node',
    summary: overrides.summary ?? 'Projection summary',
    threshold: overrides.threshold ?? 'high',
    status: overrides.status ?? 'active',
    evidence: overrides.evidence ?? { proof: true },
    explanation: overrides.explanation ?? { why: 'matched' },
    occurredAt: overrides.occurredAt ?? '2026-03-22T10:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
  };
}

function createContinuityRecord(overrides: Partial<ContinuityRecord> = {}): ContinuityRecord {
  return {
    id: overrides.id ?? 'continuity-1',
    sourceReintegrationId: overrides.sourceReintegrationId ?? 'record-1',
    sourceNoteId: overrides.sourceNoteId ?? 'note-1.md',
    sourceSoulActionId: overrides.sourceSoulActionId ?? 'soul-action-1',
    promotionSoulActionId: overrides.promotionSoulActionId ?? 'promotion-2',
    continuityKind: overrides.continuityKind ?? 'persona_direction',
    target: overrides.target ?? 'task_record',
    strength: overrides.strength ?? 'medium',
    summary: overrides.summary ?? 'ready continuity',
    continuity: overrides.continuity ?? { focus: 'deep work' },
    evidence: overrides.evidence ?? { source: 'note' },
    explanation: overrides.explanation ?? { why: 'persisted' },
    recordedAt: overrides.recordedAt ?? '2026-03-22T10:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
  };
}

function createProjectionListResult<T>(items: T[], sourceReintegrationIds: string[]) {
  return {
    items,
    filters: { sourceReintegrationIds },
  };
}

function createSoulAction(overrides: Partial<SoulAction> = {}): SoulAction {
  return {
    id: overrides.id ?? 'soul-action-1',
    sourceNoteId: overrides.sourceNoteId ?? 'note-1.md',
    sourceReintegrationId: overrides.sourceReintegrationId ?? 'record-1',
    actionKind: overrides.actionKind ?? 'promote_event_node',
    governanceStatus: overrides.governanceStatus ?? 'pending_review',
    executionStatus: overrides.executionStatus ?? 'not_dispatched',
    status: overrides.status ?? (overrides.executionStatus ?? 'not_dispatched'),
    governanceReason: overrides.governanceReason ?? null,
    workerTaskId: overrides.workerTaskId ?? null,
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    approvedAt: overrides.approvedAt ?? null,
    deferredAt: overrides.deferredAt ?? null,
    discardedAt: overrides.discardedAt ?? null,
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
    error: overrides.error ?? null,
    resultSummary: overrides.resultSummary ?? null,
  };
}

function clickButtonByText(text: string) {
  const button = Array.from(document.body.querySelectorAll('button')).find((element) => element.textContent?.trim() === text);
  expect(button).toBeTruthy();
  (button as HTMLButtonElement).click();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
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

describe('NoteDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchNoteById.mockResolvedValue(createNote());
    apiMocks.fetchPersonaSnapshot.mockResolvedValue(null);
    apiMocks.fetchReintegrationRecords.mockResolvedValue([]);
    apiMocks.fetchEventNodeProjectionList.mockResolvedValue(createProjectionListResult([], []));
    apiMocks.fetchContinuityProjectionList.mockResolvedValue(createProjectionListResult([], []));
    apiMocks.fetchSoulActions.mockResolvedValue([]);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.retryWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'pending' }));
    apiMocks.cancelWorkerTask.mockResolvedValue(createTask({ id: 'worker-task-cancel', taskType: 'openclaw_task', worker: 'openclaw', status: 'cancelled' }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers shared note titles on the main detail and delete-confirm paths', async () => {
    apiMocks.fetchNoteById.mockResolvedValue(createNote({ title: 'Shared detail title', file_name: 'fallback-detail-name.md' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Shared detail title');
    expect(document.body.textContent).not.toContain('fallback-detail-name');

    clickButtonByText('删除笔记');
    await nextTick();

    expect(document.body.textContent).toContain('当前笔记：Shared detail title');
    expect(document.body.textContent).not.toContain('当前笔记：fallback-detail-name');

    wrapper.unmount();
  });

  it('uses neutral related-task copy for LifeOS and OpenClaw note tasks', async () => {
    apiMocks.fetchWorkerTasks.mockResolvedValue([
      createTask({ id: 'worker-task-lifeos', taskType: 'update_persona_snapshot', worker: 'lifeos', status: 'pending' }),
      createTask({ id: 'worker-task-openclaw', taskType: 'openclaw_task', worker: 'openclaw', status: 'running' }),
    ]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Worker Task');
    expect(document.body.textContent).toContain('Recent Related Tasks');
    expect(document.body.textContent).toContain('基于当前笔记内容发起关联任务，包含 LifeOS 与 OpenClaw 执行路径');
    expect(document.body.textContent).not.toContain('External Worker Task');
    expect(document.body.textContent).not.toContain('Recent External Tasks');
    expect(document.body.textContent).not.toContain('当前笔记还没有发起过外部任务');

    wrapper.unmount();
  });

  it('renders note dimension labels and worker dimension options from the shared helper', async () => {
    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('学习');
    const dimensionSelect = document.body.querySelector('.worker-field select');
    expect(dimensionSelect).toBeTruthy();
    const dimensionOptions = dimensionSelect?.querySelectorAll('option');
    const dimensionTexts = Array.from(dimensionOptions ?? []).map((option) => option.textContent?.trim() ?? '');
    expect(dimensionTexts).toEqual(SELECTABLE_DIMENSIONS.map((dimension) => getDimensionLabel(dimension.value)));

    wrapper.unmount();
  });

  it('shows neutral empty-state copy when there are no related tasks', async () => {
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('当前笔记还没有发起过关联任务');
    expect(document.body.textContent).not.toContain('当前笔记还没有发起过外部任务');

    wrapper.unmount();
  });

  it('renders latest persona snapshot for the current note', async () => {
    apiMocks.fetchPersonaSnapshot.mockResolvedValue({
      id: 'persona:note-1.md',
      sourceNoteId: 'note-1.md',
      soulActionId: null,
      workerTaskId: 'worker-task-1',
      summary: '已更新人格快照：Test Note',
      snapshot: {
        sourceNoteTitle: 'Test Note',
        summary: '已更新人格快照：Test Note',
        contentPreview: 'Current note preview for persona snapshot.',
        updatedAt: '2026-03-22T10:00:00.000Z',
      },
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
    });

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(apiMocks.fetchPersonaSnapshot).toHaveBeenCalledWith('note-1.md');
    expect(document.body.textContent).toContain('Persona Snapshot');
    expect(document.body.textContent).toContain('已更新人格快照：Test Note');
    expect(document.body.textContent).toContain('Current note preview for persona snapshot.');

    wrapper.unmount();
  });

  it('reloads persona snapshot when a persona worker update arrives for the current note', async () => {
    apiMocks.fetchPersonaSnapshot
      .mockResolvedValueOnce({
        id: 'persona:note-1.md',
        sourceNoteId: 'note-1.md',
        soulActionId: null,
        workerTaskId: 'worker-task-1',
        summary: '旧人格快照',
        snapshot: {
          sourceNoteTitle: 'Test Note',
          summary: '旧人格快照',
          contentPreview: 'old snapshot preview',
          updatedAt: '2026-03-22T10:00:00.000Z',
        },
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'persona:note-1.md',
        sourceNoteId: 'note-1.md',
        soulActionId: null,
        workerTaskId: 'worker-task-2',
        summary: '新人格快照',
        snapshot: {
          sourceNoteTitle: 'Test Note',
          summary: '新人格快照',
          contentPreview: 'new snapshot preview',
          updatedAt: '2026-03-22T11:00:00.000Z',
        },
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T11:00:00.000Z',
      });

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    expect(document.body.textContent).toContain('旧人格快照');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-worker-tasks-updated',
        data: {
          sourceNoteId: 'note-1.md',
          task: createTask({
            id: 'worker-task-2',
            taskType: 'update_persona_snapshot',
            sourceNoteId: 'note-1.md',
            status: 'done',
          }),
        },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchPersonaSnapshot).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('新人格快照');
    expect(document.body.textContent).toContain('new snapshot preview');
    expect(document.body.textContent).not.toContain('old snapshot preview');

    wrapper.unmount();
  });

  it('surfaces promotion projections for the current note only', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValue([
      createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' }),
      createReintegrationRecord({ id: 'record-other', sourceNoteId: 'note-2.md', reviewStatus: 'accepted' }),
    ]);
    apiMocks.fetchEventNodeProjectionList.mockResolvedValueOnce(createProjectionListResult([
      createEventNode({ id: 'event-ready', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'Ready event node' }),
      createEventNode({ id: 'event-other', sourceReintegrationId: 'record-other', sourceNoteId: 'note-2.md', title: 'External event node' }),
    ], ['record-ready']));
    apiMocks.fetchContinuityProjectionList.mockResolvedValueOnce(createProjectionListResult([
      createContinuityRecord({ id: 'continuity-ready', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', summary: 'ready continuity' }),
      createContinuityRecord({ id: 'continuity-other', sourceReintegrationId: 'record-other', sourceNoteId: 'note-2.md', summary: 'external continuity' }),
    ], ['record-ready']));
    apiMocks.fetchSoulActions.mockResolvedValue([
      createSoulAction({ id: 'action-ready', sourceNoteId: 'note-1.md', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
      createSoulAction({ id: 'action-other', sourceNoteId: 'note-2.md', sourceReintegrationId: 'record-other', actionKind: 'promote_continuity_record', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' }),
    ]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledWith({ sourceNoteId: 'note-1.md' });
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledWith({ sourceNoteId: 'note-1.md' });
    expect(apiMocks.fetchEventNodeProjectionList).toHaveBeenCalledWith(['record-ready']);
    expect(apiMocks.fetchContinuityProjectionList).toHaveBeenCalledWith(['record-ready']);
    expect(document.body.textContent).toContain('Promotion Projection');
    expect(document.body.textContent).toContain('Actions 1');
    expect(document.body.textContent).toContain('待派发 1');
    expect(document.body.textContent).toContain('提升 Event Node');
    expect(document.body.textContent).toContain('Ready event node');
    expect(document.body.textContent).toContain('ready continuity');
    expect(document.body.textContent).not.toContain('External event node');
    expect(document.body.textContent).not.toContain('external continuity');

    wrapper.unmount();
  });

  it('surfaces projection artifacts when canonical reintegration scope matches even without matching sourceNoteId', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValueOnce([
      createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' }),
    ]);
    apiMocks.fetchEventNodeProjectionList.mockResolvedValueOnce(createProjectionListResult([
      createEventNode({ id: 'event-ready', sourceReintegrationId: 'record-ready', sourceNoteId: null, title: 'Canonical event node' }),
      createEventNode({ id: 'event-other', sourceReintegrationId: 'record-other', sourceNoteId: 'note-2.md', title: 'External event node' }),
    ], ['record-ready']));
    apiMocks.fetchContinuityProjectionList.mockResolvedValueOnce(createProjectionListResult([
      createContinuityRecord({ id: 'continuity-ready', sourceReintegrationId: 'record-ready', sourceNoteId: null, summary: 'canonical continuity' }),
      createContinuityRecord({ id: 'continuity-other', sourceReintegrationId: 'record-other', sourceNoteId: 'note-2.md', summary: 'external continuity' }),
    ], ['record-ready']));
    apiMocks.fetchSoulActions.mockResolvedValueOnce([
      createSoulAction({ id: 'action-ready', sourceNoteId: 'reint:record-ready', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
    ]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(apiMocks.fetchEventNodeProjectionList).toHaveBeenCalledWith(['record-ready']);
    expect(apiMocks.fetchContinuityProjectionList).toHaveBeenCalledWith(['record-ready']);
    expect(document.body.textContent).toContain('Canonical event node');
    expect(document.body.textContent).toContain('canonical continuity');
    expect(document.body.textContent).not.toContain('External event node');
    expect(document.body.textContent).not.toContain('external continuity');

    wrapper.unmount();
  });

  it('reloads promotion projections when a projection websocket update arrives for the current note', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce([createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' })])
      .mockResolvedValueOnce([createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' })])
      .mockResolvedValueOnce([createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' })]);
    apiMocks.fetchSoulActions
      .mockResolvedValueOnce([createSoulAction({ id: 'action-old', sourceNoteId: 'note-1.md', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' })])
      .mockResolvedValueOnce([createSoulAction({ id: 'action-new', sourceNoteId: 'note-1.md', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'approved', executionStatus: 'not_dispatched' })]);
    apiMocks.fetchEventNodeProjectionList
      .mockResolvedValueOnce(createProjectionListResult([
        createEventNode({ id: 'event-old', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'Old event node' }),
      ], ['record-ready']))
      .mockResolvedValueOnce(createProjectionListResult([
        createEventNode({ id: 'event-new', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'New event node' }),
      ], ['record-ready']));
    apiMocks.fetchContinuityProjectionList
      .mockResolvedValueOnce(createProjectionListResult([], ['record-ready']))
      .mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    expect(document.body.textContent).toContain('Old event node');
    expect(document.body.textContent).toContain('待治理 1');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'event-node-updated',
        data: {
          eventNode: createEventNode({ id: 'event-new', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'New event node' }),
        },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchEventNodeProjectionList).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('New event node');
    expect(document.body.textContent).toContain('待派发 1');
    expect(document.body.textContent).not.toContain('Old event node');

    wrapper.unmount();
  });

  it('reloads promotion projections when a projection-linked soul action update arrives via reintegration identity', async () => {
    apiMocks.fetchReintegrationRecords
      .mockResolvedValueOnce([createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' })])
      .mockResolvedValueOnce([createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' })]);
    apiMocks.fetchSoulActions
      .mockResolvedValueOnce([
        createSoulAction({ id: 'action-via-reint', sourceNoteId: 'reint:record-ready', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' }),
      ])
      .mockResolvedValueOnce([
        createSoulAction({ id: 'action-via-reint', sourceNoteId: 'reint:record-ready', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
      ]);
    apiMocks.fetchEventNodeProjectionList
      .mockResolvedValueOnce(createProjectionListResult([
        createEventNode({ id: 'event-old', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'Old event node' }),
      ], ['record-ready']))
      .mockResolvedValueOnce(createProjectionListResult([
        createEventNode({ id: 'event-new', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'New event node' }),
      ], ['record-ready']));
    apiMocks.fetchContinuityProjectionList
      .mockResolvedValueOnce(createProjectionListResult([], ['record-ready']))
      .mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    expect(document.body.textContent).toContain('Old event node');
    expect(document.body.textContent).toContain('待治理 1');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'soul-action-updated',
        data: createSoulAction({
          id: 'action-via-reint',
          sourceNoteId: 'reint:record-ready',
          sourceReintegrationId: 'record-ready',
          actionKind: 'promote_event_node',
          governanceStatus: 'approved',
          executionStatus: 'not_dispatched',
        }),
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchEventNodeProjectionList).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('New event node');
    expect(document.body.textContent).toContain('待派发 1');
    expect(document.body.textContent).not.toContain('Old event node');

    wrapper.unmount();
  });

  it('keeps projection soul actions when they match the current note via reintegration source ids', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValueOnce([
      createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' }),
    ]);
    apiMocks.fetchSoulActions.mockResolvedValueOnce([
      createSoulAction({ id: 'action-via-reint', sourceNoteId: 'reint:record-ready', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'approved', executionStatus: 'not_dispatched' }),
      createSoulAction({ id: 'action-other', sourceNoteId: 'note-2.md', sourceReintegrationId: 'record-other', actionKind: 'promote_continuity_record', governanceStatus: 'pending_review', executionStatus: 'not_dispatched' }),
    ]);
    apiMocks.fetchEventNodeProjectionList.mockResolvedValueOnce(createProjectionListResult([
      createEventNode({ id: 'event-ready', sourceReintegrationId: 'record-ready', sourceNoteId: 'note-1.md', title: 'Ready event node' }),
    ], ['record-ready']));
    apiMocks.fetchContinuityProjectionList.mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(apiMocks.fetchReintegrationRecords).toHaveBeenCalledWith({ sourceNoteId: 'note-1.md' });
    expect(apiMocks.fetchSoulActions).toHaveBeenCalledWith({ sourceNoteId: 'note-1.md' });
    expect(apiMocks.fetchEventNodeProjectionList).toHaveBeenCalledWith(['record-ready']);
    expect(document.body.textContent).toContain('Actions 1');
    expect(document.body.textContent).toContain('待派发 1');
    expect(document.body.textContent).toContain('提升 Event Node');
    expect(document.body.textContent).toContain('Ready event node');
    expect(document.body.textContent).not.toContain('提升 Continuity Record');

    wrapper.unmount();
  });


  it('surfaces pending and approved promotion soul actions on the current note path', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValueOnce([
      createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' }),
    ]);
    apiMocks.fetchSoulActions.mockResolvedValueOnce([
      createSoulAction({ id: 'action-pending', sourceNoteId: 'note-1.md', sourceReintegrationId: 'record-ready', actionKind: 'promote_event_node', governanceStatus: 'pending_review', executionStatus: 'not_dispatched', governanceReason: 'need manual review' }),
      createSoulAction({ id: 'action-approved', sourceNoteId: 'note-1.md', sourceReintegrationId: 'record-ready', actionKind: 'promote_continuity_record', governanceStatus: 'approved', executionStatus: 'not_dispatched', resultSummary: 'approved for dispatch' }),
    ]);
    apiMocks.fetchEventNodeProjectionList.mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));
    apiMocks.fetchContinuityProjectionList.mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Actions 2');
    expect(document.body.textContent).toContain('待治理 1');
    expect(document.body.textContent).toContain('待派发 1');
    expect(document.body.textContent).toContain('提升 Event Node');
    expect(document.body.textContent).toContain('提升 Continuity Record');
    expect(document.body.textContent).toContain('治理理由：need manual review');
    expect(document.body.textContent).toContain('执行摘要：approved for dispatch');

    wrapper.unmount();
  });

  it('shows projection empty state when scoped projection fetch finds no persisted artifacts for the current note', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValueOnce([
      createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' }),
    ]);
    apiMocks.fetchEventNodeProjectionList.mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));
    apiMocks.fetchContinuityProjectionList.mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Promotion Projection');
    expect(document.body.textContent).toContain('当前还没有 promotion projections');

    wrapper.unmount();
  });

  it('shows projection error copy when scoped projection artifact fetch fails for the current note', async () => {
    apiMocks.fetchReintegrationRecords.mockResolvedValueOnce([
      createReintegrationRecord({ id: 'record-ready', sourceNoteId: 'note-1.md', reviewStatus: 'accepted' }),
    ]);
    apiMocks.fetchEventNodeProjectionList.mockRejectedValueOnce(new Error('projection fetch failed'));
    apiMocks.fetchContinuityProjectionList.mockResolvedValueOnce(createProjectionListResult([], ['record-ready']));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('projection fetch failed');
    expect(document.body.textContent).toContain('Promotion Projection');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after creating summarize task', async () => {
    apiMocks.createWorkerTask.mockResolvedValue(createTask({ taskType: 'summarize_note', worker: 'lifeos', status: 'pending' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('生成笔记摘要');
    await flushPromises();

    expect(apiMocks.createWorkerTask).toHaveBeenCalledWith({
      taskType: 'summarize_note',
      sourceNoteId: 'note-1.md',
      input: { noteId: 'note-1.md' },
    });
    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · 笔记摘要 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after creating persona snapshot task', async () => {
    apiMocks.createWorkerTask.mockResolvedValue(createTask({ taskType: 'update_persona_snapshot', worker: 'lifeos', status: 'pending' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('更新人格快照');
    await flushPromises();

    expect(apiMocks.createWorkerTask).toHaveBeenCalledWith({
      taskType: 'update_persona_snapshot',
      sourceNoteId: 'note-1.md',
      input: { noteId: 'note-1.md' },
    });
    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · 人格快照更新 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after creating OpenClaw task', async () => {
    apiMocks.createWorkerTask.mockResolvedValue(createTask({ taskType: 'openclaw_task', worker: 'openclaw', status: 'running' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const instructionInput = document.body.querySelector('textarea[placeholder="输入自然语言指令，例如：搜索相关领域最新进展"]') as HTMLTextAreaElement | null;
    expect(instructionInput).toBeTruthy();
    instructionInput!.value = 'search latest progress';
    instructionInput!.dispatchEvent(new Event('input'));
    await flushPromises();
    clickButtonByText('执行 OpenClaw 任务');
    await flushPromises();

    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · OpenClaw 任务 · 执行中 · OpenClaw');
    expect(document.body.textContent).not.toContain('openclaw_task');
    expect(document.body.textContent).not.toContain('openclaw');

    wrapper.unmount();
  });

  it('shows neutral related-task error copy when creating an OpenClaw task fails', async () => {
    apiMocks.createWorkerTask.mockRejectedValueOnce(new Error(''));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    const instructionInput = document.body.querySelector('textarea[placeholder="输入自然语言指令，例如：搜索相关领域最新进展"]') as HTMLTextAreaElement | null;
    expect(instructionInput).toBeTruthy();
    instructionInput!.value = 'search latest progress';
    instructionInput!.dispatchEvent(new Event('input'));
    await flushPromises();
    clickButtonByText('执行 OpenClaw 任务');
    await flushPromises();

    expect(document.body.textContent).toContain('关联任务创建失败');
    expect(document.body.textContent).not.toContain('外部任务创建失败');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after extracting tasks', async () => {
    apiMocks.extractTasks.mockResolvedValue(createTask({ taskType: 'extract_tasks', worker: 'lifeos', status: 'succeeded' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('提取行动项');
    await flushPromises();

    expect(apiMocks.extractTasks).toHaveBeenCalledWith('note-1.md');
    expect(document.body.textContent).toContain('已创建任务 worker-task-1 · 提取行动项 · 已完成 · LifeOS');
    expect(document.body.textContent).not.toContain('extract_tasks');

    wrapper.unmount();
  });

  it('renders localized worker-task metadata after retrying a related task', async () => {
    apiMocks.fetchWorkerTasks.mockResolvedValue([createTask({ id: 'worker-task-retry', taskType: 'extract_tasks', worker: 'lifeos', status: 'failed' })]);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    clickButtonByText('重试任务');
    await flushPromises();

    expect(apiMocks.retryWorkerTask).toHaveBeenCalledWith('worker-task-retry');
    expect(document.body.textContent).toContain('已重新入队任务 worker-task-retry · 提取行动项 · 等待执行 · LifeOS');

    wrapper.unmount();
  });

  it('renders approval metadata from the shared Note contract', async () => {
    apiMocks.fetchNoteById.mockResolvedValue(createApprovalNote());

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('OpenClaw 审批请求');
    expect(document.body.textContent).toContain('openclaw_execute');
    expect(document.body.textContent).toContain('vault write');
    expect(document.body.textContent).toContain('pending');

    wrapper.unmount();
  });

  it('renders encrypted placeholder from the shared Note contract flag', async () => {
    apiMocks.fetchNoteById.mockResolvedValue(createNote({
      encrypted: true,
      privacy: 'sensitive',
      content: 'iv:authTag:cipherText',
    }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.innerHTML).toContain('内容已加密，需要解锁后查看');

    wrapper.unmount();
  });

  it('reloads note content when a note-updated websocket event arrives for the current note', async () => {
    apiMocks.fetchNoteById
      .mockResolvedValueOnce(createNote({ id: 'note-1.md', file_name: 'note-1.md', title: 'Test Note', content: 'old note body' }))
      .mockResolvedValueOnce(createNote({ id: 'note-1.md', file_name: 'note-1.md', title: 'Test Note', content: 'fresh note body' }));

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await flushPromises();
    expect(document.body.textContent).toContain('old note body');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-updated',
        data: { noteId: 'note-1.md' },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchNoteById).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('fresh note body');
    expect(document.body.textContent).not.toContain('old note body');

    wrapper.unmount();
  });

  it('ignores stale note-detail responses after switching to a newer note', async () => {
    const first = deferred<Note>();
    const second = deferred<Note>();
    apiMocks.fetchNoteById.mockReset();
    apiMocks.fetchNoteById
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.fetchPersonaSnapshot.mockResolvedValue(null);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await nextTick();
    await wrapper.setProps({ noteId: 'note-2.md' });
    await nextTick();

    second.resolve(createNote({ id: 'note-2.md', file_name: 'note-2.md', title: 'note-2', content: 'new content' }));
    await flushPromises();

    expect(document.body.textContent).toContain('note-2');

    first.resolve(createNote({ id: 'note-1.md', file_name: 'note-1.md', title: 'note-1', content: 'old content' }));
    await flushPromises();

    expect(document.body.textContent).toContain('note-2');
    expect(document.body.textContent).not.toContain('note-1');

    wrapper.unmount();
  });

  it('ignores stale note-detail errors after switching to a newer note', async () => {
    const first = deferred<Note>();
    const second = deferred<Note>();
    apiMocks.fetchNoteById.mockReset();
    apiMocks.fetchNoteById
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    apiMocks.fetchWorkerTasks.mockResolvedValue([]);
    apiMocks.fetchPersonaSnapshot.mockResolvedValue(null);

    const wrapper = mount(NoteDetail, {
      props: { noteId: 'note-1.md' },
      global: {
        stubs: {
          Teleport: false,
          PrivacyMask: { template: '<div><slot /></div>' },
          WorkerTaskDetail: true,
          WorkerTaskCard: workerTaskCardStub(),
        },
      },
      attachTo: document.body,
    });

    await nextTick();
    await wrapper.setProps({ noteId: 'note-2.md' });
    await nextTick();

    second.resolve(createNote({ id: 'note-2.md', file_name: 'note-2.md', title: 'note-2', content: 'fresh content' }));
    await flushPromises();

    first.reject(new Error('stale note failed'));
    await flushPromises();

    expect(document.body.textContent).toContain('note-2');
    expect(document.body.textContent).not.toContain('stale note failed');

    wrapper.unmount();
  });
});
