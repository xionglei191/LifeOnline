<template>
  <div class="privacy-wrap">
    <slot v-if="revealed || isContentVisible(privacy)" />
    <div v-else class="privacy-mask" :class="'mask-' + privacy">
      <span class="mask-icon">{{ privacy === 'sensitive' ? '🔐' : '🔒' }}</span>
      <span class="mask-label">{{ privacy === 'sensitive' ? '敏感内容' : '私密内容' }}</span>
      <button v-if="privacy === 'sensitive'" class="mask-reveal" @click.stop="revealed = true">
        点击查看
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { isContentVisible } from '../composables/usePrivacy';

const props = defineProps<{ privacy: string }>();
const revealed = ref(false);
</script>

<style scoped>
.privacy-wrap { width: 100%; }

.privacy-mask {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px dashed var(--border-strong);
  background: color-mix(in srgb, var(--surface-muted) 80%, transparent);
  color: var(--text-muted);
  font-size: 0.88rem;
}

.mask-sensitive {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border));
  background: color-mix(in srgb, var(--danger) 6%, transparent);
}

.mask-private {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--border));
  background: color-mix(in srgb, var(--warn) 6%, transparent);
}

.mask-icon { font-size: 1rem; }
.mask-label { flex: 1; }

.mask-reveal {
  padding: 4px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  font-size: 0.78rem;
  cursor: pointer;
}
</style>
