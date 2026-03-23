import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DimensionStats from './DimensionStats.vue';

describe('DimensionStats', () => {
  it('renders the canonical health score instead of recomputing it from done and total', () => {
    const wrapper = mount(DimensionStats, {
      props: {
        dimension: 'growth',
        total: 5,
        pending: 2,
        inProgress: 1,
        done: 2,
        healthScore: 73,
      },
    });

    expect(wrapper.text()).toContain('成长');
    expect(wrapper.text()).toContain('完成率 73%');
    expect(wrapper.text()).toContain('73%');
    expect(wrapper.text()).toContain('完成率');
    expect(wrapper.text()).toContain('2 条已闭环');
    expect(wrapper.text()).toContain('3 条仍在占用注意力');
    expect(wrapper.text()).not.toContain('40%');
    expect(wrapper.text()).not.toContain('health');
  });
});
