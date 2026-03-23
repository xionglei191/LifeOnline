import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from './App.vue';

const wsMocks = vi.hoisted(() => ({
  initWebSocket: vi.fn(),
  useWebSocket: vi.fn(),
  isIndexSettledEvent: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const privacyMocks = vi.hoisted(() => ({
  usePrivacy: vi.fn(),
}));

vi.mock('./composables/useWebSocket', () => ({
  initWebSocket: wsMocks.initWebSocket,
  useWebSocket: wsMocks.useWebSocket,
  isIndexSettledEvent: wsMocks.isIndexSettledEvent,
}));

vi.mock('./composables/useTheme', () => ({
  useTheme: themeMocks.useTheme,
}));

vi.mock('./composables/usePrivacy', () => ({
  usePrivacy: privacyMocks.usePrivacy,
}));

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>dashboard</div>' } },
    { path: '/timeline', component: { template: '<div>timeline</div>' } },
    { path: '/calendar', component: { template: '<div>calendar</div>' } },
    { path: '/stats', component: { template: '<div>stats</div>' } },
    { path: '/settings', component: { template: '<div>settings</div>' } },
  ],
});

describe('App', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('localizes the top-level brand and navigation hints on the main shell', async () => {
    wsMocks.initWebSocket.mockReset();
    wsMocks.useWebSocket.mockReturnValue({ isConnected: true });
    wsMocks.isIndexSettledEvent.mockReturnValue(false);
    themeMocks.useTheme.mockReturnValue({ isDark: false, toggle: vi.fn() });
    privacyMocks.usePrivacy.mockReturnValue({
      privacyMode: false,
      isLocked: false,
      togglePrivacyMode: vi.fn(),
      initPrivacy: vi.fn(),
      destroyPrivacy: vi.fn(),
    });

    router.push('/');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          SearchBar: true,
          CreateNoteFab: true,
          LockScreen: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('个人任务中枢');
    expect(wrapper.text()).toContain('今日聚焦');
    expect(wrapper.text()).toContain('轨迹回看');
    expect(wrapper.text()).toContain('月历视图');
    expect(wrapper.text()).toContain('信号分析');
    expect(wrapper.text()).toContain('系统配置');
    expect(wrapper.text()).not.toContain('Personal Mission Control');
    expect(wrapper.text()).not.toContain('Today');
    expect(wrapper.text()).not.toContain('Tracks');
    expect(wrapper.text()).not.toContain('Calendar');
    expect(wrapper.text()).not.toContain('Signals');
    expect(wrapper.text()).not.toContain('Config');

    wrapper.unmount();
  });
});
