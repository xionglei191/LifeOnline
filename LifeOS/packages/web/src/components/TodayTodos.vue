<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">Execution Queue</p>
        <h3>今日任务队列</h3>
      </div>
      <span class="panel-badge">{{ todos.length }} items</span>
    </div>

    <div v-if="todos.length === 0" class="empty">今天的任务队列为空，可以把精力留给长期目标。</div>

    <ul v-else class="todo-list">
      <li
        v-for="todo in todos"
        :key="todo.id"
        class="todo-item"
        :style="{ '--priority-color': priorityColor(todo.priority || 'medium') }"
      >
        <label class="todo-check">
          <input
            type="checkbox"
            :checked="todo.status === 'done'"
            :disabled="syncingTodoIds.includes(todo.id)"
            @change="handleToggle(todo)"
          />
          <span class="checkmark"></span>
        </label>

        <div class="content" @click="$emit('selectNote', todo.id)">
          <div class="row-top">
            <span class="title">{{ todo.file_name.replace('.md', '') }}</span>
            <span class="priority-pill">{{ priorityLabel(todo.priority || 'medium') }}</span>
          </div>

          <div class="meta">
            <span class="dimension">{{ dimensionLabel(todo.dimension) }}</span>
            <span v-if="todo.due" class="due">截止 {{ formatDue(todo.due) }}</span>
            <span class="status">{{ statusLabel(todo.status) }}</span>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Note } from '@lifeos/shared';
import { updateNote } from '../api/client';
import { getDimensionLabel } from '../utils/dimensions';

defineProps<{ todos: Note[] }>();
const emit = defineEmits<{ selectNote: [noteId: string]; refresh: [] }>();
const syncingTodoIds = ref<string[]>([]);

const priorities: Record<string, string> = {
  high: '高压',
  medium: '常规',
  low: '缓行',
};

const priorityColors: Record<string, string> = {
  high: 'var(--danger)',
  medium: 'var(--warn)',
  low: 'var(--accent)',
};

const statuses: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
};

const dimensionLabel = (dim: Note['dimension']) => getDimensionLabel(dim);
const priorityLabel = (priority: string) => priorities[priority] || priority;
const priorityColor = (priority: string) => priorityColors[priority] || 'var(--signal)';
const statusLabel = (status: string) => statuses[status] || status;

const formatDue = (due: string) => due.slice(5);

async function handleToggle(todo: Note) {
  if (syncingTodoIds.value.includes(todo.id)) {
    return;
  }
  const newStatus = todo.status === 'done' ? 'pending' : 'done';
  syncingTodoIds.value = [...syncingTodoIds.value, todo.id];
  try {
    await updateNote(todo.id, { status: newStatus });
    emit('refresh');
  } catch (e) {
    console.error('Toggle failed:', e);
  } finally {
    syncingTodoIds.value = syncingTodoIds.value.filter((id) => id !== todo.id);
  }
}
</script>

<style scoped>
.panel {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 18px;
}

.panel-kicker {
  margin: 0 0 4px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.panel-head h3 {
  margin: 0;
  font-size: 1.35rem;
}

.panel-badge {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.empty {
  padding: 20px;
  border-radius: 20px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  line-height: 1.6;
}

.todo-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: start;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--priority-color) 25%, var(--border));
  border-radius: 22px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--priority-color) 10%, transparent), transparent 28%),
    color-mix(in srgb, var(--surface) 92%, transparent);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.todo-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 42px -34px var(--shadow-strong);
}

.todo-check {
  position: relative;
  display: inline-grid;
  width: 22px;
  height: 22px;
  margin-top: 2px;
}

.todo-check input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.checkmark {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--priority-color) 50%, var(--border));
  background: color-mix(in srgb, var(--priority-color) 12%, transparent);
}

.todo-check input:checked + .checkmark {
  background:
    radial-gradient(circle at center, color-mix(in srgb, var(--priority-color) 92%, white) 0 40%, transparent 42%),
    color-mix(in srgb, var(--priority-color) 20%, transparent);
}

.content {
  display: grid;
  gap: 10px;
  cursor: pointer;
}

.row-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.title {
  font-weight: 600;
  line-height: 1.45;
}

.priority-pill {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--priority-color) 14%, transparent);
  color: var(--priority-color);
  font-size: 0.76rem;
  font-weight: 700;
}

.meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 0.84rem;
}

.dimension,
.due,
.status {
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--surface-muted);
}

@media (max-width: 720px) {
  .panel {
    padding: 20px;
    border-radius: 24px;
  }

  .row-top {
    flex-direction: column;
    align-items: start;
  }
}
</style>
