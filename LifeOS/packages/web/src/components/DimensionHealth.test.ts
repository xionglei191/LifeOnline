import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { DimensionStat } from '@lifeos/shared';
import DimensionHealth from './DimensionHealth.vue';

function buildWrapper(stats: DimensionStat[], push = vi.fn()) {
  return {
    push,
    wrapper: mount(DimensionHealth, {
      props: { stats },
      global: {
        mocks: {
          $router: { push },
        },
      },
    }),
  };
}

describe('DimensionHealth', () => {
  it('renders dimension labels and colors from the shared helper', () => {
    const stats: DimensionStat[] = [
      { dimension: 'growth', total: 3, pending: 1, in_progress: 1, done: 1, health_score: 76 },
    ];

    const { wrapper } = buildWrapper(stats);

    expect(wrapper.text()).toContain('成长');
    expect(wrapper.find('.card').attributes('style')).toContain('var(--dim-growth)');
  });

  it('renders completion-rate score and done progress on dimension cards', () => {
    const stats: DimensionStat[] = [
      { dimension: 'growth', total: 5, pending: 2, in_progress: 1, done: 2, health_score: 40 },
    ];

    const { wrapper } = buildWrapper(stats);

    expect(wrapper.text()).toContain('完成率');
    expect(wrapper.text()).toContain('40%');
    expect(wrapper.text()).toContain('活跃 3 项 · 完成 2/5');
  });

  it('labels the matrix header according to whether inbox is present in the canonical stats', () => {
    const inboxStats: DimensionStat[] = [
      { dimension: '_inbox', total: 4, pending: 4, in_progress: 0, done: 0, health_score: 0 },
      { dimension: 'growth', total: 3, pending: 1, in_progress: 1, done: 1, health_score: 33 },
    ];
    const canonicalStats: DimensionStat[] = [
      { dimension: 'growth', total: 3, pending: 1, in_progress: 1, done: 1, health_score: 33 },
    ];

    const { wrapper: inboxWrapper } = buildWrapper(inboxStats);
    const { wrapper: canonicalWrapper } = buildWrapper(canonicalStats);

    expect(inboxWrapper.text()).toContain('生命矩阵与 Inbox 入口');
    expect(inboxWrapper.text()).not.toContain('8 channels');
    expect(inboxWrapper.text()).toContain('2 channels');
    expect(canonicalWrapper.text()).toContain('八维度生命矩阵');
    expect(canonicalWrapper.text()).toContain('1 channels');
  });

  it('routes the canonical _inbox card to the dedicated inbox path', async () => {
    const stats: DimensionStat[] = [
      { dimension: '_inbox', total: 4, pending: 4, in_progress: 0, done: 0, health_score: 0 },
    ];

    const { wrapper, push } = buildWrapper(stats);

    await wrapper.get('.card').trigger('click');

    expect(push).toHaveBeenCalledWith('/inbox');
  });
});
