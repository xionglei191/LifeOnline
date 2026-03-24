<template>
  <div class="notification-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="toast-item panel"
        :class="[`toast-${notif.type}`]"
        @click="removeNotification(notif.id)"
      >
        <div class="toast-indicator"></div>
        <div class="toast-content">
          <h4 class="toast-title">{{ notif.title }}</h4>
          <p class="toast-message">{{ notif.message }}</p>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useNotification } from '../composables/useNotification';

const { notifications, removeNotification } = useNotification();
</script>

<style scoped>
.notification-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none; /* Let clicks pass through empty space */
}

@media (max-width: 720px) {
  .notification-container {
    bottom: max(90px, env(safe-area-inset-bottom, 24px)); /* Above nav bar on mobile */
    right: 16px;
    left: 16px;
    align-items: stretch;
  }
}

.toast-item {
  position: relative;
  display: flex;
  min-width: 280px;
  max-width: 400px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 18px;
  gap: 14px;
  box-shadow: 0 12px 32px -12px var(--shadow-strong);
  backdrop-filter: blur(12px);
  pointer-events: auto; /* Re-enable clicks for the toast */
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

@media (max-width: 720px) {
  .toast-item {
    min-width: 100%;
    max-width: 100%;
  }
}

.toast-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px -12px var(--shadow-strong);
}

.toast-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--text-muted);
}

.toast-info .toast-indicator { background: var(--signal); }
.toast-success .toast-indicator { background: var(--ok); }
.toast-warn .toast-indicator { background: var(--warn); }
.toast-error .toast-indicator { background: var(--danger); }

.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toast-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
}

.toast-message {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

@media (max-width: 720px) {
  .toast-enter-from {
    transform: translateY(30px) scale(0.95);
  }
}
</style>
