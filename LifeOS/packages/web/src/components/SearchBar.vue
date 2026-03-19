<template>
  <div class="search-bar">
    <div class="search-input-wrapper">
      <span class="search-glyph">⌘</span>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="检索日志、任务、维度信号"
        class="search-input"
        @keydown.enter="handleSearch"
        @keydown.esc="handleClear"
        @focus="showHistory = true"
        @blur="handleBlur"
      />
      <span class="search-shortcut">Ctrl K</span>
      <button v-if="query" class="clear-btn" @click="handleClear" aria-label="清空搜索">×</button>
    </div>

    <div v-if="showHistory && history.length > 0" class="history-dropdown">
      <div class="history-header">
        <span>最近检索</span>
        <button @click="clearHistory">清空</button>
      </div>
      <div
        v-for="item in history.slice(0, 5)"
        :key="item"
        class="history-item"
        @mousedown.prevent="handleHistoryClick(item)"
      >
        {{ item }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSearchHistory } from '../composables/useSearchHistory';

const router = useRouter();
const { history, addHistory, clearHistory } = useSearchHistory();

const query = ref('');
const showHistory = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

function handleSearch() {
  if (!query.value.trim()) return;

  addHistory(query.value);
  router.push({ path: '/search', query: { q: query.value } });
  showHistory.value = false;
  inputRef.value?.blur();
}

function handleClear() {
  query.value = '';
  showHistory.value = false;
}

function handleBlur() {
  setTimeout(() => {
    showHistory.value = false;
  }, 200);
}

function handleHistoryClick(item: string) {
  query.value = item;
  handleSearch();
}

function handleKeyboard(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    inputRef.value?.focus();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyboard);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard);
});
</script>

<style scoped>
.search-bar {
  position: relative;
  min-width: min(24rem, 100%);
}

.search-input-wrapper {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 86%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.search-input-wrapper:focus-within {
  border-color: color-mix(in srgb, var(--signal) 42%, var(--border));
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--signal) 10%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}

.search-glyph,
.search-shortcut {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.search-glyph {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--surface-muted);
}

.search-input {
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text);
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--text);
}

.history-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-strong) 95%, transparent);
  box-shadow: 0 24px 60px -34px var(--shadow-strong);
  backdrop-filter: blur(18px);
  z-index: 30;
}

.history-header,
.history-item {
  padding: 12px 14px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.history-header button {
  border: none;
  background: transparent;
  color: var(--signal);
  cursor: pointer;
}

.history-item {
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.18s ease, color 0.18s ease;
}

.history-item:hover {
  background: var(--surface-muted);
  color: var(--text);
}

@media (max-width: 720px) {
  .search-bar {
    min-width: 100%;
  }

  .search-shortcut {
    display: none;
  }
}
</style>
