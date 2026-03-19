import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import { createSchedule, getSchedule, updateSchedule, runScheduleNow, getScheduleHealth, deleteSchedule, stopScheduler } from '../src/workers/taskScheduler.js';
import { getWorkerTask } from '../src/workers/workerTasks.js';

test('createSchedule stores normalized input and updateSchedule mutates fields', async () => {
  const env = await createTestEnv('lifeos-schedule-create-');
  try {
    initDatabase();
    const schedule = createSchedule({
      taskType: 'openclaw_task',
      input: { instruction: '  do thing  ' },
      cronExpression: '*/5 * * * *',
      label: '  demo  ',
    });

    assert.equal(schedule.label, 'demo');
    assert.deepEqual(schedule.input, { instruction: 'do thing', outputDimension: 'learning' });

    const updated = updateSchedule(schedule.id, {
      label: ' changed ',
      enabled: false,
      input: { instruction: 'next', outputDimension: 'career' } as never,
    });

    assert.equal(updated.label, 'changed');
    assert.equal(updated.enabled, false);
    assert.deepEqual(updated.input, { instruction: 'next', outputDimension: 'career' });
  } finally {
    stopScheduler();
    await env.cleanup();
  }
});

test('runScheduleNow creates worker task and updates bookkeeping', async () => {
  const env = await createTestEnv('lifeos-schedule-run-');
  try {
    initDatabase();
    const schedule = createSchedule({
      taskType: 'extract_tasks',
      input: { noteId: 'missing-note' },
      cronExpression: '*/5 * * * *',
      label: 'run now',
    });

    const updated = runScheduleNow(schedule.id);
    assert.ok(updated.lastRunAt);
    assert.ok(updated.lastTaskId);

    const task = getWorkerTask(updated.lastTaskId!);
    assert.ok(task);
    assert.equal(task?.scheduleId, schedule.id);
  } finally {
    stopScheduler();
    await env.cleanup();
  }
});

test('getScheduleHealth reports enabled failing schedules', async () => {
  const env = await createTestEnv('lifeos-schedule-health-');
  try {
    initDatabase();
    const schedule = createSchedule({
      taskType: 'extract_tasks',
      input: { noteId: 'missing-note' },
      cronExpression: '*/5 * * * *',
      label: 'health-check',
    });

    const db = getDb();
    db.prepare('UPDATE task_schedules SET consecutive_failures = 2, last_error = ? WHERE id = ?').run('boom', schedule.id);

    const health = getScheduleHealth();
    assert.ok(health.total >= 1);
    assert.ok(health.active >= 1);
    assert.ok(health.failing >= 1);
    assert.equal(health.failingSchedules.some((item) => item.id === schedule.id), true);
    assert.equal(health.failingSchedules.find((item) => item.id === schedule.id)?.lastError, 'boom');
  } finally {
    stopScheduler();
    await env.cleanup();
  }
});

test('deleteSchedule removes persisted schedule', async () => {
  const env = await createTestEnv('lifeos-schedule-delete-');
  try {
    initDatabase();
    const schedule = createSchedule({
      taskType: 'classify_inbox',
      input: {},
      cronExpression: '*/5 * * * *',
      label: 'cleanup',
    });

    deleteSchedule(schedule.id);
    assert.equal(getSchedule(schedule.id), null);
  } finally {
    stopScheduler();
    await env.cleanup();
  }
});
