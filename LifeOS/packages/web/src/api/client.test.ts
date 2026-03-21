import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContinuityRecord, EventNode, CreateNoteRequest, CreateNoteResponse, UpdateNoteResponse, SearchResult, Config, UpdateConfigResponse, IndexStatus, IndexErrorEventData, ScheduleHealth, StatsTrendPoint, StatsRadarPoint, StatsMonthlyPoint, StatsTagPoint, TaskSchedule } from '@lifeos/shared';
import { fetchContinuityRecords, fetchEventNodes, fetchSoulActions, createNote, updateNote, searchNotes, fetchConfig, updateConfig, fetchIndexStatus, fetchIndexErrors, fetchScheduleHealth, fetchStatsTrend, fetchStatsRadar, fetchStatsMonthly, fetchStatsTags, createTaskSchedule, fetchTaskSchedules, updateTaskSchedule, deleteTaskSchedule, runTaskScheduleNow } from './client';

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
