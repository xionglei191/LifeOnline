<template>
  <div v-if="error" class="error-boundary">
    <StateDisplay type="error" :message="errorMessage" />
    <button class="retry-btn" @click="resetError">↻ 尝试恢复</button>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import StateDisplay from './StateDisplay.vue';

const error = ref<Error | null>(null);
const errorMessage = ref('页面渲染遇到意外错误，请刷新重试。');

onErrorCaptured((err: Error) => {
  error.value = err;
  errorMessage.value = err.message || '页面渲染遇到意外错误。';
  console.error('[ErrorBoundary caught]: ', err);
  // Return false to stop the error from propagating to Vue's global handler
  return false;
});

function resetError() {
  error.value = null;
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 20px;
  min-height: 50vh;
}

.retry-btn {
  padding: 8px 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px var(--shadow);
}

.retry-btn:hover {
  background: var(--surface);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
</style>
