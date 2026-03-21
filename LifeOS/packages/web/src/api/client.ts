import type { DashboardData, Note, TimelineData, CalendarData, WorkerTask, CreateWorkerTaskRequest, WorkerTaskListFilters, TaskSchedule, CreateTaskScheduleRequest, UpdateTaskScheduleRequest, PromptRecord, PromptKey, UpdatePromptRequest, AiProviderSettings, UpdateAiProviderSettingsRequest, TestAiProviderConnectionRequest, TestAiProviderConnectionResponse, AISuggestion, ListAiSuggestionsResponse, ReintegrationRecord, ListReintegrationRecordsResponse, ReintegrationReviewRequest, AcceptReintegrationRecordResponse, RejectReintegrationRecordResponse, PlanReintegrationPromotionsResponse, SoulAction, ListSoulActionsResponse, SoulActionResponse, DispatchSoulActionResponse, SoulActionGovernanceStatus, SoulActionExecutionStatus, SoulActionKind, EventNode, ListEventNodesResponse, ContinuityRecord, ListContinuityRecordsResponse, CreateNoteRequest, CreateNoteResponse, UpdateNoteRequest, UpdateNoteResponse, SearchResult, Config, UpdateConfigRequest, UpdateConfigResponse, IndexStatus, IndexErrorEventData, IndexResult } from '@lifeos/shared';

export type IndexError = IndexErrorEventData;

const API_BASE = '/api';

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export async function fetchNotes(filters?: { dimension?: string; status?: string; type?: string }): Promise<Note[]> {
  const params = new URLSearchParams(filters as any);
  const res = await fetch(`${API_BASE}/notes?${params}`);
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
}

export async function triggerIndex(): Promise<IndexResult> {
  const res = await fetch(`${API_BASE}/index`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger index');
  return res.json();
}

export async function fetchIndexStatus(): Promise<IndexStatus> {
  const res = await fetch(`${API_BASE}/index/status`);
  if (!res.ok) throw new Error('Failed to fetch index status');
  return res.json();
}

export async function fetchIndexErrors(): Promise<IndexError[]> {
  const res = await fetch(`${API_BASE}/index/errors`);
  if (!res.ok) throw new Error('Failed to fetch index errors');
  return res.json();
}

export async function fetchTimeline(start: string, end: string): Promise<TimelineData> {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${API_BASE}/timeline?${params}`);
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

export async function fetchCalendar(year: number, month: number): Promise<CalendarData> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const res = await fetch(`${API_BASE}/calendar?${params}`);
  if (!res.ok) throw new Error('Failed to fetch calendar');
  return res.json();
}

export async function fetchNoteById(id: string): Promise<Note> {
  const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to fetch note');
  return res.json();
}

export async function searchNotes(query: string): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/search?${params}`);
  if (!res.ok) throw new Error('Failed to search notes');
  return res.json();
}

export async function fetchConfig(): Promise<Config> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function updateConfig(vaultPath: string): Promise<UpdateConfigResponse> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultPath } satisfies UpdateConfigRequest),
  });
  const data = await res.json().catch(() => ({} as Partial<UpdateConfigResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update config');
  }
  return data as UpdateConfigResponse;
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

export interface WorkerTaskListResponse {
  tasks: WorkerTask[];
}

export async function fetchAiPrompts(): Promise<PromptRecord[]> {
  const res = await fetch(`${API_BASE}/ai/prompts`);
  const data = await res.json().catch(() => ({}));
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update AI prompt');
  }
  return data.prompt;
}

export async function resetAiPrompt(key: PromptKey): Promise<void> {
  const res = await fetch(`${API_BASE}/ai/prompts/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset AI prompt');
  }
}

export async function fetchAiProviderSettings(): Promise<AiProviderSettings> {
  const res = await fetch(`${API_BASE}/ai/provider`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch AI provider settings');
  }
  return data;
}

export async function updateAiProviderSettings(payload: UpdateAiProviderSettingsRequest): Promise<AiProviderSettings> {
  const res = await fetch(`${API_BASE}/ai/provider`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update AI provider settings');
  }
  return data;
}

export async function testAiProviderConnection(payload: TestAiProviderConnectionRequest): Promise<TestAiProviderConnectionResponse> {
  const res = await fetch(`${API_BASE}/ai/provider/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to test AI provider connection');
  }
  return data;
}

export async function createWorkerTask(request: CreateWorkerTaskRequest): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create worker task');
  }
  return data.task;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch worker tasks');
  }
  return data.tasks || [];
}

export async function fetchReintegrationRecords(reviewStatus?: ReintegrationRecord['reviewStatus']): Promise<ReintegrationRecord[]> {
  const params = new URLSearchParams();
  if (reviewStatus) {
    params.set('reviewStatus', reviewStatus);
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
  const normalizedSourceReintegrationId = filters?.sourceReintegrationId
    ?? (filters?.sourceNoteId?.startsWith('reint:') ? filters.sourceNoteId : undefined);
  const normalizedSourceNoteId = normalizedSourceReintegrationId === filters?.sourceNoteId
    ? undefined
    : filters?.sourceNoteId;
  if (normalizedSourceNoteId) params.set('sourceNoteId', normalizedSourceNoteId);
  if (normalizedSourceReintegrationId) params.set('sourceReintegrationId', normalizedSourceReintegrationId);
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch worker task');
  }
  return data.task;
}

export async function retryWorkerTask(id: string): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retry worker task');
  }
  return data.task;
}

export async function cancelWorkerTask(id: string): Promise<WorkerTask> {
  const res = await fetch(`${API_BASE}/worker-tasks/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to cancel worker task');
  }
  return data.task;
}

export async function clearFinishedWorkerTasks(): Promise<number> {
  const res = await fetch(`${API_BASE}/worker-tasks/finished`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to clear worker tasks');
  }
  return data.deleted;
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

export async function fetchEventNodes(): Promise<EventNode[]> {
  const res = await fetch(`${API_BASE}/event-nodes`);
  const data = await res.json().catch(() => ({} as Partial<ListEventNodesResponse> & { error?: string }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch event nodes');
  }
  return data.eventNodes || [];
}

export async function fetchContinuityRecords(): Promise<ContinuityRecord[]> {
  const res = await fetch(`${API_BASE}/continuity-records`);
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
export async function fetchStatsTrend(days = 30): Promise<Array<{ day: string; total: number; done: number }>> {
  const res = await fetch(`${API_BASE}/stats/trend?days=${days}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStatsRadar(): Promise<Array<{ dimension: string; rate: number; total: number; done: number }>> {
  const res = await fetch(`${API_BASE}/stats/radar`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStatsMonthly(): Promise<Array<{ month: string; total: number; done: number }>> {
  const res = await fetch(`${API_BASE}/stats/monthly`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStatsTags(): Promise<Array<{ tag: string; count: number }>> {
  const res = await fetch(`${API_BASE}/stats/tags`);
  if (!res.ok) return [];
  return res.json();
}

// Task Schedules API
export async function createTaskSchedule(req: CreateTaskScheduleRequest): Promise<TaskSchedule> {
  const res = await fetch(`${API_BASE}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to create schedule');
  return data.schedule;
}

export async function fetchTaskSchedules(): Promise<TaskSchedule[]> {
  const res = await fetch(`${API_BASE}/schedules`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch schedules');
  return data.schedules || [];
}

export async function updateTaskSchedule(id: string, updates: UpdateTaskScheduleRequest): Promise<TaskSchedule> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update schedule');
  return data.schedule;
}

export async function deleteTaskSchedule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete schedule');
  }
}

export async function runTaskScheduleNow(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to run schedule');
  }
}

export interface ScheduleHealth {
  total: number;
  active: number;
  failing: number;
  failingSchedules: Array<{ id: string; label: string; consecutiveFailures: number; lastError: string | null }>;
}

export async function fetchScheduleHealth(): Promise<ScheduleHealth> {
  const res = await fetch(`${API_BASE}/schedules/health`);
  if (!res.ok) return { total: 0, active: 0, failing: 0, failingSchedules: [] };
  return res.json();
}
