<template>
  <Teleport to="body">
    <div v-if="isOpen" class="cmd-overlay" @click.self="close">
      <div class="cmd-card">
        <div class="cmd-input-wrap">
          <span class="cmd-icon">⌘</span>
          <input
            ref="inputRef"
            v-model="query"
            class="cmd-input"
            placeholder="搜索命令或页面跳转 (Cmd+K)"
            @keydown.down.prevent="selectNext"
            @keydown.up.prevent="selectPrev"
            @keydown.enter.prevent="executeSelected"
            @keydown.esc.prevent="close"
          />
        </div>
        <div class="cmd-list" ref="listRef">
          <div v-if="filteredCommands.length === 0" class="cmd-empty">无匹配命令</div>
          <div
            v-for="(cmd, index) in filteredCommands"
            :key="cmd.id"
            class="cmd-item"
            :class="{ active: index === selectedIndex }"
            @click="executeCommand(cmd)"
            @mouseenter="selectedIndex = index"
          >
            <span class="cmd-item-icon">{{ cmd.icon }}</span>
            <span class="cmd-item-label">{{ cmd.label }}</span>
            <span v-if="cmd.shortcut" class="cmd-item-shortcut">{{ cmd.shortcut }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';

// Emits event that App.vue might want, like open-create-note
const emit = defineEmits<{ (e: 'action', actionName: string): void }>();

const router = useRouter();

const isOpen = ref(false);
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const selectedIndex = ref(0);

interface Command {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

const allCommands: Command[] = [
  { id: 'nav-home', label: '返回首页 (Dashboard)', icon: '⊞', action: () => router.push('/') },
  { id: 'nav-timeline', label: '打开时间线 (Timeline)', icon: '⋯', action: () => router.push('/timeline') },
  { id: 'nav-calendar', label: '打开日历视图 (Calendar)', icon: '▦', action: () => router.push('/calendar') },
  { id: 'nav-stats', label: '打开统计面板 (Stats)', icon: '◈', action: () => router.push('/stats') },
  { id: 'nav-events', label: '打开事件轴 (Events)', icon: '◎', action: () => router.push('/events') },
  { id: 'nav-governance', label: '打开治理大盘 (Governance)', icon: '⚖', action: () => router.push('/governance') },
  { id: 'nav-insights', label: '打开闲思洞察 (Insights)', icon: '✧', action: () => router.push('/insights') },
  { id: 'nav-ops', label: '打开系统运维 (Ops)', icon: '⚡', action: () => router.push('/ops') },
  { id: 'nav-settings', label: '打开系统设置 (Settings)', icon: '⚙', action: () => router.push('/settings') },
  { id: 'nav-search', label: '全局搜索笔记 (Search)', icon: '🔍', action: () => router.push('/search') },
  { id: 'action-create-note', label: '创建新笔记', icon: '📝', shortcut: 'C', action: () => emit('action', 'create-note') },
];

const filteredCommands = computed(() => {
  const t = query.value.trim().toLowerCase();
  if (!t) return allCommands;
  return allCommands.filter(c => c.label.toLowerCase().includes(t) || c.id.toLowerCase().includes(t));
});

watch(query, () => { selectedIndex.value = 0; });

function open() {
  isOpen.value = true;
  query.value = '';
  selectedIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}

function close() {
  isOpen.value = false;
}

function selectNext() {
  if (selectedIndex.value < filteredCommands.value.length - 1) {
    selectedIndex.value++;
    scrollToSelected();
  }
}

function selectPrev() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
    scrollToSelected();
  }
}

function scrollToSelected() {
  nextTick(() => {
    if (!listRef.value) return;
    const activeEl = listRef.value.children[selectedIndex.value] as HTMLElement;
    if (activeEl) {
      const top = activeEl.offsetTop;
      const bottom = top + activeEl.offsetHeight;
      const listScroll = listRef.value.scrollTop;
      const listHeight = listRef.value.offsetHeight;
      if (top < listScroll) listRef.value.scrollTop = top;
      else if (bottom > listScroll + listHeight) listRef.value.scrollTop = bottom - listHeight;
    }
  });
}

function executeCommand(cmd: Command) {
  cmd.action();
  close();
}

function executeSelected() {
  const cmd = filteredCommands.value[selectedIndex.value];
  if (cmd) executeCommand(cmd);
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    isOpen.value ? close() : open();
  } else if (!isOpen.value && !e.metaKey && !e.ctrlKey && e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    open();
  }
}

onMounted(() => { window.addEventListener('keydown', handleGlobalKeydown); });
onUnmounted(() => { window.removeEventListener('keydown', handleGlobalKeydown); });
</script>

<style scoped>
.cmd-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(4, 11, 20, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

.cmd-card {
  width: 90vw;
  max-width: 600px;
  background: color-mix(in srgb, var(--surface-strong) 98%, transparent);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 32px 64px -28px var(--shadow-strong);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cmd-input-wrap {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}

.cmd-icon {
  font-size: 1.2rem;
  color: var(--text-muted);
}

.cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 1.2rem;
  color: var(--text);
  font-family: inherit;
}

.cmd-input::placeholder {
  color: var(--text-muted);
}

.cmd-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.cmd-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.1s;
}

.cmd-item.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}
.cmd-item.active .cmd-item-label {
  color: var(--accent);
}

.cmd-item-icon {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.cmd-item-label {
  flex: 1;
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
  transition: color 0.1s;
}

.cmd-item-shortcut {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--surface-muted);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  font-family: monospace;
}
</style>
