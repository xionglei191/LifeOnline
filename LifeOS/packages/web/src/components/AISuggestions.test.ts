import { describe, expect, it, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { AISuggestion } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchAISuggestions: vi.fn(),
}));

const websocketMocks = vi.hoisted(() => ({
  isIndexRefreshEvent: vi.fn(() => false),
}));

vi.mock('../api/client', () => ({
  fetchAISuggestions: apiMocks.fetchAISuggestions,
}));

vi.mock('../composables/useWebSocket', () => websocketMocks);

import AISuggestions from './AISuggestions.vue';

function createSuggestion(overrides: Partial<AISuggestion> = {}): AISuggestion {
  return {
    id: overrides.id ?? 'suggestion-1',
    type: overrides.type ?? 'overload',
    title: overrides.title ?? '事业负载偏高',
    content: overrides.content ?? '先收敛到一个最重要推进项。',
    dimension: overrides.dimension ?? 'career',
    createdAt: overrides.createdAt ?? '2026-03-21T10:00:00.000Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function triggerRefreshWhileLoading(wrapper: ReturnType<typeof mount>) {
  wrapper.get('.refresh-btn').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();
}

describe('AISuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    websocketMocks.isIndexRefreshEvent.mockReset();
    websocketMocks.isIndexRefreshEvent.mockReturnValue(false);
    apiMocks.fetchAISuggestions.mockResolvedValue([]);
  });

  it('reloads AI suggestions when note-created websocket events arrive', async () => {
    apiMocks.fetchAISuggestions
      .mockResolvedValueOnce([createSuggestion({ id: 'suggestion-old', title: '旧洞察' })])
      .mockResolvedValueOnce([createSuggestion({ id: 'suggestion-new', title: '新建笔记后洞察' })]);

    const wrapper = mount(AISuggestions);
    await flushPromises();

    expect(wrapper.text()).toContain('旧洞察');

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-created',
        data: { filePath: '/vault/成长/2026-03-23-note-new.md' },
      },
    }));
    await flushPromises();

    expect(apiMocks.fetchAISuggestions).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('新建笔记后洞察');
    expect(wrapper.text()).not.toContain('旧洞察');

    wrapper.unmount();
  });

  it('refreshes on note-worker and index websocket events', async () => {
    apiMocks.fetchAISuggestions
      .mockResolvedValueOnce([createSuggestion({ id: 'suggestion-old', title: '旧洞察' })])
      .mockResolvedValueOnce([createSuggestion({ id: 'suggestion-worker', title: '任务回流洞察' })])
      .mockResolvedValueOnce([createSuggestion({ id: 'suggestion-index', title: '索引后洞察' })]);

    websocketMocks.isIndexRefreshEvent.mockImplementation((wsEvent) => wsEvent.type === 'index-complete');

    const wrapper = mount(AISuggestions);
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: {
        type: 'note-worker-tasks-updated',
        data: {
          sourceNoteId: 'note-1.md',
          task: {
            id: 'worker-task-1',
            taskType: 'extract_tasks',
            worker: 'lifeos',
            status: 'pending',
            input: {},
            result: null,
            error: null,
            createdAt: '2026-03-23T10:00:00.000Z',
            updatedAt: '2026-03-23T10:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            sourceNoteId: 'note-1.md',
            scheduleId: null,
            outputNotePaths: [],
            outputNotes: [],
            resultSummary: null,
          },
        },
      },
    }));
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ws-update', {
      detail: { type: 'index-complete' },
    }));
    await flushPromises();

    expect(apiMocks.fetchAISuggestions).toHaveBeenCalledTimes(3);
    expect(wrapper.text()).toContain('索引后洞察');

    wrapper.unmount();
  });

  it('renders suggestion timestamps so dashboard insight cards expose recency directly', async () => {
    apiMocks.fetchAISuggestions.mockResolvedValue([
      createSuggestion({
        id: 'suggestion-time',
        title: '最近刚更新的洞察',
        createdAt: '2026-03-23T11:45:00.000Z',
      }),
    ]);

    const wrapper = mount(AISuggestions);
    await flushPromises();

    expect(wrapper.text()).toContain('最近刚更新的洞察');
    expect(wrapper.find('.insight-time').text()).toMatch(/03\/23.*11:45|3\/23.*11:45|03\/23.*19:45|3\/23.*19:45/);
  });

  it('auto-loads suggestions on mount so the dashboard shows insights immediately', async () => {
    apiMocks.fetchAISuggestions.mockResolvedValue([
      createSuggestion({ id: 'suggestion-auto', type: 'goal', title: '开场即有洞察' }),
    ]);

    const wrapper = mount(AISuggestions);
    await flushPromises();

    expect(apiMocks.fetchAISuggestions).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('开场即有洞察');
    expect(wrapper.findAll('.insight-card')).toHaveLength(1);
  });

  it('renders the empty state after auto-loading finds no suggestions', async () => {
    const wrapper = mount(AISuggestions);
    await flushPromises();

    expect(wrapper.text()).toContain('本轮没有识别到明显异常，系统处于平稳区间。');
    expect(wrapper.findAll('.insight-card')).toHaveLength(0);
  });

  it('renders fetched AI suggestions with localized type and dimension labels from the shared helper', async () => {
    apiMocks.fetchAISuggestions.mockResolvedValue([
      createSuggestion(),
      createSuggestion({
        id: 'suggestion-2',
        type: 'goal',
        title: '学习势能正在形成',
        content: '补一条明确下一步动作。',
        dimension: 'learning',
      }),
    ]);

    const wrapper = mount(AISuggestions);
    await flushPromises();
    await wrapper.find('.refresh-btn').trigger('click');
    await flushPromises();

    const text = wrapper.text();
    expect(apiMocks.fetchAISuggestions).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('.insight-card')).toHaveLength(2);
    expect(text).toContain('负载告警');
    expect(text).toContain('目标推进');
    expect(text).toContain('事业');
    expect(text).toContain('学习');
    expect(text).toContain('事业负载偏高');
    expect(text).toContain('学习势能正在形成');
  });

  it('renders the empty fetched state when the API returns no suggestions', async () => {
    apiMocks.fetchAISuggestions.mockResolvedValue([]);

    const wrapper = mount(AISuggestions);
    await flushPromises();
    await wrapper.find('.refresh-btn').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('本轮没有识别到明显异常，系统处于平稳区间。');
    expect(wrapper.findAll('.insight-card')).toHaveLength(0);
  });

  it('renders an error state when refreshing suggestions fails', async () => {
    apiMocks.fetchAISuggestions.mockRejectedValue(new Error('AI 建议获取失败'));

    const wrapper = mount(AISuggestions);
    await flushPromises();
    await wrapper.find('.refresh-btn').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('AI 建议获取失败');
    expect(wrapper.find('.error-state').exists()).toBe(true);
  });

  it('ignores stale refresh responses after a newer refresh succeeds', async () => {
    const initial = deferred<AISuggestion[]>();
    const first = deferred<AISuggestion[]>();
    const second = deferred<AISuggestion[]>();
    apiMocks.fetchAISuggestions
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const wrapper = mount(AISuggestions);
    await nextTick();
    await triggerRefreshWhileLoading(wrapper);
    await triggerRefreshWhileLoading(wrapper);
    await nextTick();

    second.resolve([createSuggestion({ id: 'suggestion-2', title: '最新洞察' })]);
    await second.promise;
    await flushPromises();

    expect(wrapper.text()).toContain('最新洞察');

    first.resolve([createSuggestion({ id: 'suggestion-1', title: '过期洞察' })]);
    await first.promise;
    await flushPromises();

    expect(wrapper.text()).toContain('最新洞察');
    expect(wrapper.text()).not.toContain('过期洞察');

    initial.resolve([]);
    await initial.promise;
  });

  it('ignores stale refresh errors after a newer refresh succeeds', async () => {
    const initial = deferred<AISuggestion[]>();
    const first = deferred<AISuggestion[]>();
    const second = deferred<AISuggestion[]>();
    apiMocks.fetchAISuggestions
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const wrapper = mount(AISuggestions);
    await nextTick();
    await triggerRefreshWhileLoading(wrapper);
    await triggerRefreshWhileLoading(wrapper);
    await nextTick();

    second.resolve([createSuggestion({ id: 'suggestion-2', title: '稳定洞察' })]);
    await second.promise;
    await flushPromises();

    first.reject(new Error('stale ai failure'));
    await first.promise.catch(() => undefined);
    await flushPromises();

    expect(wrapper.text()).toContain('稳定洞察');
    expect(wrapper.text()).not.toContain('stale ai failure');
    expect(wrapper.find('.error-state').exists()).toBe(false);

    initial.resolve([]);
    await initial.promise;
  });
});
