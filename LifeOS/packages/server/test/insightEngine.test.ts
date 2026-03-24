import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { getFailedPhysicalActions, getTopFailingActionTypes } from '../src/integrations/insightEngine.js';

test('InsightEngine: Error Analytics', async (t) => {
  const env = await createTestEnv('lifeos-insight-');

  try {
    initDatabase();
    const db = getDb();

    // Insert mock physical actions (some successful, some failed)
    db.prepare(`
      INSERT INTO physical_actions (id, type, status, title, payload_json, created_at, updated_at, executed_at, error_message)
      VALUES 
        ('id1', 'calendar_event', 'failed', 'Meeting A', '{}', '2026-03-24T10:00:00Z', '2026-03-24T10:00:00Z', '2026-03-24T10:00:05Z', '403 Forbidden: API Quota Exceeded'),
        ('id2', 'calendar_event', 'completed', 'Meeting B', '{}', '2026-03-24T10:01:00Z', '2026-03-24T10:01:00Z', '2026-03-24T10:01:05Z', NULL),
        ('id3', 'send_email', 'failed', 'Email to Bob', '{}', '2026-03-24T10:02:00Z', '2026-03-24T10:02:00Z', '2026-03-24T10:02:05Z', '401 Unauthorized'),
        ('id4', 'calendar_event', 'failed', 'Meeting C', '{}', '2026-03-24T10:03:00Z', '2026-03-24T10:03:00Z', '2026-03-24T10:03:05Z', '403 Forbidden: Overlapping conflicts')
    `).run();

    // 1. Test getFailedPhysicalActions
    const failedActions = getFailedPhysicalActions(10);
    assert.equal(failedActions.length, 3, 'Should retrieve only the 3 failed actions');
    
    // They should be descending by executed_at (id4 is newest, id1 is oldest)
    assert.equal(failedActions[0].id, 'id4');
    assert.equal(failedActions[0].errorMessage?.includes('Overlapping conflicts'), true);

    // 2. Test getTopFailingActionTypes
    const topFailing = getTopFailingActionTypes();
    assert.equal(topFailing.length, 2, 'Should aggregate 2 failing action types');
    
    const calStats = topFailing.find(s => s.type === 'calendar_event');
    assert.ok(calStats);
    assert.equal(calStats.errorCount, 2, 'calendar_event failed twice');

    const emailStats = topFailing.find(s => s.type === 'send_email');
    assert.ok(emailStats);
    assert.equal(emailStats.errorCount, 1, 'send_email failed once');

  } finally {
    await env.cleanup();
  }
});
