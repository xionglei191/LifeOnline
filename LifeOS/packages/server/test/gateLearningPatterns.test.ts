import test from 'node:test';
import assert from 'node:assert/strict';
import { detectGatePatterns, adjustConfidenceByHistory } from '../src/soul/gateLearning.js';
import { getDb, initDatabase, closeDb } from '../src/db/client.js';
import { createTestEnv } from './helpers/testEnv.js';

test('detectGatePatterns recognizes consecutive streak patterns', async (t) => {
  const env = await createTestEnv('lifeos-gate-learning-');
  t.after(async () => {
    await env.cleanup();
  });
  
  initDatabase();
  const db = getDb();
  
  // Create 5 consecutive approved decisions for 'promote_event_node'
  const now = new Date();
  for (let i = 0; i < 5; i++) {
    db.prepare(`
      INSERT INTO gate_decisions (action_kind, decision, created_at)
      VALUES (?, ?, ?)
    `).run('promote_event_node', 'approved', new Date(now.getTime() - i * 1000).toISOString());
  }
  
  const patterns = detectGatePatterns('promote_event_node');
  
  const streakPattern = patterns.find(p => p.patternType === 'consecutive_streak');
  assert.ok(streakPattern, 'Should detect consecutive approved streak');
  assert.equal(streakPattern.influence, 0.15);
  assert.match(streakPattern.description, /连续 5 次通过了/);
});

test('adjustConfidenceByHistory incorporates pattern influence into confidence calculation', async (t) => {
  const env = await createTestEnv('lifeos-gate-learning-influence-');
  t.after(async () => {
    await env.cleanup();
  });
  
  initDatabase();
  const db = getDb();
  
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    db.prepare(`
      INSERT INTO gate_decisions (action_kind, decision, created_at)
      VALUES (?, ?, ?)
    `).run('create_event_node', 'discarded', new Date(now.getTime() - i * 1000).toISOString());
  }
  
  // Base confidence 0.8
  const baseConf = 0.8;
  const result = adjustConfidenceByHistory('create_event_node', baseConf);
  
  // Should detect negative consecutive streak and reduce confidence
  assert.ok(result.patterns.length > 0, 'Should return detected patterns');
  assert.ok(result.adjustedConfidence < baseConf, 'Confidence should be reduced due to discarded streak');
  
  const streakPattern = result.patterns.find(p => p.patternType === 'consecutive_streak');
  assert.equal(streakPattern?.influence, -0.15);
  assert.match(streakPattern?.description ?? '', /丢弃了/);
});
