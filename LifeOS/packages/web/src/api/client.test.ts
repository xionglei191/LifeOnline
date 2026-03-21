import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContinuityRecord, EventNode, CreateNoteRequest, CreateNoteResponse, UpdateNoteResponse, SearchResult, Config, UpdateConfigResponse, IndexStatus, IndexErrorEventData, ScheduleHealth, StatsTrendPoint, StatsRadarPoint, StatsMonthlyPoint, StatsTagPoint, TaskSchedule, WorkerTask, PromptRecord, AiProviderSettings, TestAiProviderConnectionResponse, ReintegrationRecord, AcceptReintegrationRecordResponse, RejectReintegrationRecordResponse, SoulAction } from '@lifeos/shared';
import { fetchContinuityRecords, fetchEventNodes, fetchSoulActions, createNote, updateNote, searchNotes, fetchConfig, updateConfig, fetchIndexStatus, fetchIndexErrors, fetchScheduleHealth, fetchStatsTrend, fetchStatsRadar, fetchStatsMonthly, fetchStatsTags, createTaskSchedule, fetchTaskSchedules, updateTaskSchedule, deleteTaskSchedule, runTaskScheduleNow, createWorkerTask, fetchWorkerTasks, fetchWorkerTask, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks, fetchAiPrompts, updateAiPrompt, resetAiPrompt, fetchAiProviderSettings, updateAiProviderSettings, testAiProviderConnection, fetchReintegrationRecords, acceptReintegrationRecord, rejectReintegrationRecord, planReintegrationPromotions } from './client';

describe('api client promotion projections', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches typed event-node projections from the shared response shape', async () => {
    const eventNodes: EventNode[] = [
      {
        id: 'event:reint:test',
        sourceReintegrationId: 'reint:test',
        sourceNoteId: null,
        sourceSoulActionId: null,
        promotionSoulActionId: 'soul-action-event',
        eventKind: 'weekly_reflection',
        title: '周回顾事件',
        summary: 'weekly reflection summary',
        threshold: 'high',
        status: 'active',
        evidence: { source: 'client-test' },
        explanation: { reason: 'projection' },
        occurredAt: '2026-03-22T10:00:00.000Z',
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:00:00.000Z',
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ eventNodes }),
    }));

    await expect(fetchEventNodes()).resolves.toEqual(eventNodes);
    expect(fetch).toHaveBeenCalledWith('/api/event-nodes');
  });

  it('fetches typed continuity projections from the shared response shape', async () => {
    const continuityRecords: ContinuityRecord[] = [
      {
        id: 'continuity:reint:test',
        sourceReintegrationId: 'reint:test',
        sourceNoteId: null,
        sourceSoulActionId: null,
        promotionSoulActionId: 'soul-action-continuity',
        continuityKind: 'daily_rhythm',
        target: 'derived_outputs',
        strength: 'medium',
        summary: 'daily rhythm continuity summary',
        continuity: { trend: 'stable' },
        evidence: { source: 'client-test' },
        explanation: { reason: 'projection' },
        recordedAt: '2026-03-22T10:05:00.000Z',
        createdAt: '2026-03-22T10:05:00.000Z',
        updatedAt: '2026-03-22T10:05:00.000Z',
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ continuityRecords }),
    }));

    await expect(fetchContinuityRecords()).resolves.toEqual(continuityRecords);
    expect(fetch).toHaveBeenCalledWith('/api/continuity-records');
  });

  it('normalizes legacy reintegration note filters to sourceReintegrationId for soul-action fetches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ soulActions: [] }),
    }));

    await expect(fetchSoulActions({ sourceNoteId: 'reint:test-legacy-filter' })).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith('/api/soul-actions?sourceReintegrationId=reint%3Atest-legacy-filter');
  });

  it('fetches typed reintegration contracts from shared response shapes', async () => {
    const reintegrationRecord: ReintegrationRecord = {
      id: 'reint:worker-task-1',
      workerTaskId: 'worker-task-1',
      sourceNoteId: 'note-1',
      soulActionId: 'soul-action-1',
      taskType: 'daily_report',
      terminalStatus: 'succeeded',
      signalKind: 'daily_report_reintegration',
      reviewStatus: 'pending_review',
      target: 'derived_outputs',
      strength: 'medium',
      summary: 'Daily report reintegration summary',
      evidence: { source: 'client-test' },
      reviewReason: null,
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      reviewedAt: null,
    };
    const plannedSoulAction: SoulAction = {
      id: 'soul:promote_event_node:reint:worker-task-1',
      sourceNoteId: 'note-1',
      sourceReintegrationId: reintegrationRecord.id,
      actionKind: 'promote_event_node',
      governanceStatus: 'pending_review',
      executionStatus: 'not_dispatched',
      governanceReason: 'promotion planned',
      workerTaskId: null,
      payload: { source: 'client-test' },
      createdAt: '2026-03-22T10:05:00.000Z',
      updatedAt: '2026-03-22T10:05:00.000Z',
      approvedAt: null,
      startedAt: null,
      finishedAt: null,
      error: null,
      resultSummary: null,
    };
    const accepted: AcceptReintegrationRecordResponse = {
      reintegrationRecord: { ...reintegrationRecord, reviewStatus: 'accepted', reviewReason: 'looks good', reviewedAt: '2026-03-22T10:06:00.000Z' },
      soulActions: [plannedSoulAction],
    };
    const rejected: RejectReintegrationRecordResponse = {
      reintegrationRecord: { ...reintegrationRecord, reviewStatus: 'rejected', reviewReason: 'not useful', reviewedAt: '2026-03-22T10:07:00.000Z' },
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reintegrationRecords: [reintegrationRecord] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => accepted })
      .mockResolvedValueOnce({ ok: true, json: async () => rejected })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulActions: [plannedSoulAction] }) }));

    await expect(fetchReintegrationRecords('pending_review')).resolves.toEqual([reintegrationRecord]);
    await expect(acceptReintegrationRecord('reint:worker-task-1', { reason: 'looks good' })).resolves.toEqual(accepted);
    await expect(rejectReintegrationRecord('reint:worker-task-1', { reason: 'not useful' })).resolves.toEqual(rejected);
    await expect(planReintegrationPromotions('reint:worker-task-1')).resolves.toEqual([plannedSoulAction]);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/reintegration-records?reviewStatus=pending_review');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/reintegration-records/reint%3Aworker-task-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'looks good' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/reintegration-records/reint%3Aworker-task-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'not useful' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/reintegration-records/reint%3Aworker-task-1/plan-promotions', {
      method: 'POST',
    });
  });

  it('surfaces API errors for reintegration contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'reintegration list failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'reintegration accept failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'reintegration reject failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'reintegration plan failed' }) }));

    await expect(fetchReintegrationRecords()).rejects.toThrow('reintegration list failed');
    await expect(acceptReintegrationRecord('reint:worker-task-1')).rejects.toThrow('reintegration accept failed');
    await expect(rejectReintegrationRecord('reint:worker-task-1')).rejects.toThrow('reintegration reject failed');
    await expect(planReintegrationPromotions('reint:worker-task-1')).rejects.toThrow('reintegration plan failed');
  });

  it('fetches typed AI provider contracts from shared response shapes', async () => {
    const settings: AiProviderSettings = {
      baseUrl: 'https://api.example.test/v1/messages',
      model: 'claude-sonnet-4-6',
      enabled: true,
      updatedAt: '2026-03-22T10:00:00.000Z',
      hasApiKey: true,
      apiKeyMasked: 'sk-***abcd',
      apiKeySource: 'database',
    };
    const connection: TestAiProviderConnectionResponse = {
      success: true,
      message: 'ok',
      resolvedBaseUrl: settings.baseUrl,
      resolvedModel: settings.model,
      latencyMs: 123,
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => settings })
      .mockResolvedValueOnce({ ok: true, json: async () => settings })
      .mockResolvedValueOnce({ ok: true, json: async () => connection }));

    await expect(fetchAiProviderSettings()).resolves.toEqual(settings);
    await expect(updateAiProviderSettings({ model: 'claude-sonnet-4-6' })).resolves.toEqual(settings);
    await expect(testAiProviderConnection({ model: 'claude-sonnet-4-6' })).resolves.toEqual(connection);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai/provider');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/ai/provider', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/ai/provider/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6' }),
    });
  });

  it('surfaces API errors for AI provider contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'provider fetch failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'provider update failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'provider test failed' }) }));

    await expect(fetchAiProviderSettings()).rejects.toThrow('provider fetch failed');
    await expect(updateAiProviderSettings({ model: 'claude-sonnet-4-6' })).rejects.toThrow('provider update failed');
    await expect(testAiProviderConnection({ model: 'claude-sonnet-4-6' })).rejects.toThrow('provider test failed');
  });

  it('fetches typed AI prompt contracts from shared response shapes', async () => {
    const prompt: PromptRecord = {
      key: 'classify',
      label: 'Classify',
      description: 'Classify inbox notes',
      requiredPlaceholders: ['{{content}}'],
      defaultContent: 'default prompt',
      overrideContent: 'override prompt',
      effectiveContent: 'override prompt',
      enabled: true,
      updatedAt: '2026-03-22T10:00:00.000Z',
      notes: 'test note',
      isOverridden: true,
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ prompts: [prompt] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ prompt }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }));

    await expect(fetchAiPrompts()).resolves.toEqual([prompt]);
    await expect(updateAiPrompt('classify', { content: 'override prompt', enabled: true, notes: 'test note' })).resolves.toEqual(prompt);
    await expect(resetAiPrompt('classify')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai/prompts');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/ai/prompts/classify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'override prompt', enabled: true, notes: 'test note' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/ai/prompts/classify', {
      method: 'DELETE',
    });
  });

  it('surfaces API errors for AI prompt contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'prompt list failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'prompt update failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'prompt reset failed' }) }));

    await expect(fetchAiPrompts()).rejects.toThrow('prompt list failed');
    await expect(updateAiPrompt('classify', { content: 'override prompt' })).rejects.toThrow('prompt update failed');
    await expect(resetAiPrompt('classify')).rejects.toThrow('prompt reset failed');
  });

  it('fetches typed worker-task contracts from shared response shapes', async () => {
    const task: WorkerTask = {
      id: 'worker-task-1',
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
      status: 'pending',
      worker: 'openclaw',
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      sourceNoteId: null,
      scheduleId: null,
      outputNotePaths: [],
      outputNotes: [],
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ task }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [task] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ task }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ task: { ...task, status: 'running' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ task: { ...task, status: 'cancelled' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, deleted: 2 }) }));

    await expect(createWorkerTask({
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
    })).resolves.toEqual(task);
    await expect(fetchWorkerTasks(10, { taskType: 'openclaw_task' })).resolves.toEqual([task]);
    await expect(fetchWorkerTask('worker-task-1')).resolves.toEqual(task);
    await expect(retryWorkerTask('worker-task-1')).resolves.toEqual({ ...task, status: 'running' });
    await expect(cancelWorkerTask('worker-task-1')).resolves.toEqual({ ...task, status: 'cancelled' });
    await expect(clearFinishedWorkerTasks()).resolves.toEqual(2);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/worker-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'openclaw_task',
        input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
      }),
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/worker-tasks?limit=10&taskType=openclaw_task');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/worker-tasks/worker-task-1');
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/worker-tasks/worker-task-1/retry', {
      method: 'POST',
    });
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/worker-tasks/worker-task-1/cancel', {
      method: 'POST',
    });
    expect(fetch).toHaveBeenNthCalledWith(6, '/api/worker-tasks/finished', {
      method: 'DELETE',
    });
  });

  it('surfaces API errors for worker-task contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'create failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'list failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'fetch failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'retry failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'cancel failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'clear failed' }) }));

    await expect(createWorkerTask({
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
    })).rejects.toThrow('create failed');
    await expect(fetchWorkerTasks()).rejects.toThrow('list failed');
    await expect(fetchWorkerTask('worker-task-1')).rejects.toThrow('fetch failed');
    await expect(retryWorkerTask('worker-task-1')).rejects.toThrow('retry failed');
    await expect(cancelWorkerTask('worker-task-1')).rejects.toThrow('cancel failed');
    await expect(clearFinishedWorkerTasks()).rejects.toThrow('clear failed');
  });

  it('fetches typed config and index contracts from shared response shapes', async () => {
    const config: Config = {
      vaultPath: '/vault',
      port: 3000,
    };
    const indexStatus: IndexStatus = {
      queueSize: 1,
      processing: true,
      processingFile: '/vault/inbox.md',
    };
    const indexErrors: IndexErrorEventData[] = [
      {
        filePath: '/vault/bad.md',
        operation: 'upsert',
        error: 'parse failed',
        timestamp: '2026-03-22T10:00:00.000Z',
      },
    ];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => config,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => indexStatus,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => indexErrors,
      }));

    await expect(fetchConfig()).resolves.toEqual(config);
    await expect(fetchIndexStatus()).resolves.toEqual(indexStatus);
    await expect(fetchIndexErrors()).resolves.toEqual(indexErrors);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/config');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/index/status');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/index/errors');
  });

  it('sends typed config updates and returns the shared response shape', async () => {
    const response: UpdateConfigResponse = {
      success: true,
      indexResult: {
        total: 2,
        indexed: 2,
        skipped: 0,
        deleted: 0,
        errors: [],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }));

    await expect(updateConfig('/vault')).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath: '/vault' }),
    });
  });

  it('fetches typed schedule contracts from shared response shapes', async () => {
    const schedule: TaskSchedule = {
      id: 'schedule-1',
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
      cronExpression: '0 9 * * *',
      enabled: true,
      label: 'Daily reflection',
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      lastRunAt: null,
      lastTaskId: null,
      consecutiveFailures: 0,
      lastError: null,
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schedule }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schedules: [schedule] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schedule: { ...schedule, label: 'Updated reflection' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schedule }) }));

    await expect(createTaskSchedule({
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
      cronExpression: '0 9 * * *',
      label: 'Daily reflection',
    })).resolves.toEqual(schedule);
    await expect(fetchTaskSchedules()).resolves.toEqual([schedule]);
    await expect(updateTaskSchedule('schedule-1', { label: 'Updated reflection' })).resolves.toEqual({ ...schedule, label: 'Updated reflection' });
    await expect(deleteTaskSchedule('schedule-1')).resolves.toBeUndefined();
    await expect(runTaskScheduleNow('schedule-1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'openclaw_task',
        input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
        cronExpression: '0 9 * * *',
        label: 'Daily reflection',
      }),
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/schedules');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/schedules/schedule-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Updated reflection' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/schedules/schedule-1', {
      method: 'DELETE',
    });
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/schedules/schedule-1/run', {
      method: 'POST',
    });
  });

  it('surfaces API errors for schedule contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'create failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'list failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'update failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'delete failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'run failed' }) }));

    await expect(createTaskSchedule({
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
      cronExpression: '0 9 * * *',
      label: 'Daily reflection',
    })).rejects.toThrow('create failed');
    await expect(fetchTaskSchedules()).rejects.toThrow('list failed');
    await expect(updateTaskSchedule('schedule-1', { label: 'Updated reflection' })).rejects.toThrow('update failed');
    await expect(deleteTaskSchedule('schedule-1')).rejects.toThrow('delete failed');
    await expect(runTaskScheduleNow('schedule-1')).rejects.toThrow('run failed');
  });

  it('fetches typed schedule health from the shared response shape', async () => {
    const response: ScheduleHealth = {
      total: 3,
      active: 2,
      failing: 1,
      failingSchedules: [
        {
          id: 'schedule-1',
          label: 'Daily report',
          consecutiveFailures: 2,
          lastError: 'boom',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }));

    await expect(fetchScheduleHealth()).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith('/api/schedules/health');
  });

  it('fetches typed stats contracts from shared response shapes', async () => {
    const trend: StatsTrendPoint[] = [{ day: '2026-03-22', total: 3, done: 1 }];
    const radar: StatsRadarPoint[] = [{ dimension: 'growth', rate: 50, total: 2, done: 1 }];
    const monthly: StatsMonthlyPoint[] = [{ month: '2026-03', total: 12, done: 7 }];
    const tags: StatsTagPoint[] = [{ tag: 'contract', count: 4 }];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => trend })
      .mockResolvedValueOnce({ ok: true, json: async () => radar })
      .mockResolvedValueOnce({ ok: true, json: async () => monthly })
      .mockResolvedValueOnce({ ok: true, json: async () => tags }));

    await expect(fetchStatsTrend()).resolves.toEqual(trend);
    await expect(fetchStatsRadar()).resolves.toEqual(radar);
    await expect(fetchStatsMonthly()).resolves.toEqual(monthly);
    await expect(fetchStatsTags()).resolves.toEqual(tags);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/stats/trend?days=30');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/stats/radar');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/stats/monthly');
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/stats/tags');
  });

  it('sends typed search requests and returns the shared response shape', async () => {
    const response: SearchResult = {
      notes: [],
      total: 0,
      query: 'growth',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }));

    await expect(searchNotes('growth')).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith('/api/search?q=growth');
  });

  it('surfaces API errors for promotion projection fetches', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'event nodes unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'continuity records unavailable' }),
      }));

    await expect(fetchEventNodes()).rejects.toThrow('event nodes unavailable');
    await expect(fetchContinuityRecords()).rejects.toThrow('continuity records unavailable');
  });
});
