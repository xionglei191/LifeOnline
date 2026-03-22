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
    result: overrides.result,
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

  it('renders persona snapshot input details instead of generic fallback text', () => {
    const wrapper = mount(WorkerTaskCard, {
      props: {
        task: createTask({
          taskType: 'update_persona_snapshot',
          input: { noteId: 'note-source-123456' },
        }),
      },
    });

    expect(wrapper.text()).toContain('人格源笔记：note-s…3456');
    expect(wrapper.text()).not.toContain('无额外参数');
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

  it('renders projection-relevant result facts for succeeded persona snapshot tasks', () => {
    const wrapper = mount(WorkerTaskCard, {
      props: {
        task: createTask({
          status: 'succeeded',
          taskType: 'update_persona_snapshot',
          resultSummary: '人格快照已更新',
          result: {
            title: '人格快照',
            summary: '生成最新人格快照',
            sourceNoteTitle: '晨间复盘',
            snapshotId: 'snapshot-42',
            snapshot: {
              sourceNoteTitle: '晨间复盘',
              summary: '更稳定的作息与专注模式',
              contentPreview: '最近一周的节律逐渐稳定。',
              updatedAt: '2026-03-23T08:30:00.000Z',
            },
          },
        }),
      },
    });

    const facts = wrapper.findAll('.wtc-result-fact').map((fact) => fact.text());
    expect(facts).toContain('快照 snapshot-42');
    expect(facts).toContain('来源 晨间复盘');
    expect(wrapper.text()).toContain('人格快照已更新');
  });

  it('renders task extraction result facts for succeeded extract tasks', () => {
    const wrapper = mount(WorkerTaskCard, {
      props: {
        task: createTask({
          status: 'succeeded',
          taskType: 'extract_tasks',
          input: { noteId: 'note-1' },
          result: {
            title: '行动项提取',
            summary: '已提取行动项',
            created: 3,
            sourceNoteTitle: '周计划',
            items: [],
          },
        }),
      },
    });

    const facts = wrapper.findAll('.wtc-result-fact').map((fact) => fact.text());
    expect(facts).toContain('创建 3 个行动项');
    expect(facts).toContain('来源 周计划');
  });
});
