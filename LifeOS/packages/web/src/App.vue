<template>
  <div id="app">
    <div class="app-shell">
      <div class="shell-orb shell-orb-left"></div>
      <div class="shell-orb shell-orb-right"></div>

      <header class="topbar">
        <div class="brand-block">
          <div class="brand-mark">
            <span class="brand-slash"></span>
          </div>
          <div class="brand-copy">
            <p class="brand-kicker">个人任务中枢</p>
            <h1>LIFE/OS</h1>
          </div>
        </div>

        <nav class="primary-nav" aria-label="主导航">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
          >
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-hint">{{ item.hint }}</span>
          </router-link>
        </nav>

        <div class="status-panel">
          <div class="system-strip">
            <span class="status-chip" :class="isConnected ? 'status-online' : 'status-offline'">
              <span class="status-dot"></span>
              {{ isConnected ? '在线同步' : '连接断开' }}
            </span>
            <span v-if="indexing" class="status-chip status-indexing">
              <span class="spinner"></span>
              索引刷新中
            </span>
            <span v-else class="status-chip status-ready">
              <span class="status-dot"></span>
              数据稳定
            </span>
          </div>

          <div class="utility-row">
            <button
              class="theme-toggle"
              :class="{ 'privacy-active': privacyMode }"
              @click="togglePrivacyMode"
              :title="privacyMode ? '关闭隐私模式' : '开启隐私模式'"
            >
              <span class="toggle-label">{{ privacyMode ? '🔒 隐私' : '👁 公开' }}</span>
            </button>
            <button class="theme-toggle" @click="toggle" :title="isDark ? '切换亮色' : '切换暗色'">
              <span class="toggle-label">{{ isDark ? 'Light' : 'Dark' }}</span>
            </button>
            <SearchBar />
          </div>
        </div>
      </header>

      <main class="app-main">
        <router-view v-slot="{ Component, route }">
          <Transition name="route-fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </router-view>
      </main>
    </div>

    <CreateNoteFab @created="handleNoteCreated" />
    <LockScreen v-if="isLocked" />

    <nav class="bottom-nav" aria-label="底部导航">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-item"
      >
        <span class="bottom-nav-icon">{{ item.icon }}</span>
        <span class="bottom-nav-label">{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import SearchBar from './components/SearchBar.vue';
import CreateNoteFab from './components/CreateNoteFab.vue';
import LockScreen from './components/LockScreen.vue';
import { initWebSocket, useWebSocket, isIndexSettledEvent } from './composables/useWebSocket';
import { useTheme } from './composables/useTheme';
import { usePrivacy } from './composables/usePrivacy';

const navItems = [
  { to: '/', label: '仪表盘', hint: '今日聚焦', icon: '⊞' },
  { to: '/timeline', label: '时间线', hint: '轨迹回看', icon: '⋯' },
  { to: '/calendar', label: '日历', hint: '月历视图', icon: '▦' },
  { to: '/stats', label: '统计', hint: '信号分析', icon: '◈' },
  { to: '/events', label: '事件', hint: '认知时序', icon: '◎' },
  { to: '/governance', label: '治理', hint: '决策审批', icon: '⚖' },
  { to: '/ops', label: '运维', hint: '任务调度', icon: '⚡' },
  { to: '/settings', label: '设置', hint: '系统配置', icon: '⚙' },
];

const { isConnected } = useWebSocket();
const { isDark, toggle } = useTheme();
const { privacyMode, isLocked, togglePrivacyMode, initPrivacy, destroyPrivacy } = usePrivacy();
const indexing = ref(false);

function handleNoteCreated() {
  // WebSocket will auto-refresh all views via ws-update event
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<import('@lifeos/shared').WsEvent>).detail;
  if (wsEvent.type === 'file-changed') {
    indexing.value = true;
  } else if (isIndexSettledEvent(wsEvent)) {
    indexing.value = false;
  }
}

onMounted(() => {
  initWebSocket();
  initPrivacy();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
  destroyPrivacy();
});
</script>

<style>
:root {
  color-scheme: light;
  --bg: #eef3f8;
  --bg-elevated: rgba(246, 249, 252, 0.92);
  --surface: rgba(255, 255, 255, 0.78);
  --surface-strong: rgba(255, 255, 255, 0.95);
  --surface-muted: rgba(231, 238, 245, 0.72);
  --text: #16202b;
  --text-secondary: #475569;
  --text-muted: #6e7f92;
  --border: rgba(123, 145, 170, 0.2);
  --border-strong: rgba(60, 84, 114, 0.34);
  --shadow: rgba(19, 34, 53, 0.12);
  --shadow-strong: rgba(16, 30, 49, 0.22);
  --accent: #0f766e;
  --accent-strong: #155e75;
  --accent-soft: rgba(15, 118, 110, 0.1);
  --signal: #1d4ed8;
  --signal-soft: rgba(29, 78, 216, 0.12);
  --ok: #15803d;
  --warn: #b45309;
  --danger: #b91c1c;
  --dim-health: #1f7a4f;
  --dim-career: #1d4ed8;
  --dim-finance: #a16207;
  --dim-learning: #7c3aed;
  --dim-relationship: #c2410c;
  --dim-life: #0f766e;
  --dim-hobby: #b45309;
  --dim-growth: #047857;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #08111c;
  --bg-elevated: rgba(8, 17, 28, 0.9);
  --surface: rgba(11, 21, 34, 0.78);
  --surface-strong: rgba(12, 24, 38, 0.94);
  --surface-muted: rgba(19, 34, 54, 0.78);
  --text: #e2edf8;
  --text-secondary: #99abc1;
  --text-muted: #72839a;
  --border: rgba(117, 145, 176, 0.18);
  --border-strong: rgba(133, 166, 201, 0.28);
  --shadow: rgba(0, 0, 0, 0.22);
  --shadow-strong: rgba(0, 0, 0, 0.45);
  --accent: #5eead4;
  --accent-strong: #2dd4bf;
  --accent-soft: rgba(45, 212, 191, 0.12);
  --signal: #60a5fa;
  --signal-soft: rgba(96, 165, 250, 0.14);
  --ok: #4ade80;
  --warn: #f59e0b;
  --danger: #f87171;
  --dim-health: #4ade80;
  --dim-career: #60a5fa;
  --dim-finance: #fbbf24;
  --dim-learning: #c084fc;
  --dim-relationship: #fb923c;
  --dim-life: #2dd4bf;
  --dim-hobby: #f59e0b;
  --dim-growth: #34d399;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: "Avenir Next", "Segoe UI Variable", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 28%),
    radial-gradient(circle at 85% 12%, rgba(15, 118, 110, 0.14), transparent 22%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg) 85%, white 15%), var(--bg));
  color: var(--text);
  transition: background 0.25s ease, color 0.25s ease;
}

button,
input,
select,
textarea {
  font: inherit;
}

a {
  color: inherit;
}

#app {
  position: relative;
}

.app-shell {
  position: relative;
  min-height: 100vh;
  padding: 24px;
  overflow: hidden;
}

.shell-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(10px);
  pointer-events: none;
}

.shell-orb-left {
  top: -10rem;
  left: -6rem;
  width: 28rem;
  height: 28rem;
  background: rgba(29, 78, 216, 0.08);
}

.shell-orb-right {
  top: 8rem;
  right: -10rem;
  width: 24rem;
  height: 24rem;
  background: rgba(15, 118, 110, 0.1);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: auto 1fr minmax(20rem, 26rem);
  gap: 20px;
  align-items: center;
  margin: 0 auto 24px;
  padding: 18px 22px;
  max-width: 1440px;
  background: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: 0 20px 50px -32px var(--shadow-strong);
  backdrop-filter: blur(22px);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.brand-mark {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--signal) 35%, transparent), transparent 58%),
    color-mix(in srgb, var(--surface-strong) 88%, transparent);
  border: 1px solid var(--border-strong);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.brand-mark::before,
.brand-mark::after,
.brand-slash {
  content: "";
  position: absolute;
  background: color-mix(in srgb, var(--accent) 60%, var(--signal) 40%);
  border-radius: 999px;
}

.brand-mark::before {
  inset: 9px 28px 9px 11px;
}

.brand-mark::after {
  inset: 11px 11px 27px 24px;
}

.brand-slash {
  inset: 18px 14px 17px 14px;
  transform: rotate(-34deg);
}

.brand-copy h1 {
  margin: 0;
  font-family: "Avenir Next Condensed", "DIN Alternate", "Segoe UI Variable", sans-serif;
  font-size: clamp(1.28rem, 1.08rem + 0.58vw, 1.72rem);
  letter-spacing: 0.14em;
  font-weight: 700;
}

.brand-kicker {
  margin: 0 0 4px;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.primary-nav {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.nav-link {
  display: grid;
  gap: 2px;
  min-width: 92px;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 16px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

@media (hover: hover) {
  .nav-link:hover {
    transform: translateY(-1px);
    border-color: var(--border);
    background: color-mix(in srgb, var(--surface-strong) 78%, transparent);
    color: var(--text);
  }

  .theme-toggle:hover {
    transform: translateY(-1px);
    border-color: var(--border-strong);
    background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  }
}

.nav-link.router-link-active {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 55%, transparent), transparent),
    color-mix(in srgb, var(--surface-strong) 85%, transparent);
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.nav-label {
  font-size: 0.95rem;
  font-weight: 600;
}

.nav-hint {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.status-panel {
  display: grid;
  gap: 12px;
}

.system-strip,
.utility-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 82%, transparent);
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 18%, transparent);
}

.status-online {
  color: var(--ok);
}

.status-offline {
  color: var(--danger);
}

.status-ready {
  color: var(--accent);
}

.status-indexing {
  color: var(--signal);
}

.theme-toggle {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 82%, transparent);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.theme-toggle.privacy-active {
  border-color: color-mix(in srgb, var(--warn) 40%, var(--border));
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  color: var(--warn);
}

.toggle-label {
  display: inline-block;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-main {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  max-width: 1440px;
}

.app-main :deep(.hero-panel),
.app-main :deep(.panel),
.app-main :deep(.stats-card),
.app-main :deep(.timeline-panel),
.app-main :deep(.state-card),
.app-main :deep(.calendar-grid),
.app-main :deep(.day-notes),
.app-main :deep(.filter-bar),
.app-main :deep(.note-list) {
  animation: panel-rise 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.route-fade-enter-active,
.route-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.route-fade-enter-from,
.route-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes panel-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1180px) {
  .topbar {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .primary-nav {
    justify-content: flex-start;
  }

  .system-strip,
  .utility-row {
    justify-content: flex-start;
  }
}

@media (max-width: 1024px) {
  .app-shell {
    padding: 18px;
  }

  .topbar {
    padding: 16px 18px;
  }
}

@media (max-width: 720px) {
  .app-shell {
    padding: 14px;
    padding-bottom: 80px;
  }

  .topbar {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 22px;
  }

  .primary-nav {
    display: none;
  }

  .nav-link {
    min-width: 0;
    flex: 1 1 calc(50% - 10px);
  }
}

.bottom-nav {
  display: none;
}

@media (max-width: 720px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
    border-top: 1px solid var(--border);
    backdrop-filter: blur(22px);
    padding: 0 4px env(safe-area-inset-bottom, 0);
  }
}

.bottom-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 60px;
  padding: 8px 4px;
  text-decoration: none;
  color: var(--text-muted);
  transition: color 0.18s ease;
}

.bottom-nav-item.router-link-active {
  color: var(--signal);
}

.bottom-nav-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.bottom-nav-label {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
