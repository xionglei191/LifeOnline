import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import CreateNoteFab from './CreateNoteFab.vue';

vi.mock('../api/client', () => ({
  createNote: vi.fn(),
}));

describe('CreateNoteFab', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders dimensions from the shared selectable dimension contract', async () => {
    const wrapper = mount(CreateNoteFab, {
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: false,
        },
      },
    });

    await wrapper.find('button.fab').trigger('click');
    await nextTick();

    const options = Array.from(document.body.querySelectorAll('select')).at(0)?.querySelectorAll('option');
    const normalized = Array.from(options ?? []).map((option) => ({
      value: option.getAttribute('value') ?? '',
      text: option.textContent ?? '',
    }));

    expect(normalized).toEqual([
      { value: '', text: '选择维度' },
      { value: 'health', text: '健康' },
      { value: 'career', text: '事业' },
      { value: 'finance', text: '财务' },
      { value: 'learning', text: '学习' },
      { value: 'relationship', text: '关系' },
      { value: 'life', text: '生活' },
      { value: 'hobby', text: '兴趣' },
      { value: 'growth', text: '成长' },
    ]);
  });
});
