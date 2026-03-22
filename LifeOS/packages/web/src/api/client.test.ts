import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContinuityRecord, EventNode, CreateNoteRequest, CreateNoteResponse, UpdateNoteResponse, SearchResult, Config, UpdateConfigResponse, IndexStatus, IndexErrorEventData, ScheduleHealth, StatsTrendPoint, StatsRadarPoint, StatsMonthlyPoint, StatsTagPoint, TaskSchedule, WorkerTask, PromptRecord, AiProviderSettings, TestAiProviderConnectionResponse, ReintegrationRecord, AcceptReintegrationRecordResponse, RejectReintegrationRecordResponse, SoulAction, DispatchSoulActionResponse, PersonaSnapshot } from '@lifeos/shared';
import { fetchAISuggestions, fetchContinuityRecords, fetchEventNodes, fetchSoulActions, fetchSoulAction, approveSoulAction, deferSoulAction, discardSoulAction, dispatchSoulAction, createNote, updateNote, searchNotes, fetchConfig, updateConfig, fetchIndexStatus, fetchIndexErrors, fetchScheduleHealth, fetchStatsTrend, fetchStatsRadar, fetchStatsMonthly, fetchStatsTags, createTaskSchedule, fetchTaskSchedules, updateTaskSchedule, deleteTaskSchedule, runTaskScheduleNow, createWorkerTask, fetchWorkerTasks, fetchWorkerTask, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks, fetchAiPrompts, updateAiPrompt, resetAiPrompt, fetchAiProviderSettings, updateAiProviderSettings, testAiProviderConnection, fetchReintegrationRecords, acceptReintegrationRecord, rejectReintegrationRecord, planReintegrationPromotions, fetchPersonaSnapshot, fetchDashboard, fetchNotes, triggerIndex, fetchTimeline, fetchCalendar, fetchNoteById } from './client';

describe('api client promotion projections', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches typed AI suggestion contracts from shared response shapes', async () => {
    const suggestions = [
      {
        id: 'suggestion-1',
        title: 'Review weekly goals',
        summary: 'Compare current weekly focus with recent outputs.',
        reasoning: 'Recent notes mention drift from planned priorities.',
        source: 'fallback',
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions }),
    }));

    await expect(fetchAISuggestions()).resolves.toEqual(suggestions);
    expect(fetch).toHaveBeenCalledWith('/api/ai/suggestions');
  });

  it('surfaces API errors for AI suggestion contracts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'ai suggestions failed' }),
    }));

    await expect(fetchAISuggestions()).rejects.toThrow('ai suggestions failed');
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
      json: async () => ({ eventNodes, filters: { sourceReintegrationIds: ['reint:test'] } }),
    }));

    await expect(fetchEventNodes(['reint:test'])).resolves.toEqual(eventNodes);
    expect(fetch).toHaveBeenCalledWith('/api/event-nodes?sourceReintegrationIds=reint%3Atest');
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
      json: async () => ({ continuityRecords, filters: { sourceReintegrationIds: ['reint:test'] } }),
    }));

    await expect(fetchContinuityRecords(['reint:test'])).resolves.toEqual(continuityRecords);
    expect(fetch).toHaveBeenCalledWith('/api/continuity-records?sourceReintegrationIds=reint%3Atest');
  });

  it('normalizes reintegration ids before projection fetch query serialization', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eventNodes: [], filters: { sourceReintegrationIds: ['reint:test', 'reint:second'] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ continuityRecords: [], filters: { sourceReintegrationIds: ['reint:test', 'reint:second'] } }),
      }));

    await expect(fetchEventNodes([' reint:test ', '', 'reint:test', 'reint:second '])).resolves.toEqual([]);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/event-nodes?sourceReintegrationIds=reint%3Atest%2Creint%3Asecond');

    await expect(fetchContinuityRecords(['', ' reint:test ', 'reint:test', 'reint:second '])).resolves.toEqual([]);
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/continuity-records?sourceReintegrationIds=reint%3Atest%2Creint%3Asecond');
  });

  it('normalizes legacy reintegration note filters to sourceReintegrationId for soul-action fetches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ soulActions: [] }),
    }));

    await expect(fetchSoulActions({ sourceNoteId: 'reint:test-legacy-filter' })).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith('/api/soul-actions?sourceReintegrationId=reint%3Atest-legacy-filter');
  });

  it('fetches typed soul-action contracts from shared response shapes', async () => {
    const soulAction: SoulAction = {
      id: 'soul-action-1',
      sourceNoteId: 'note-1',
      sourceReintegrationId: 'reint:worker-task-1',
      actionKind: 'update_persona_snapshot',
      governanceStatus: 'pending_review',
      executionStatus: 'not_dispatched',
      governanceReason: 'queued for review',
      workerTaskId: null,
      payload: { source: 'client-test' },
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
      approvedAt: null,
      startedAt: null,
      finishedAt: null,
      error: null,
      resultSummary: null,
    };
    const dispatchResponse: DispatchSoulActionResponse = {
      result: {
        dispatched: true,
        reason: 'queued',
        soulActionId: soulAction.id,
        workerTaskId: 'worker-task-1',
      },
      soulAction: { ...soulAction, governanceStatus: 'approved', executionStatus: 'succeeded', workerTaskId: 'worker-task-1' },
      task: {
        id: 'worker-task-1',
        taskType: 'update_persona_snapshot',
        worker: 'claude_code',
        status: 'succeeded',
        input: { profile: 'Long-term thinker' },
        output: { applied: true },
        createdAt: '2026-03-22T10:01:00.000Z',
        updatedAt: '2026-03-22T10:01:00.000Z',
        startedAt: '2026-03-22T10:01:00.000Z',
        finishedAt: '2026-03-22T10:02:00.000Z',
        error: null,
        sourceNoteId: 'note-1',
      },
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulActions: [soulAction], filters: { governanceStatus: 'pending_review' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulAction }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulAction: { ...soulAction, governanceStatus: 'approved' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulAction: { ...soulAction, governanceStatus: 'deferred' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulAction: { ...soulAction, governanceStatus: 'discarded' } }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => dispatchResponse }));

    await expect(fetchSoulActions({ governanceStatus: 'pending_review' })).resolves.toEqual([soulAction]);
    await expect(fetchSoulAction('soul-action-1')).resolves.toEqual(soulAction);
    await expect(approveSoulAction('soul-action-1', { reason: 'approve it' })).resolves.toEqual({ ...soulAction, governanceStatus: 'approved' });
    await expect(deferSoulAction('soul-action-1', { reason: 'wait a bit' })).resolves.toEqual({ ...soulAction, governanceStatus: 'deferred' });
    await expect(discardSoulAction('soul-action-1', { reason: 'drop it' })).resolves.toEqual({ ...soulAction, governanceStatus: 'discarded' });
    await expect(dispatchSoulAction('soul-action-1')).resolves.toEqual(dispatchResponse);
  });

  it('surfaces API errors for soul-action contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'soul action list failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'soul action fetch failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'soul action approve failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'soul action defer failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'soul action discard failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'soul action dispatch failed' }) }));

    await expect(fetchSoulActions()).rejects.toThrow('soul action list failed');
    await expect(fetchSoulAction('soul-action-1')).rejects.toThrow('soul action fetch failed');
    await expect(approveSoulAction('soul-action-1')).rejects.toThrow('soul action approve failed');
    await expect(deferSoulAction('soul-action-1')).rejects.toThrow('soul action defer failed');
    await expect(discardSoulAction('soul-action-1')).rejects.toThrow('soul action discard failed');
    await expect(dispatchSoulAction('soul-action-1')).rejects.toThrow('soul action dispatch failed');
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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reintegrationRecords: [reintegrationRecord], filters: { reviewStatus: 'pending_review' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => accepted })
      .mockResolvedValueOnce({ ok: true, json: async () => rejected })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ soulActions: [plannedSoulAction] }) }));

    await expect(fetchReintegrationRecords({ reviewStatus: 'pending_review' })).resolves.toEqual([reintegrationRecord]);
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

  it('supports reintegration list source-note filters for scoped projection reads', async () => {
    const reintegrationRecord: ReintegrationRecord = {
      id: 'reint:worker-task-note-scope',
      workerTaskId: 'worker-task-note-scope',
      sourceNoteId: 'note-1.md',
      soulActionId: null,
      taskType: 'extract_tasks',
      terminalStatus: 'succeeded',
      signalKind: 'candidate_task',
      reviewStatus: 'accepted',
      target: 'task_record',
      strength: 'medium',
      summary: 'scoped reintegration record',
      evidence: { source: 'client-test' },
      reviewReason: null,
      createdAt: '2026-03-22T10:08:00.000Z',
      updatedAt: '2026-03-22T10:08:00.000Z',
      reviewedAt: null,
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reintegrationRecords: [reintegrationRecord],
        filters: { sourceNoteId: 'note-1.md' },
      }),
    }));

    await expect(fetchReintegrationRecords({ sourceNoteId: 'note-1.md' })).resolves.toEqual([reintegrationRecord]);
    expect(fetch).toHaveBeenCalledWith('/api/reintegration-records?sourceNoteId=note-1.md');
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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [task], filters: { sourceNoteId: 'note-1', status: 'pending', taskType: 'openclaw_task', worker: 'openclaw' } }) })
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

  it('fetches typed persona snapshot contracts from shared response shapes', async () => {
    const snapshot: PersonaSnapshot = {
      id: 'persona:note-1',
      sourceNoteId: 'note-1',
      soulActionId: null,
      workerTaskId: 'worker-task-1',
      summary: '已更新人格快照：Source Note',
      snapshot: {
        sourceNoteTitle: 'Source Note',
        summary: '已更新人格快照：Source Note',
        contentPreview: 'Persona content preview',
        updatedAt: '2026-03-22T10:00:00.000Z',
      },
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ snapshot }),
    }));

    await expect(fetchPersonaSnapshot('note-1')).resolves.toEqual(snapshot);
    expect(fetch).toHaveBeenCalledWith('/api/persona-snapshots/note-1');
  });

  it('surfaces API errors for worker-task contract actions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'create failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'list failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'fetch failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'retry failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'cancel failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'clear failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'snapshot failed' }) }));

    await expect(createWorkerTask({
      taskType: 'openclaw_task',
      input: { instruction: 'Collect daily notes', outputDimension: 'learning' },
    })).rejects.toThrow('create failed');
    await expect(fetchWorkerTasks()).rejects.toThrow('list failed');
    await expect(fetchWorkerTask('worker-task-1')).rejects.toThrow('fetch failed');
    await expect(retryWorkerTask('worker-task-1')).rejects.toThrow('retry failed');
    await expect(cancelWorkerTask('worker-task-1')).rejects.toThrow('cancel failed');
    await expect(clearFinishedWorkerTasks()).rejects.toThrow('clear failed');
    await expect(fetchPersonaSnapshot('note-1')).rejects.toThrow('snapshot failed');
  });

  it('omits undefined note filters from notes query strings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    }));

    await expect(fetchNotes({ dimension: 'growth', status: undefined, type: undefined })).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith('/api/notes?dimension=growth');

    await expect(fetchNotes()).resolves.toEqual([]);
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/notes');
  });

  it('sends typed note write-back contracts from shared response shapes', async () => {
    const createResponse: CreateNoteResponse = {
      success: true,
      filePath: '/vault/growth/new-note.md',
    };
    const updateResponse: UpdateNoteResponse = {
      success: true,
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => createResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => updateResponse }));

    await expect(createNote({ title: 'New note', dimension: 'growth' })).resolves.toEqual(createResponse);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New note', dimension: 'growth' }),
    });

    await expect(updateNote('note-1', { title: 'Updated note' })).resolves.toEqual(updateResponse);
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/notes/note-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated note' }),
    });
  });

  it('surfaces API errors for dashboard, note, index, timeline, calendar, and config fetches', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'dashboard unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'notes unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'index trigger failed' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'timeline unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'calendar unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'note unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'config unavailable' }) }));

    await expect(fetchDashboard()).rejects.toThrow('dashboard unavailable');
    await expect(fetchNotes({ dimension: 'growth' })).rejects.toThrow('notes unavailable');
    await expect(triggerIndex()).rejects.toThrow('index trigger failed');
    await expect(fetchTimeline('2026-03-01', '2026-03-31')).rejects.toThrow('timeline unavailable');
    await expect(fetchCalendar(2026, 3)).rejects.toThrow('calendar unavailable');
    await expect(fetchNoteById('note-1')).rejects.toThrow('note unavailable');
    await expect(fetchConfig()).rejects.toThrow('config unavailable');
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

  it('surfaces API errors for stats and schedule health fetches', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'schedule health unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'trend unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'radar unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'monthly unavailable' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'tags unavailable' }) }));

    await expect(fetchScheduleHealth()).rejects.toThrow('schedule health unavailable');
    await expect(fetchStatsTrend()).rejects.toThrow('trend unavailable');
    await expect(fetchStatsRadar()).rejects.toThrow('radar unavailable');
    await expect(fetchStatsMonthly()).rejects.toThrow('monthly unavailable');
    await expect(fetchStatsTags()).rejects.toThrow('tags unavailable');
  });

  it('sends typed search requests and returns the shared response shape', async () => {
    const response: SearchResult = {
      notes: [],
      total: 0,
      query: 'growth',
      filters: { q: 'growth' },
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
