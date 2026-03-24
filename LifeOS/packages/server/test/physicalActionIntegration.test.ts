import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { createOrReuseSoulAction } from '../src/soul/soulActions.js';
import { dispatchApprovedSoulAction } from '../src/soul/soulActionDispatcher.js';
import { setApprovalPolicy } from '../src/integrations/approvalGate.js';
import { listPhysicalActions, approveAction, getPhysicalAction } from '../src/integrations/executionEngine.js';
import { upsertCredential } from '../src/integrations/credentialStore.js';

// ── Mock Fetch for Google Calendar API ──────────────────────────────────────
const originalFetch = global.fetch;

test('E2E: PhysicalAction Calendar Integration Sync', async (t) => {
  const env = await createTestEnv('lifeos-p3-e2e-');
  let fetchCallCount = 0;

  try {
    initDatabase();
    const db = getDb();

    // 1. Setup mock credentials and AI config
    upsertCredential('google_calendar', 'mock_access_token', 'mock_refresh_token', new Date(Date.now() + 3600000).toISOString(), 'https://www.googleapis.com/auth/calendar');
    db.prepare(`
      INSERT INTO ai_provider_settings (id, base_url, model, api_key, enabled, updated_at) 
      VALUES ('default', 'http://127.0.0.1:11434/v1', 'mock-model', 'sk-mock-key', 1, CURRENT_TIMESTAMP)
    `).run();

    // 2. Setup mock fetch
    let aiCallCount = 0;
    let googleCallCount = 0;
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.includes('calendar/v1') || url.includes('calendar/v3/calendars/primary/events') && init?.method === 'POST') {
        googleCallCount++;
        return {
          ok: true,
          json: async () => ({ id: `mock_gcal_event_${googleCallCount}` }),
          text: async () => '',
        } as Response;
      }
      
      // Default to AI response for any other URL
      aiCallCount++;
      const content = aiCallCount === 1 
        ? '{"type":"calendar_event","payload":{"title":"牙医预约","startTime":"2026-03-25T14:00:00.000Z","endTime":"2026-03-25T15:00:00.000Z"}}'
        : '{"type":"calendar_event","payload":{"title":"下周组会","startTime":"2026-03-26T10:00:00.000Z","endTime":"2026-03-26T11:00:00.000Z"}}';
      
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content } }],
          content: [{ type: 'text', text: content }]
        }),
        text: async () => '',
      } as Response;
    };

    // =========================================================================
    // SCENARIO 1: always_ask (First time requires approval)
    // =========================================================================
    setApprovalPolicy('calendar_event', 'always_ask');

    // Step 1: Simulate the Planner Agent generating a physical action request
    const sa1 = createOrReuseSoulAction({
      sourceNoteId: 'dummy_note_1',
      actionKind: 'dispatch_physical_action',
      governanceStatus: 'approved',
      governanceReason: '{"type":"calendar_event","title":"牙医预约","payload":{"title":"牙医预约","startTime":"2026-03-25T14:00:00.000Z","endTime":"2026-03-25T15:00:00.000Z"}}'
    });

    // Step 2: Dispatch the SoulAction -> triggers mapSoulActionToPhysicalAction -> ExecutionEngine
    await dispatchApprovedSoulAction(sa1.id);
    
    // Allow macro-tasks to run (since submitPhysicalAction triggers async executeAction)
    await new Promise(r => setTimeout(r, 100));

    // Step 3: Verify it was intercepted and is pending
    let actions = listPhysicalActions();
    assert.equal(actions.length, 1, 'Should have 1 physical action mapped');
    const pa1Id = actions[0].id;
    assert.equal(actions[0].status, 'pending', 'Status should be pending due to always_ask policy');
    assert.equal(actions[0].type, 'calendar_event', 'Type should be calendar_event');

    // Step 4: User Approves the action (Card swipe right in UI)
    approveAction(pa1Id);
    await new Promise(r => setTimeout(r, 100)); // wait for async execution
    
    // Step 5: Verify execution finished and Google API called
    const pa1Post = getPhysicalAction(pa1Id);
    assert.ok(pa1Post, 'Action should exist');
    assert.equal(pa1Post.status, 'completed', 'Action should be marked as completed after Google API call');
    assert.equal(googleCallCount, 1, 'Google API should have been called once');

    // =========================================================================
    // SCENARIO 2: auto_approve (Policy updated by user checking "always allow")
    // =========================================================================
    setApprovalPolicy('calendar_event', 'auto_approve');

    // Step 1: New action mapped by agent
    const sa2 = createOrReuseSoulAction({
      sourceNoteId: 'dummy_note_2',
      actionKind: 'dispatch_physical_action',
      governanceStatus: 'approved',
      governanceReason: '{"type":"calendar_event","title":"下周组会","payload":{"title":"下周组会","startTime":"2026-03-26T10:00:00.000Z","endTime":"2026-03-26T11:00:00.000Z"}}'
    });

    // Step 2: Dispatch it
    await dispatchApprovedSoulAction(sa2.id);
    await new Promise(r => setTimeout(r, 100));

    // Step 3: Verify it bypassed the pending state
    actions = listPhysicalActions();
    assert.equal(actions.length, 2, 'Should have 2 physical actions now');
    
    // Find sa2 mapping
    const pa2 = actions[0];
    assert.ok(pa2, 'Should find the second action');
    assert.equal(pa2.status, 'completed', 'Action should be completed instantly, bypassing pending state');
    assert.equal(googleCallCount, 2, 'Google API should have been called a second time');

    console.log(`\n✅ Phase 3 E2E Integration Sync Complete:`);
    console.log(`   - Scenario 1 (Approval Gate Interception): Passed`);
    console.log(`   - Scenario 2 (Auto-Approve Fast Path): Passed`);
    console.log(`   - Google API Calls simulated: ${googleCallCount}\n`);

  } finally {
    global.fetch = originalFetch;
    await env.cleanup();
  }
});
