import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContinuityRecord, EventNode, CreateNoteRequest, CreateNoteResponse, UpdateNoteResponse, SearchResult, Config, UpdateConfigResponse, IndexStatus, IndexErrorEventData } from '@lifeos/shared';
import { fetchContinuityRecords, fetchEventNodes, fetchSoulActions, createNote, updateNote, searchNotes, fetchConfig, updateConfig, fetchIndexStatus, fetchIndexErrors } from './client';

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

  it('sends typed create-note requests and returns the shared response shape', async () => {
    const request: CreateNoteRequest = {
      title: 'Contract note',
      dimension: 'learning',
      type: 'note',
      content: 'hello',
      priority: 'medium',
      tags: ['contract'],
    };
    const response: CreateNoteResponse = { success: true, filePath: '/vault/learning/2026-03-22-contract-note.md' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }));

    await expect(createNote(request)).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
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
