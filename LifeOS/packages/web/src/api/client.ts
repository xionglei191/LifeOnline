import { normalizeSoulActionSourceFilters, type ApiErrorResponse, type ApiResponse, type DashboardData, type Note, type TimelineData, type CalendarData, type WorkerTask, type CreateWorkerTaskRequest, type WorkerTaskListFilters, type TaskSchedule, type CreateTaskScheduleRequest, type UpdateTaskScheduleRequest, type PromptRecord, type PromptKey, type ListAiPromptsResponse, type AiPromptResponse, type ResetAiPromptResponse, type UpdatePromptRequest, type AiProviderSettings, type UpdateAiProviderSettingsRequest, type TestAiProviderConnectionRequest, type TestAiProviderConnectionResponse, type AISuggestion, type ListAiSuggestionsResponse, type ReintegrationRecord, type ListReintegrationRecordsResponse, type ReintegrationReviewRequest, type AcceptReintegrationRecordResponse, type RejectReintegrationRecordResponse, type PlanReintegrationPromotionsResponse, type SoulAction, type ListSoulActionsResponse, type SoulActionResponse, type DispatchSoulActionResponse, type SoulActionGovernanceStatus, type SoulActionExecutionStatus, type SoulActionKind, type EventNode, type ListEventNodesResponse, type ContinuityRecord, type ListContinuityRecordsResponse, type CreateNoteRequest, type CreateNoteResponse, type UpdateNoteRequest, type UpdateNoteResponse, type SearchResult, type Config, type UpdateConfigRequest, type UpdateConfigResponse, type IndexStatus, type IndexErrorEventData, type IndexResult, type ScheduleHealth, type StatsTrendPoint, type StatsRadarPoint, type StatsMonthlyPoint, type StatsTagPoint, type CreateWorkerTaskResponse, type WorkerTaskListResponse, type WorkerTaskResponse, type ClearFinishedWorkerTasksResponse, type TaskScheduleResponse, type TaskScheduleListResponse, type DeleteTaskScheduleResponse, type PersonaSnapshot, type PersonaSnapshotResponse, type BrainstormSession } from '@lifeos/shared';

export type IndexError = IndexErrorEventData;

const API_BASE = '/api';

type ScopedListResponse<TItem, TFilters> = {
  items: TItem[];
  filters: TFilters;
};

export type ProjectionListResponse<T> = ScopedListResponse<T, {
  sourceReintegrationIds: string[];
}>;

export type WorkerTaskListResult = ScopedListResponse<WorkerTask, WorkerTaskListFilters>;

export type ReintegrationRecordListResult = ScopedListResponse<ReintegrationRecord, ListReintegrationRecordsResponse['filters']>;

export type SoulActionListResult = ScopedListResponse<SoulAction, ListSoulActionsResponse['filters']>;

function normalizeSourceReintegrationIds(sourceReintegrationIds?: string[]): string[] {
  if (!sourceReintegrationIds?.length) return [];

  return [...new Set(sourceReintegrationIds
    .map((value) => value.trim())
    .filter(Boolean))];
}

function normalizeWorkerTaskFilters(filters?: WorkerTaskListResponse['filters']): WorkerTaskListFilters {
  return {
    sourceNoteId: filters?.sourceNoteId?.trim() || undefined,
    status: filters?.status,
    taskType: filters?.taskType,
    worker: filters?.worker,
  };
}

function normalizeProjectionFilters(
  filters?: Pick<ListEventNodesResponse['filters'], 'sourceReintegrationIds'>,
): { sourceReintegrationIds: string[] } {
  return {
    sourceReintegrationIds: normalizeSourceReintegrationIds(filters?.sourceReintegrationIds),
  };
}

function normalizeReintegrationFilters(
  filters?: ListReintegrationRecordsResponse['filters'],
): ListReintegrationRecordsResponse['filters'] {
  return {
    reviewStatus: filters?.reviewStatus,
    sourceNoteId: filters?.sourceNoteId?.trim() || undefined,
  };
}

function normalizeSoulActionFilters(
  filters?: ListSoulActionsResponse['filters'],
): ListSoulActionsResponse['filters'] {
  return {
    sourceNoteId: filters?.sourceNoteId?.trim() || undefined,
    sourceReintegrationId: filters?.sourceReintegrationId?.trim() || undefined,
    governanceStatus: filters?.governanceStatus,
    executionStatus: filters?.executionStatus,
    actionKind: filters?.actionKind,
  };
}

async function readApiResponse<T>(res: Response): Promise<ApiResponse<T> & ApiErrorLike> {
  return res.json().catch(() => ({} as ApiResponse<T> & ApiErrorLike));
}

async function expectApiSuccess<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await readApiResponse<T>(res);
  if (!res.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data as T;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  return expectApiSuccess<DashboardData>(res, 'Failed to fetch dashboard');
}

export async function fetchNotes(filters?: { dimension?: string; status?: string; type?: string }): Promise<Note[]> {
  const params = new URLSearchParams();
  if (filters?.dimension) {
    params.set('dimension', filters.dimension);
  }
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.type) {
    params.set('type', filters.type);
  }

  const query = params.toString();
  const res = await fetch(`${API_BASE}/notes${query ? `?${query}` : ''}`);
  return expectApiSuccess<Note[]>(res, 'Failed to fetch notes');
}

export async function triggerIndex(): Promise<IndexResult> {
  const res = await fetch(`${API_BASE}/index`, { method: 'POST' });
  return expectApiSuccess<IndexResult>(res, 'Failed to trigger index');
}

export async function fetchIndexStatus(): Promise<IndexStatus> {
  const res = await fetch(`${API_BASE}/index/status`);
  return expectApiSuccess<IndexStatus>(res, 'Failed to fetch index status');
}

export async function fetchIndexErrors(): Promise<IndexError[]> {
  const res = await fetch(`${API_BASE}/index/errors`);
  return expectApiSuccess<IndexError[]>(res, 'Failed to fetch index errors');
}

export async function fetchTimeline(start: string, end: string): Promise<TimelineData> {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${API_BASE}/timeline?${params}`);
  return expectApiSuccess<TimelineData>(res, 'Failed to fetch timeline');
}

export async function fetchCalendar(year: number, month: number): Promise<CalendarData> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const res = await fetch(`${API_BASE}/calendar?${params}`);
  return expectApiSuccess<CalendarData>(res, 'Failed to fetch calendar');
}

export async function fetchNoteById(id: string): Promise<Note> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}`);
  return expectApiSuccess<Note>(res, 'Failed to fetch note');
}

export async function fetchPersonaSnapshot(sourceNoteId: string): Promise<PersonaSnapshot | null> {
  const res = await fetch(`${API_BASE}/persona-snapshots/${encodeURIComponent(sourceNoteId)}`);
  const data = await expectApiSuccess<PersonaSnapshotResponse>(res, 'Failed to fetch persona snapshot');
  return data.snapshot ?? null;
}

export async function searchNotes(query: string): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/search?${params}`);
  return expectApiSuccess<SearchResult>(res, 'Failed to search notes');
}

export async function fetchConfig(): Promise<Config> {
  const res = await fetch(`${API_BASE}/config`);
  return expectApiSuccess<Config>(res, 'Failed to fetch config');
}

export async function updateConfig(vaultPath: string): Promise<UpdateConfigResponse> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultPath } satisfies UpdateConfigRequest),
  });
  return expectApiSuccess<UpdateConfigResponse>(res, 'Failed to update config');
}

// AI API types
export interface ClassifyResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    file: string;
    success: boolean;
    dimension?: string;
    type?: string;
    tags?: string[];
    newPath?: string;
    error?: string;
  }>;
}

export interface ExtractTasksResult {
  tasks: Array<{
    title: string;
    due?: string;
    priority: 'high' | 'medium' | 'low';
    created?: boolean;
    filePath?: string;
  }>;
  count: number;
}

export async function fetchAiPrompts(): Promise<PromptRecord[]> {
  const res = await fetch(`${API_BASE}/ai/prompts`);
  const data = await res.json().catch(() => ({} as Partial<ListAiPromptsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch AI prompts');
  }
  return data.prompts || [];
}

export async function updateAiPrompt(key: PromptKey, payload: UpdatePromptRequest): Promise<PromptRecord> {
  const res = await fetch(`${API_BASE}/ai/prompts/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<AiPromptResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update AI prompt');
  }
  return data.prompt as PromptRecord;
}

export async function resetAiPrompt(key: PromptKey): Promise<ResetAiPromptResponse> {
  const res = await fetch(`${API_BASE}/ai/prompts/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({} as Partial<ResetAiPromptResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset AI prompt');
  }
  return data as ResetAiPromptResponse;
}

export async function fetchAiProviderSettings(): Promise<AiProviderSettings> {
  const res = await fetch(`${API_BASE}/ai/provider`);
  const data = await res.json().catch(() => ({} as Partial<AiProviderSettings> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch AI provider settings');
  }
  return data as AiProviderSettings;
}

export async function updateAiProviderSettings(payload: UpdateAiProviderSettingsRequest): Promise<AiProviderSettings> {
  const res = await fetch(`${API_BASE}/ai/provider`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<AiProviderSettings> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update AI provider settings');
  }
  return data as AiProviderSettings;
}

export async function testAiProviderConnection(payload: TestAiProviderConnectionRequest): Promise<TestAiProviderConnectionResponse> {
  const res = await fetch(`${API_BASE}/ai/provider/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<TestAiProviderConnectionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to test AI provider connection');
  }
  return data as TestAiProviderConnectionResponse;
}

export async function createWorkerTask(request: CreateWorkerTaskRequest): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await res.json().catch(() => ({} as Partial<CreateWorkerTaskResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create worker task');
  }
  return data.task as WorkerTask;
}

export async function fetchWorkerTaskList(
  limit = 10,
  options?: WorkerTaskListFilters,
): Promise<WorkerTaskListResult> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.sourceNoteId) {
    params.set('sourceNoteId', options.sourceNoteId);
  }
  if (options?.status) {
    params.set('status', options.status);
  }
  if (options?.taskType) {
    params.set('taskType', options.taskType);
  }
  if (options?.worker) {
    params.set('worker', options.worker);
  }
  const res = await fetch(`${API_BASE}/worker-tasks?${params}`);
  const data = await res.json().catch(() => ({} as Partial<WorkerTaskListResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch worker tasks');
  }
  return {
    items: data.tasks || [],
    filters: normalizeWorkerTaskFilters(data.filters),
  };
}

export async function fetchWorkerTasks(
  limit = 10,
  options?: WorkerTaskListFilters,
): Promise<WorkerTask[]> {
  const data = await fetchWorkerTaskList(limit, options);
  return data.items;
}

export async function fetchReintegrationRecordList(filters?: {
  reviewStatus?: ReintegrationRecord['reviewStatus'];
  sourceNoteId?: string;
}): Promise<ReintegrationRecordListResult> {
  const params = new URLSearchParams();
  if (filters?.reviewStatus) {
    params.set('reviewStatus', filters.reviewStatus);
  }
  if (filters?.sourceNoteId) {
    params.set('sourceNoteId', filters.sourceNoteId);
  }
  const query = params.toString();
  const res = await fetch(`${API_BASE}/reintegration-records${query ? `?${query}` : ''}`);
  const data = await res.json().catch(() => ({} as Partial<ListReintegrationRecordsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch reintegration records');
  }
  return {
    items: data.reintegrationRecords || [],
    filters: normalizeReintegrationFilters(data.filters),
  };
}

export async function fetchReintegrationRecords(filters?: {
  reviewStatus?: ReintegrationRecord['reviewStatus'];
  sourceNoteId?: string;
}): Promise<ReintegrationRecord[]> {
  const data = await fetchReintegrationRecordList(filters);
  return data.items;
}

function normalizeReintegrationPlanningResponse<T extends {
  reintegrationRecord: ReintegrationRecord;
  nextActionSummary: AcceptReintegrationRecordResponse['nextActionSummary'] | PlanReintegrationPromotionsResponse['nextActionSummary'];
  displaySummary: AcceptReintegrationRecordResponse['displaySummary'] | PlanReintegrationPromotionsResponse['displaySummary'];
}>(result: T): T {
  return {
    ...result,
    reintegrationRecord: {
      ...result.reintegrationRecord,
      nextActionSummary: result.nextActionSummary ?? result.reintegrationRecord.nextActionSummary ?? null,
      displaySummary: result.displaySummary ?? result.reintegrationRecord.displaySummary ?? null,
    },
  };
}

export async function acceptReintegrationRecord(id: string, payload: ReintegrationReviewRequest = {}): Promise<AcceptReintegrationRecordResponse> {
  const res = await fetch(`${API_BASE}/reintegration-records/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<AcceptReintegrationRecordResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to accept reintegration record');
  }
  return normalizeReintegrationPlanningResponse(data as AcceptReintegrationRecordResponse);
}

export async function rejectReintegrationRecord(id: string, payload: ReintegrationReviewRequest = {}): Promise<RejectReintegrationRecordResponse> {
  const res = await fetch(`${API_BASE}/reintegration-records/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<RejectReintegrationRecordResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reject reintegration record');
  }
  return data as RejectReintegrationRecordResponse;
}

export async function planReintegrationPromotions(id: string): Promise<PlanReintegrationPromotionsResponse> {
  const res = await fetch(`${API_BASE}/reintegration-records/${encodeURIComponent(id)}/plan-promotions`, {
    method: 'POST',
  });
  const data = await expectApiSuccess<PlanReintegrationPromotionsResponse>(res, 'Failed to plan reintegration promotions');
  return normalizeReintegrationPlanningResponse(data);
}

export async function fetchSoulActionList(filters?: {
  sourceNoteId?: string;
  sourceReintegrationId?: string;
  governanceStatus?: SoulActionGovernanceStatus;
  executionStatus?: SoulActionExecutionStatus;
  actionKind?: SoulActionKind;
}): Promise<SoulActionListResult> {
  const params = new URLSearchParams();
  const normalizedSourceFilters = normalizeSoulActionSourceFilters(
    {
      sourceNoteId: filters?.sourceNoteId,
      sourceReintegrationId: filters?.sourceReintegrationId,
    },
    filters?.sourceReintegrationId || !filters?.sourceNoteId?.startsWith('reint:')
      ? []
      : [{ sourceReintegrationId: filters.sourceNoteId }],
  );
  if (normalizedSourceFilters.sourceNoteId) params.set('sourceNoteId', normalizedSourceFilters.sourceNoteId);
  if (normalizedSourceFilters.sourceReintegrationId) params.set('sourceReintegrationId', normalizedSourceFilters.sourceReintegrationId);
  if (filters?.governanceStatus) params.set('governanceStatus', filters.governanceStatus);
  if (filters?.executionStatus) params.set('executionStatus', filters.executionStatus);
  if (filters?.actionKind) params.set('actionKind', filters.actionKind);
  const query = params.toString();
  const res = await fetch(`${API_BASE}/soul-actions${query ? `?${query}` : ''}`);
  const data = await res.json().catch(() => ({} as Partial<ListSoulActionsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch soul actions');
  }
  return {
    items: data.soulActions || [],
    filters: normalizeSoulActionFilters(data.filters),
  };
}

export async function fetchSoulActions(filters?: {
  sourceNoteId?: string;
  sourceReintegrationId?: string;
  governanceStatus?: SoulActionGovernanceStatus;
  executionStatus?: SoulActionExecutionStatus;
  actionKind?: SoulActionKind;
}): Promise<SoulAction[]> {
  const data = await fetchSoulActionList(filters);
  return data.items;
}

export async function fetchSoulAction(id: string): Promise<SoulAction> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({} as Partial<SoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch soul action');
  }
  return data.soulAction as SoulAction;
}

export async function approveSoulAction(id: string, payload: ReintegrationReviewRequest = {}): Promise<SoulActionResponse['soulAction']> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<SoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to approve soul action');
  }
  return data.soulAction as SoulAction;
}

export async function dispatchSoulAction(id: string): Promise<DispatchSoulActionResponse> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}/dispatch`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({} as Partial<DispatchSoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to dispatch soul action');
  }
  return data as DispatchSoulActionResponse;
}

export async function deferSoulAction(id: string, payload: ReintegrationReviewRequest = {}): Promise<SoulActionResponse['soulAction']> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}/defer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<SoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to defer soul action');
  }
  return data.soulAction as SoulAction;
}

export async function discardSoulAction(id: string, payload: ReintegrationReviewRequest = {}): Promise<SoulActionResponse['soulAction']> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as Partial<SoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to discard soul action');
  }
  return data.soulAction as SoulAction;
}

export async function answerFollowupQuestion(id: string, answer: string): Promise<SoulAction> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });
  const data = await res.json().catch(() => ({} as Partial<SoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to answer followup question');
  }
  return data.soulAction as SoulAction;
}

export async function fetchBrainstormSessions(limit = 50, offset = 0): Promise<{ sessions: BrainstormSession[]; total: number }> {
  const res = await fetch(`${API_BASE}/brainstorm-sessions?limit=${limit}&offset=${offset}`);
  const data = await res.json().catch(() => ({ sessions: [], total: 0 }));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch brainstorm sessions');
  return data as { sessions: BrainstormSession[]; total: number };
}

export async function fetchBrainstormSession(id: string): Promise<BrainstormSession> {
  const res = await fetch(`${API_BASE}/brainstorm-sessions/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({} as { session?: BrainstormSession; error?: string }));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch brainstorm session');
  return data.session as BrainstormSession;
}

export async function fetchWorkerTask(id: string): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({} as Partial<WorkerTaskResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch worker task');
  }
  return data.task as WorkerTask;
}

export async function retryWorkerTask(id: string): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({} as Partial<WorkerTaskResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retry worker task');
  }
  return data.task as WorkerTask;
}

export async function cancelWorkerTask(id: string): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({} as Partial<WorkerTaskResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to cancel worker task');
  }
  return data.task as WorkerTask;
}

export async function clearFinishedWorkerTasks(): Promise<number> {
  const res = await fetch(`${API_BASE}/worker-tasks/finished`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({} as Partial<ClearFinishedWorkerTasksResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to clear worker tasks');
  }
  return data.deleted || 0;
}

export async function classifyInbox(): Promise<WorkerTask> {
  return createWorkerTask({
    taskType: 'classify_inbox',
    input: {},
  });
}

export async function extractTasks(noteId: string): Promise<WorkerTask> {
  return createWorkerTask({
    taskType: 'extract_tasks',
    sourceNoteId: noteId,
    input: { noteId },
  });
}

export async function fetchAISuggestions(): Promise<AISuggestion[]> {
  const res = await fetch(`${API_BASE}/ai/suggestions`);
  const data = await res.json().catch(() => ({} as Partial<ListAiSuggestionsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch AI suggestions');
  }
  return data.suggestions || [];
}

export async function fetchEventNodeProjectionList(sourceReintegrationIds?: string[]): Promise<ProjectionListResponse<EventNode>> {
  const normalizedSourceReintegrationIds = normalizeSourceReintegrationIds(sourceReintegrationIds);
  const query = normalizedSourceReintegrationIds.length
    ? `?sourceReintegrationIds=${encodeURIComponent(normalizedSourceReintegrationIds.join(','))}`
    : '';
  const res = await fetch(`${API_BASE}/event-nodes${query}`);
  const data = await res.json().catch(() => ({} as Partial<ListEventNodesResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch event nodes');
  }
  return {
    items: data.eventNodes || [],
    filters: normalizeProjectionFilters(data.filters),
  };
}

export async function fetchEventNodes(sourceReintegrationIds?: string[]): Promise<EventNode[]> {
  const data = await fetchEventNodeProjectionList(sourceReintegrationIds);
  return data.items;
}

export async function fetchContinuityProjectionList(sourceReintegrationIds?: string[]): Promise<ProjectionListResponse<ContinuityRecord>> {
  const normalizedSourceReintegrationIds = normalizeSourceReintegrationIds(sourceReintegrationIds);
  const query = normalizedSourceReintegrationIds.length
    ? `?sourceReintegrationIds=${encodeURIComponent(normalizedSourceReintegrationIds.join(','))}`
    : '';
  const res = await fetch(`${API_BASE}/continuity-records${query}`);
  const data = await res.json().catch(() => ({} as Partial<ListContinuityRecordsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch continuity records');
  }
  return {
    items: data.continuityRecords || [],
    filters: normalizeProjectionFilters(data.filters),
  };
}

export async function fetchContinuityRecords(sourceReintegrationIds?: string[]): Promise<ContinuityRecord[]> {
  const data = await fetchContinuityProjectionList(sourceReintegrationIds);
  return data.items;
}

// Note write-back API
export async function updateNote(id: string, updates: UpdateNoteRequest): Promise<UpdateNoteResponse> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({} as Partial<UpdateNoteResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update note');
  }
  return data as UpdateNoteResponse;
}

export async function appendNote(id: string, text: string): Promise<{ success: true }> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({} as { success?: true; error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to append note');
  }
  return { success: true };
}

export async function deleteNote(id: string): Promise<{ success: true }> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({} as { success?: true; error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete note');
  }
  return { success: true };
}

export async function createNote(data: CreateNoteRequest): Promise<CreateNoteResponse> {
  const res = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({} as Partial<CreateNoteResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(payload.error || 'Failed to create note');
  }
  return payload as CreateNoteResponse;
}

// Stats API
export async function fetchStatsTrend(days = 30): Promise<StatsTrendPoint[]> {
  const res = await fetch(`${API_BASE}/stats/trend?days=${days}`);
  return expectApiSuccess<StatsTrendPoint[]>(res, 'Failed to fetch stats trend');
}

export async function fetchStatsRadar(): Promise<StatsRadarPoint[]> {
  const res = await fetch(`${API_BASE}/stats/radar`);
  return expectApiSuccess<StatsRadarPoint[]>(res, 'Failed to fetch stats radar');
}

export async function fetchStatsMonthly(): Promise<StatsMonthlyPoint[]> {
  const res = await fetch(`${API_BASE}/stats/monthly`);
  return expectApiSuccess<StatsMonthlyPoint[]>(res, 'Failed to fetch stats monthly');
}

export async function fetchStatsTags(): Promise<StatsTagPoint[]> {
  const res = await fetch(`${API_BASE}/stats/tags`);
  return expectApiSuccess<StatsTagPoint[]>(res, 'Failed to fetch stats tags');
}

// Task Schedules API
export async function createTaskSchedule(req: CreateTaskScheduleRequest): Promise<TaskSchedule> {
  const res = await fetch(`${API_BASE}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json().catch(() => ({} as Partial<TaskScheduleResponse> & { error?: string }));
  if (!res.ok) throw new Error(data.error || 'Failed to create schedule');
  return data.schedule as TaskSchedule;
}

export async function fetchTaskSchedules(): Promise<TaskSchedule[]> {
  const res = await fetch(`${API_BASE}/schedules`);
  const data = await res.json().catch(() => ({} as Partial<TaskScheduleListResponse> & { error?: string }));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch schedules');
  return data.schedules || [];
}

export async function updateTaskSchedule(id: string, updates: UpdateTaskScheduleRequest): Promise<TaskSchedule> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({} as Partial<TaskScheduleResponse> & { error?: string }));
  if (!res.ok) throw new Error(data.error || 'Failed to update schedule');
  return data.schedule as TaskSchedule;
}

export async function deleteTaskSchedule(id: string): Promise<DeleteTaskScheduleResponse> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({} as Partial<DeleteTaskScheduleResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete schedule');
  }
  return data as DeleteTaskScheduleResponse;
}

export async function runTaskScheduleNow(id: string): Promise<TaskSchedule> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({} as Partial<TaskScheduleResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to run schedule');
  }
  return data.schedule as TaskSchedule;
}

export async function fetchScheduleHealth(): Promise<ScheduleHealth> {
  const res = await fetch(`${API_BASE}/schedules/health`);
  return expectApiSuccess<ScheduleHealth>(res, 'Failed to fetch schedule health');
}

export interface AiUsageDaily {
  date: string;
  totalTokens: number;
  totalCostInCents: number;
  requestCount: number;
}

export interface AiUsageResponse {
  totalTokens: number;
  totalCostInCents: number;
  totalRequests: number;
  dailyUsage: AiUsageDaily[];
}

export async function fetchAiUsage(days: number = 7): Promise<AiUsageResponse> {
  const res = await fetch(`${API_BASE}/ai-usage?days=${days}`);
  // Temporary mock fallback if C-Group API isn't ready
  if (!res.ok) {
    if (res.status === 404) {
      return {
        totalTokens: 1250000,
        totalCostInCents: 350,
        totalRequests: 84,
        dailyUsage: Array.from({length: days}).map((_, i) => ({
          date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0],
          totalTokens: Math.floor(Math.random() * 200000 + 50000),
          totalCostInCents: Math.floor(Math.random() * 50 + 10),
          requestCount: Math.floor(Math.random() * 15 + 5),
        }))
      };
    }
    throw new Error('Failed to fetch AI usage');
  }
  return res.json();
}

// ── PhysicalAction APIs ────────────────────────────────
import type { PhysicalAction, ListPhysicalActionsResponse, IntegrationStatus, ListIntegrationsResponse } from '@lifeos/shared';

const MOCK_PHYSICAL_ACTIONS: PhysicalAction[] = [
  {
    id: 'pa-mock-1', type: 'calendar_event', status: 'pending',
    sourceSoulActionId: 'sa-001', sourceNoteId: 'note-001',
    title: '下周二 19:00 壁球场预约', description: 'Planner Agent 建议你预约壁球场以保持运动习惯',
    payload: { title: '壁球训练', startTime: '2026-03-31T19:00:00', endTime: '2026-03-31T20:00:00', location: '西城体育中心' },
    approvalPolicy: 'always_ask', autoApproveKey: null,
    executionLog: null, externalId: null, errorMessage: null,
    dryRunPreview: '将在 Google Calendar 创建一条"壁球训练"事件，时间：3月31日 19:00-20:00，地点：西城体育中心。此操作可撤销。',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    approvedAt: null, executedAt: null,
  },
  {
    id: 'pa-mock-2', type: 'send_email', status: 'pending',
    sourceSoulActionId: 'sa-002', sourceNoteId: 'note-003',
    title: '发送周报给团队', description: '根据你的 weekly_report 生成结果，建议发送周报摘要',
    payload: { to: 'team@example.com', subject: 'LifeOS 周报 #12', body: '本周完成了...' },
    approvalPolicy: 'auto_after_first', autoApproveKey: 'send_email:weekly_report',
    executionLog: null, externalId: null, errorMessage: null,
    dryRunPreview: '将向 team@example.com 发送一封主题为"LifeOS 周报 #12"的邮件。首次需要授权，后续同类操作可自动放行。',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    approvedAt: null, executedAt: null,
  }
];

export async function fetchPendingPhysicalActions(): Promise<PhysicalAction[]> {
  const res = await fetch(`${API_BASE}/physical-actions?status=pending`);
  if (!res.ok) {
    if (res.status === 404) return MOCK_PHYSICAL_ACTIONS;
    throw new Error('Failed to fetch physical actions');
  }
  const data: ListPhysicalActionsResponse = await res.json();
  return data.actions;
}

export async function approvePhysicalAction(id: string, autoApproveNext: boolean = false): Promise<PhysicalAction> {
  const res = await fetch(`${API_BASE}/physical-actions/${encodeURIComponent(id)}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoApproveNext }),
  });
  if (!res.ok) {
    if (res.status === 404) {
      const mock = MOCK_PHYSICAL_ACTIONS.find(a => a.id === id);
      if (mock) return { ...mock, status: 'approved', approvedAt: new Date().toISOString() };
    }
    throw new Error('Failed to approve physical action');
  }
  return (await res.json() as { action: PhysicalAction }).action;
}

export async function rejectPhysicalAction(id: string, reason?: string): Promise<PhysicalAction> {
  const res = await fetch(`${API_BASE}/physical-actions/${encodeURIComponent(id)}/reject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    if (res.status === 404) {
      const mock = MOCK_PHYSICAL_ACTIONS.find(a => a.id === id);
      if (mock) return { ...mock, status: 'rejected' };
    }
    throw new Error('Failed to reject physical action');
  }
  return (await res.json() as { action: PhysicalAction }).action;
}

// ── Integration APIs ───────────────────────────────────

const MOCK_INTEGRATIONS: IntegrationStatus[] = [
  { provider: 'Google Calendar', connected: false, lastSyncAt: null },
  { provider: 'Email (SMTP)', connected: false, lastSyncAt: null },
  { provider: 'Webhook', connected: true, lastSyncAt: new Date().toISOString() },
];

export async function fetchIntegrations(): Promise<IntegrationStatus[]> {
  const res = await fetch(`${API_BASE}/integrations`);
  if (!res.ok) {
    if (res.status === 404) return MOCK_INTEGRATIONS;
    throw new Error('Failed to fetch integrations');
  }
  const data: ListIntegrationsResponse = await res.json();
  return data.integrations;
}

// ── physicalActionHistory API ──────────────────────────

const MOCK_PHYSICAL_ACTION_HISTORY: PhysicalAction[] = [
  {
    id: 'pa-hist-1', type: 'send_email', status: 'completed',
    sourceSoulActionId: 'sa-h-1', sourceNoteId: 'note-h-1',
    title: '发送立会纪要', description: '向项目组发送上午立会记录',
    payload: { to: 'team@example.com', subject: '3.24 立会纪要', body: '纪要内容...' },
    approvalPolicy: 'auto_approve', autoApproveKey: 'send_email:standup',
    executionLog: 'Successfully sent via SMTP.', externalId: 'msg-1234', errorMessage: null,
    dryRunPreview: null,
    createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 3600000).toISOString(), executedAt: new Date(Date.now() - 3590000).toISOString(),
  },
  {
    id: 'pa-hist-2', type: 'webhook_call', status: 'failed',
    sourceSoulActionId: 'sa-h-2', sourceNoteId: 'note-h-2',
    title: '触发家庭灯光全关', description: '睡眠模式已激活',
    payload: { url: 'http://home-assistant/api', method: 'POST' },
    approvalPolicy: 'always_ask', autoApproveKey: null,
    executionLog: 'Connection timeout after 5000ms', externalId: null, errorMessage: 'Timeout',
    dryRunPreview: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString(),
    approvedAt: new Date(Date.now() - 7200000).toISOString(), executedAt: new Date(Date.now() - 7190000).toISOString(),
  },
  {
    id: 'pa-hist-3', type: 'calendar_event', status: 'completed',
    sourceSoulActionId: 'sa-h-3', sourceNoteId: 'note-h-3',
    title: '预定健身房', description: '周二晚上力量训练',
    payload: { title: '力量训练', startTime: '2026-03-24T19:00:00', endTime: '2026-03-24T20:00:00' },
    approvalPolicy: 'auto_after_first', autoApproveKey: 'calendar_event:workout',
    executionLog: 'Event created id: 987654321', externalId: '987654321', errorMessage: null,
    dryRunPreview: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 86400000).toISOString(), executedAt: new Date(Date.now() - 86390000).toISOString(),
  }
];

export async function fetchPhysicalActionHistory(): Promise<PhysicalAction[]> {
  const res = await fetch(`${API_BASE}/physical-actions/history`);
  if (!res.ok) {
    if (res.status === 404) return MOCK_PHYSICAL_ACTION_HISTORY;
    throw new Error('Failed to fetch physical action history');
  }
  const data: ListPhysicalActionsResponse = await res.json();
  return data.actions;
}
