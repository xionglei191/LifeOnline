<template>
  <div class="state-display" :class="type">
    <span v-if="type === 'loading'" class="spinner"></span>
    <span v-else-if="type === 'error'" class="state-icon">!</span>
    <span v-else class="state-icon muted">—</span>
    <span class="state-message">{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type: 'loading' | 'error' | 'empty';
  message?: string;
}>();
</script>

<style scoped>
.state-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
  color: var(--text-secondary);
  font-size: 0.97rem;
}

.state-display.error {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 22%, var(--border));
  background: color-mix(in srgb, var(--danger) 6%, var(--surface-strong));
}

.state-display.empty {
  color: var(--text-muted);
}

.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.state-display.error .state-icon {
  background: color-mix(in srgb, var(--danger) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.state-display.empty .state-icon {
  background: var(--surface-muted);
  color: var(--text-muted);
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
  color: var(--signal);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .state-display {
    padding: 20px;
    border-radius: 24px;
  }
}
</style>
