import { ref } from 'vue';

export type NotificationType = 'info' | 'success' | 'warn' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

const notifications = ref<AppNotification[]>([]);
let nextId = 1;

export function useNotification() {
  const addNotification = (
    title: string,
    message: string,
    type: NotificationType = 'info',
    duration = 4000
  ) => {
    const id = `notif_${nextId++}`;
    notifications.value.push({ id, title, message, type, duration });

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  };

  return {
    notifications,
    addNotification,
    removeNotification,
  };
}
