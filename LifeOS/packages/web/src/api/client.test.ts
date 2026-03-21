import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContinuityRecord, EventNode } from '@lifeos/shared';
import { fetchContinuityRecords, fetchEventNodes } from './client';

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
