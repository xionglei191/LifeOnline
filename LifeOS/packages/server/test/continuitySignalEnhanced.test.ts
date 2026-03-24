import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNoteContent } from '../src/soul/cognitiveAnalyzer.js';

test('analyzeNoteContent rules fallback extracts goal_trend signal with evidence', async () => {
  const content = '最近思考未来的发展，我觉得要在今年实现核心系统的平滑升级，这个目标不能变。';
  const result = await analyzeNoteContent('note-1', content);
  
  const signals = result.continuitySignals;
  assert.ok(signals.length > 0, 'Should detect continuity signals');
  
  const goalSignal = signals.find(s => s.type === 'goal_trend');
  assert.ok(goalSignal, 'Should detect goal_trend signal');
  assert.equal(goalSignal.strength, 'medium');
  assert.match(goalSignal.evidence!, /实现核心系统的平滑升级，这个目标不能变/);
});

test('analyzeNoteContent rules fallback extracts habit_pattern signal with strong strength', async () => {
  const content = '为了保持好的状态，我发现每天坚持早起，每周固定复盘，形成这种日常习惯非常重要。';
  const result = await analyzeNoteContent('note-2', content);
  
  const signals = result.continuitySignals;
  const habitSignal = signals.find(s => s.type === 'habit_pattern');
  assert.ok(habitSignal, 'Should detect habit_pattern signal');
  // 每天, 每周, 习惯, 坚持, 日常, 固定, 保持 — 命中数量 >= 3，应当为 strong
  assert.equal(habitSignal.strength, 'strong');
  assert.ok(habitSignal.pattern.includes('关键词'));
});

test('analyzeNoteContent rules fallback extracts multiple varying signal types', async () => {
  const content = '这两天状态波动明显，可能失败的风险还是有的，但必须依然坚持下去。';
  const result = await analyzeNoteContent('note-3', content);
  
  const types = result.continuitySignals.map(s => s.type);
  assert.ok(types.includes('emotional_cycle'), 'Should detect emotional_cycle');
  assert.ok(types.includes('risk_signal'), 'Should detect risk_signal');
  assert.ok(types.includes('recurring_theme'), 'Should detect recurring_theme');
});
