import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { WorkerTask } from '@lifeos/shared';
import WorkerTaskCard from './WorkerTaskCard.vue';

function createTask(overrides: Partial<WorkerTask> = {}): WorkerTask {
  return {
    id: overrides.id ?? 'worker-task-1',
    taskType: overrides.taskType ?? 'update_persona_snapshot',
    worker: overrides.worker ?? 'lifeos',
    status: overrides.status ?? 'pending',
    input: overrides.input ?? { noteId: 'note-1' },
    outputNotes: overrides.outputNotes ?? [],
    resultSummary: overrides.resultSummary ?? null,
    error: overrides.error ?? null,
    sourceNoteId: overrides.sourceNoteId ?? '2025-02-01.md',
    createdAt: overrides.createdAt ?? '2026-03-22T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-22T10:00:00.000Z',
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
}

describe('WorkerTaskCard', () => {
  it('renders localized worker and task labels instead of raw enum values', () => {
    const wrapper = mount(WorkerTaskCard, {
      props: {
        task: createTask(),
      },
    });

    const pills = wrapper.findAll('.wtc-pill').map((pill) => pill.text());
    expect(pills).toContain('LifeOS');
    expect(pills).toContain('人格快照更新');
    expect(pills).not.toContain('lifeos');
    expect(pills).not.toContain('update_persona_snapshot');
    expect(wrapper.text()).toContain('人格快照更新');
  });

  it('renders OpenClaw worker label for external worker tasks', () => {
    const wrapper = mount(WorkerTaskCard, {
      props: {
        task: createTask({ worker: 'openclaw', taskType: 'openclaw_task' }),
      },
    });

    const pills = wrapper.findAll('.wtc-pill').map((pill) => pill.text());
    expect(pills).toContain('OpenClaw');
    expect(pills).toContain('OpenClaw 任务');
    expect(pills).not.toContain('openclaw');
  });
});
