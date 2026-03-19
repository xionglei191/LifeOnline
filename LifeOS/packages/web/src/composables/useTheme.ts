import { ref, watch } from 'vue';

const isDark = ref(localStorage.getItem('theme') === 'dark');

function applyTheme(dark: boolean) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

// Apply on init
applyTheme(isDark.value);

watch(isDark, applyTheme);

export function useTheme() {
  return { isDark, toggle: () => { isDark.value = !isDark.value; } };
}
