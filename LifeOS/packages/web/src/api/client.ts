import { normalizeSoulActionSourceFilters, type ApiErrorResponse, type ApiResponse, type DashboardData, type Note, type TimelineData, type CalendarData, type WorkerTask, type CreateWorkerTaskRequest, type WorkerTaskListFilters, type TaskSchedule, type CreateTaskScheduleRequest, type UpdateTaskScheduleRequest, type PromptRecord, type PromptKey, type ListAiPromptsResponse, type AiPromptResponse, type ResetAiPromptResponse, type UpdatePromptRequest, type AiProviderSettings, type UpdateAiProviderSettingsRequest, type TestAiProviderConnectionRequest, type TestAiProviderConnectionResponse, type AISuggestion, type ListAiSuggestionsResponse, type ReintegrationRecord, type ListReintegrationRecordsResponse, type ReintegrationReviewRequest, type AcceptReintegrationRecordResponse, type RejectReintegrationRecordResponse, type PlanReintegrationPromotionsResponse, type SoulAction, type ListSoulActionsResponse, type SoulActionResponse, type DispatchSoulActionResponse, type SoulActionGovernanceStatus, type SoulActionExecutionStatus, type SoulActionKind, type EventNode, type ListEventNodesResponse, type ContinuityRecord, type ListContinuityRecordsResponse, type CreateNoteRequest, type CreateNoteResponse, type UpdateNoteRequest, type UpdateNoteResponse, type SearchResult, type Config, type UpdateConfigRequest, type UpdateConfigResponse, type IndexStatus, type IndexErrorEventData, type IndexResult, type ScheduleHealth, type StatsTrendPoint, type StatsRadarPoint, type StatsMonthlyPoint, type StatsTagPoint, type CreateWorkerTaskResponse, type WorkerTaskListResponse, type WorkerTaskResponse, type ClearFinishedWorkerTasksResponse, type TaskScheduleResponse, type TaskScheduleListResponse, type DeleteTaskScheduleResponse, type PersonaSnapshot, type PersonaSnapshotResponse } from '@lifeos/shared';

export type IndexError = IndexErrorEventData;

const API_BASE = '/api';

type ApiErrorLike = Partial<ApiErrorResponse>;

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
  const params = new URLSearchParams(filters as any);
  const res = await fetch(`${API_BASE}/notes?${params}`);
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

export async function resetAiPrompt(key: PromptKey): Promise<void> {
  const res = await fetch(`${API_BASE}/ai/prompts/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({} as Partial<ResetAiPromptResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset AI prompt');
  }
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

export async function fetchWorkerTasks(
  limit = 10,
  options?: WorkerTaskListFilters
): Promise<WorkerTask[]> {
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
  return data.tasks || [];
}

export async function fetchReintegrationRecords(filters?: {
  reviewStatus?: ReintegrationRecord['reviewStatus'];
  sourceNoteId?: string;
}): Promise<ReintegrationRecord[]> {
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
  return data.reintegrationRecords || [];
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
  return data as AcceptReintegrationRecordResponse;
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

export async function planReintegrationPromotions(id: string): Promise<SoulAction[]> {
  const res = await fetch(`${API_BASE}/reintegration-records/${encodeURIComponent(id)}/plan-promotions`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({} as Partial<PlanReintegrationPromotionsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to plan reintegration promotions');
  }
  return data.soulActions || [];
}

export async function fetchSoulActions(filters?: {
  sourceNoteId?: string;
  sourceReintegrationId?: string;
  governanceStatus?: SoulActionGovernanceStatus;
  executionStatus?: SoulActionExecutionStatus;
  actionKind?: SoulActionKind;
}): Promise<SoulAction[]> {
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
  return data.soulActions || [];
}

export async function fetchSoulAction(id: string): Promise<SoulAction> {
  const res = await fetch(`${API_BASE}/soul-actions/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({} as Partial<SoulActionResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch soul action');
  }
  return data.soulAction as SoulAction;
}

export async function approveSoulAction(id: string, payload: ReintegrationReviewRequest = {}): Promise<SoulAction> {
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

export async function deferSoulAction(id: string, payload: ReintegrationReviewRequest = {}): Promise<SoulAction> {
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

export async function discardSoulAction(id: string, payload: ReintegrationReviewRequest = {}): Promise<SoulAction> {
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

export async function fetchEventNodes(sourceReintegrationIds?: string[]): Promise<EventNode[]> {
  const query = sourceReintegrationIds?.length
    ? `?sourceReintegrationIds=${encodeURIComponent(sourceReintegrationIds.join(','))}`
    : '';
  const res = await fetch(`${API_BASE}/event-nodes${query}`);
  const data = await res.json().catch(() => ({} as Partial<ListEventNodesResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch event nodes');
  }
  return data.eventNodes || [];
}

export async function fetchContinuityRecords(sourceReintegrationIds?: string[]): Promise<ContinuityRecord[]> {
  const query = sourceReintegrationIds?.length
    ? `?sourceReintegrationIds=${encodeURIComponent(sourceReintegrationIds.join(','))}`
    : '';
  const res = await fetch(`${API_BASE}/continuity-records${query}`);
  const data = await res.json().catch(() => ({} as Partial<ListContinuityRecordsResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch continuity records');
  }
  return data.continuityRecords || [];
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

export async function appendNote(id: string, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to append note');
  }
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete note');
  }
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

export async function deleteTaskSchedule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as Partial<DeleteTaskScheduleResponse> & { error?: string }));
    throw new Error(data.error || 'Failed to delete schedule');
  }
}

export async function runTaskScheduleNow(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({} as Partial<TaskScheduleResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to run schedule');
  }
}

export async function fetchScheduleHealth(): Promise<ScheduleHealth> {
  const res = await fetch(`${API_BASE}/schedules/health`);
  return expectApiSuccess<ScheduleHealth>(res, 'Failed to fetch schedule health');
}
