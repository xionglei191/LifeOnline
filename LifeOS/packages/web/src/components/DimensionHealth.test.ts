import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { DimensionStat } from '@lifeos/shared';
import DimensionHealth from './DimensionHealth.vue';

describe('DimensionHealth', () => {
  it('renders dimension labels and colors from the shared helper', () => {
    const stats: DimensionStat[] = [
      { dimension: 'growth', total: 3, pending: 1, in_progress: 1, done: 1, health_score: 76 },
    ];

    const wrapper = mount(DimensionHealth, {
      props: { stats },
      global: {
        mocks: {
          $router: { push: () => {} },
        },
      },
    });

    expect(wrapper.text()).toContain('成长');
    expect(wrapper.find('.card').attributes('style')).toContain('var(--dim-growth)');
  });

  it('renders completion-rate score and done progress on dimension cards', () => {
    const stats: DimensionStat[] = [
      { dimension: 'growth', total: 5, pending: 2, in_progress: 1, done: 2, health_score: 40 },
    ];

    const wrapper = mount(DimensionHealth, {
      props: { stats },
      global: {
        mocks: {
          $router: { push: () => {} },
        },
      },
    });

    expect(wrapper.text()).toContain('完成率');
    expect(wrapper.text()).toContain('40%');
    expect(wrapper.text()).toContain('活跃 3 项 · 完成 2/5');
  });
});
