import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DimensionStats from './DimensionStats.vue';

describe('DimensionStats', () => {
  it('labels the hero ring as completion rate and exposes the same fact in the summary', () => {
    const wrapper = mount(DimensionStats, {
      props: {
        dimension: 'growth',
        total: 5,
        pending: 2,
        inProgress: 1,
        done: 2,
      },
    });

    expect(wrapper.text()).toContain('成长');
    expect(wrapper.text()).toContain('完成率 40%');
    expect(wrapper.text()).toContain('40%');
    expect(wrapper.text()).toContain('完成率');
    expect(wrapper.text()).toContain('2 条已闭环');
    expect(wrapper.text()).toContain('3 条仍在占用注意力');
    expect(wrapper.text()).not.toContain('health');
  });
});
