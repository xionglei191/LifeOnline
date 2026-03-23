<template>
  <section class="ai-panel">
    <div class="append-head">
      <p class="panel-kicker">关联任务</p>
      <span class="append-hint">基于当前笔记内容发起关联任务，包含 LifeOS 与 OpenClaw 执行路径</span>
    </div>
    <div class="worker-form-grid">
      <div class="worker-field" style="grid-column: 1 / -1">
        <label>任务指令</label>
        <textarea v-model="instruction" rows="2" placeholder="输入自然语言指令，例如：搜索相关领域最新进展" :disabled="submitting"></textarea>
      </div>
      <div class="worker-field">
        <label>结果归档维度</label>
        <select v-model="dimension" :disabled="submitting">
          <option v-for="d in selectableDimensions" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </div>
    </div>
    <div class="ai-actions">
      <button @click="$emit('create-openclaw', { instruction: instruction.trim(), dimension })" :disabled="submitting || !instruction.trim()" class="primary-btn secondary">
        {{ submitting ? '发起中...' : '执行 OpenClaw 任务' }}
      </button>
      <button @click="$emit('create-summarize')" :disabled="submitting" class="primary-btn secondary">
        {{ submitting ? '发起中...' : '生成笔记摘要' }}
      </button>
      <button @click="$emit('create-persona-snapshot')" :disabled="submitting" class="primary-btn secondary">
        {{ submitting ? '发起中...' : '更新人格快照' }}
      </button>
    </div>
    <div v-if="message" :class="['inline-msg', messageType]">{{ message }}</div>
  </section>

  <section class="ai-panel">
    <div class="append-head">
      <p class="panel-kicker">最近关联任务</p>
      <span class="append-hint">展示由当前笔记发起的最近关联任务</span>
    </div>
    <div class="related-worker-toolbar">
      <select v-model="filterStatus" class="related-worker-filter" @change="$emit('filter-change', filterStatus)">
        <option value="">全部状态</option>
        <option value="pending">等待执行</option>
        <option value="running">执行中</option>
        <option value="succeeded">已完成</option>
        <option value="failed">失败</option>
        <option value="cancelled">已取消</option>
      </select>
      <button type="button" class="btn-link" @click="$emit('refresh')">刷新</button>
    </div>
    <div v-if="tasks.length" class="related-worker-list">
      <WorkerTaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :busy="busyTaskId === task.id"
        @open-detail="(id) => $emit('open-detail', id)"
        @open-output="(output) => $emit('open-output', output)"
        @cancel="(id) => $emit('cancel-task', id)"
        @retry="(id) => $emit('retry-task', id)"
      />
    </div>
    <div v-else class="empty-worker-tasks">{{ filterStatus ? '当前筛选下没有关联任务' : '当前笔记还没有发起过关联任务' }}</div>
  </section>

  <section class="ai-panel">
    <div class="append-head">
      <p class="panel-kicker">行动项提取</p>
      <span class="append-hint">将当前笔记的行动项提取为 worker task，并在下方关联任务中查看结果</span>
    </div>
    <div class="ai-actions">
      <button @click="$emit('extract-tasks')" :disabled="extracting" class="primary-btn secondary">
        {{ extracting ? '发起中...' : '提取行动项' }}
      </button>
      <span v-if="extracting" class="extract-hint">正在创建 worker task...</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { WorkerTask, SelectableDimension } from '@lifeos/shared';
import { SELECTABLE_DIMENSIONS } from '../utils/dimensions';
import WorkerTaskCard from './WorkerTaskCard.vue';

defineProps<{
  tasks: WorkerTask[];
  busyTaskId: string | null;
  submitting: boolean;
  extracting: boolean;
  message: string;
  messageType: 'success' | 'error';
}>();

defineEmits<{
  'create-openclaw': [payload: { instruction: string; dimension: SelectableDimension }];
  'create-summarize': [];
  'create-persona-snapshot': [];
  'extract-tasks': [];
  'cancel-task': [taskId: string];
  'retry-task': [taskId: string];
  'open-detail': [taskId: string];
  'open-output': [output: any];
  'filter-change': [status: string];
  'refresh': [];
}>();

const instruction = ref('');
const dimension = ref<SelectableDimension>('learning');
const filterStatus = ref('');
const selectableDimensions = SELECTABLE_DIMENSIONS;
</script>

<style scoped>
.ai-panel {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  padding: 20px;
  border-radius: 22px;
}

.append-head {
  margin-bottom: 14px;
}

.panel-kicker {
  margin: 0 0 6px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.append-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.worker-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.worker-field label {
  display: block;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.worker-field textarea,
.worker-field select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.88rem;
  resize: vertical;
}

.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.primary-btn {
  min-height: 38px;
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.primary-btn.secondary {
  background: color-mix(in srgb, var(--signal) 10%, transparent);
  color: var(--signal);
}

.primary-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--signal) 18%, transparent);
}

.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.inline-msg {
  margin-top: 8px;
  font-size: 0.82rem;
  padding: 8px 14px;
  border-radius: 12px;
}

.inline-msg.success {
  background: color-mix(in srgb, var(--ok) 10%, transparent);
  color: var(--ok);
}

.inline-msg.error {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
}

.related-worker-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.related-worker-filter {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
}

.btn-link {
  border: none;
  background: transparent;
  color: var(--signal);
  cursor: pointer;
  font-size: 0.82rem;
}

.related-worker-list {
  display: grid;
  gap: 10px;
}

.empty-worker-tasks {
  padding: 14px;
  border-radius: 14px;
  background: var(--surface-muted);
  color: var(--text-muted);
  text-align: center;
  font-size: 0.85rem;
}

.extract-hint {
  font-size: 0.82rem;
  color: var(--text-muted);
}
</style>
