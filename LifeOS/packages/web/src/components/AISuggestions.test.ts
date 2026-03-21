import { describe, expect, it, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { AISuggestion } from '@lifeos/shared';

const apiMocks = vi.hoisted(() => ({
  fetchAISuggestions: vi.fn(),
}));

vi.mock('../api/client', () => ({
  fetchAISuggestions: apiMocks.fetchAISuggestions,
}));

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

describe('AISuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAISuggestions.mockResolvedValue([]);
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

  it('renders fetched AI suggestions with localized type and dimension labels', async () => {
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

  it('shows the loading state while waiting for the auto-load API response', async () => {
    let resolveFetch: ((value: AISuggestion[]) => void) | undefined;
    apiMocks.fetchAISuggestions.mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const wrapper = mount(AISuggestions);
    const refreshButton = wrapper.find('.refresh-btn');
    await nextTick();

    expect(wrapper.text()).toContain('AI 正在扫描你的生命节律与任务负载。');
    expect((refreshButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(refreshButton.text()).toContain('分析中');

    resolveFetch?.([createSuggestion({ type: 'reminder', dimension: 'life' })]);
    await flushPromises();

    expect(wrapper.findAll('.insight-card')).toHaveLength(1);
    expect(wrapper.text()).toContain('提醒');
    expect(wrapper.text()).toContain('生活');
  });
});
