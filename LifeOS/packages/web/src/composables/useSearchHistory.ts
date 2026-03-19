import { ref, watch } from 'vue';

const STORAGE_KEY = 'lifeos_search_history';
const MAX_HISTORY = 10;

export function useSearchHistory() {
  const history = ref<string[]>([]);

  // 从 localStorage 加载历史
  function loadHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        history.value = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }

  // 保存历史到 localStorage
  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value));
    } catch (e) {
      console.error('Failed to save search history:', e);
    }
  }

  // 添加搜索记录
  function addHistory(query: string) {
    if (!query.trim()) return;

    // 移除重复项
    const index = history.value.indexOf(query);
    if (index > -1) {
      history.value.splice(index, 1);
    }

    // 添加到开头
    history.value.unshift(query);

    // 限制数量
    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(0, MAX_HISTORY);
    }

    saveHistory();
  }

  // 清空历史
  function clearHistory() {
    history.value = [];
    saveHistory();
  }

  // 初始化时加载
  loadHistory();

  return {
    history,
    addHistory,
    clearHistory,
  };
}
