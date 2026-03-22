<template>
  <Teleport to="body">
    <div v-if="taskId" class="worker-task-overlay" @click.self="$emit('close')">
      <div class="worker-task-card">
        <button class="close-btn" @click="$emit('close')" aria-label="关闭任务详情">×</button>

        <div v-if="loading" class="state-card">正在加载任务详情...</div>
        <div v-else-if="error" class="state-card error-state">{{ error }}</div>
        <div v-else-if="task" class="detail-body">
          <div class="detail-header">
            <div>
              <p class="detail-kicker">Worker Task</p>
              <h3>{{ workerTaskTypeLabel(task.taskType) }}</h3>
            </div>
            <span class="detail-status" :class="`status-${task.status}`">{{ workerTaskStatusLabel(task.status) }}</span>
          </div>

          <div class="detail-pills">
            <span class="detail-pill">{{ workerTaskWorkerLabel(task.worker) }}</span>
            <span class="detail-pill">{{ workerTaskTypeLabel(task.taskType) }}</span>
            <span class="detail-pill">{{ shortId(task.id) }}</span>
            <button
              v-if="task.sourceNoteId"
              type="button"
              class="detail-pill action-pill"
              @click="openSourceNote(task.sourceNoteId)"
            >
              source {{ shortId(task.sourceNoteId) }}
            </button>
          </div>

          <div class="detail-grid">
            <div class="detail-block">
              <p class="block-title">时间线</p>
              <div class="detail-lines">
                <div>创建于 {{ formatDateTime(task.createdAt) }}</div>
                <div v-if="task.startedAt">开始于 {{ formatDateTime(task.startedAt) }}</div>
                <div v-if="task.finishedAt">完成于 {{ formatDateTime(task.finishedAt) }}</div>
              </div>
            </div>

            <div class="detail-block">
              <p class="block-title">输入参数</p>
              <pre class="json-box">{{ formatJson(task.input) }}</pre>
            </div>
          </div>

          <div v-if="task.resultSummary" class="detail-block">
            <p class="block-title">结果摘要</p>
            <div class="summary-box">{{ task.resultSummary }}</div>
          </div>

          <div v-if="workerTaskResultFacts(task).length" class="detail-block">
            <div class="block-head">
              <p class="block-title">关键结果</p>
              <span class="output-count">{{ workerTaskResultFacts(task).length }} 条</span>
            </div>
            <div class="detail-facts">
              <span v-for="fact in workerTaskResultFacts(task)" :key="fact" class="detail-fact">{{ fact }}</span>
            </div>
          </div>

          <div v-if="task.result" class="detail-block">
            <p class="block-title">结构化结果</p>
            <pre class="json-box">{{ formatJson(task.result) }}</pre>
          </div>

          <div v-if="task.error" class="detail-block">
            <p class="block-title">错误信息</p>
            <div class="error-box">{{ task.error }}</div>
          </div>

          <div class="detail-block">
            <div class="block-head">
              <p class="block-title">输出笔记</p>
              <span class="output-count">{{ task.outputNotes?.length || 0 }} 个</span>
            </div>
            <div v-if="task.outputNotes?.length" class="output-list">
              <button
                v-for="output in task.outputNotes"
                :key="output.id"
                type="button"
                class="output-item"
                @click="openOutput(output.id)"
              >
                <span class="output-title">{{ output.title }}</span>
                <span class="output-file">{{ output.fileName }}</span>
              </button>
            </div>
            <div v-else class="empty-text">该任务还没有输出笔记</div>
          </div>

          <div class="detail-actions">
            <button class="btn-inline" @click="loadTask" :disabled="loading || actionTaskId === task.id">刷新</button>
            <button
              v-if="task.status === 'pending' || task.status === 'running'"
              class="btn-inline btn-cancel-inline"
              @click="handleCancel"
              :disabled="actionTaskId === task.id"
            >
              {{ actionTaskId === task.id ? '处理中...' : '取消' }}
            </button>
            <button
              v-if="task.status === 'failed' || task.status === 'cancelled'"
              class="btn-inline btn-retry-inline"
              @click="handleRetry"
              :disabled="actionTaskId === task.id"
            >
              {{ actionTaskId === task.id ? '处理中...' : '重试' }}
            </button>
          </div>

          <div v-if="message" :class="['inline-msg', messageType]">{{ message }}</div>
        </div>
      </div>
    </div>

    <NoteDetail v-if="selectedNoteId" :note-id="selectedNoteId" @close="selectedNoteId = null" />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { WorkerTask, WsEvent } from '@lifeos/shared';
import { fetchWorkerTask, retryWorkerTask, cancelWorkerTask } from '../api/client';
import NoteDetail from './NoteDetail.vue';
import { workerTaskActionMessage, workerTaskResultFacts, workerTaskStatusLabel, workerTaskTypeLabel, workerTaskWorkerLabel } from '../utils/workerTaskLabels';

const props = defineProps<{ taskId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const task = ref<WorkerTask | null>(null);
const loading = ref(false);
const error = ref('');
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const actionTaskId = ref<string | null>(null);
const selectedNoteId = ref<string | null>(null);
let activeTaskRequestId = 0;

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

async function loadTask(taskId = props.taskId, requestId?: number) {
  if (!taskId) return;
  loading.value = true;
  error.value = '';
  try {
    const nextTask = await fetchWorkerTask(taskId);
    if (requestId != null && (requestId !== activeTaskRequestId || props.taskId !== taskId)) return;
    task.value = nextTask;
  } catch (e: any) {
    if (requestId != null && (requestId !== activeTaskRequestId || props.taskId !== taskId)) return;
    error.value = e.message || '加载任务详情失败';
  } finally {
    if (requestId == null || (requestId === activeTaskRequestId && props.taskId === taskId)) {
      loading.value = false;
    }
  }
}

async function handleRetry() {
  if (!task.value) return;
  actionTaskId.value = task.value.id;
  message.value = '';
  try {
    task.value = await retryWorkerTask(task.value.id);
    message.value = workerTaskActionMessage('retried', task.value);
    messageType.value = 'success';
  } catch (e: any) {
    message.value = e.message || '任务重试失败';
    messageType.value = 'error';
  } finally {
    actionTaskId.value = null;
  }
}

async function handleCancel() {
  if (!task.value) return;
  actionTaskId.value = task.value.id;
  message.value = '';
  try {
    task.value = await cancelWorkerTask(task.value.id);
    message.value = workerTaskActionMessage('cancelled', task.value);
    messageType.value = 'success';
  } catch (e: any) {
    message.value = e.message || '任务取消失败';
    messageType.value = 'error';
  } finally {
    actionTaskId.value = null;
  }
}

function openOutput(noteId: string) {
  selectedNoteId.value = noteId;
}

function openSourceNote(noteId: string) {
  selectedNoteId.value = noteId;
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (!props.taskId) return;
  if (wsEvent.type === 'worker-task-updated' && wsEvent.data.id === props.taskId) {
    void loadTask();
    return;
  }
  if (wsEvent.type === 'note-worker-tasks-updated' && wsEvent.data.task.id === props.taskId) {
    void loadTask();
  }
}

watch(() => props.taskId, async (taskId) => {
  const requestId = ++activeTaskRequestId;
  message.value = '';
  if (!taskId) {
    task.value = null;
    error.value = '';
    loading.value = false;
    return;
  }
  await loadTask(taskId, requestId);
}, { immediate: true });

onMounted(() => {
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});
</script>

<style scoped>
.worker-task-overlay {
  position: fixed;
  inset: 0;
  z-index: 9200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 11, 20, 0.6);
  backdrop-filter: blur(8px);
}

.worker-task-card {
  position: relative;
  width: min(720px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  box-shadow: 0 24px 60px -24px var(--shadow-strong);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 20px;
}

.state-card {
  padding: 18px;
  border-radius: 12px;
  background: var(--meta-bg);
  color: var(--text-secondary);
}

.error-state {
  color: var(--danger);
}

.detail-body {
  display: grid;
  gap: 16px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail-kicker,
.block-title {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.detail-header h3 {
  margin: 6px 0 0;
  font-size: 22px;
}

.detail-status {
  font-size: 12px;
}

.detail-status.status-pending { color: #e6a23c; }
.detail-status.status-running { color: #409eff; }
.detail-status.status-succeeded { color: #67c23a; }
.detail-status.status-failed { color: #f56c6c; }
.detail-status.status-cancelled { color: #909399; }

.detail-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-pill {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--meta-bg);
  color: var(--text-muted);
  font-size: 12px;
  font-family: monospace;
}

.action-pill {
  cursor: pointer;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.detail-block {
  display: grid;
  gap: 8px;
}

.detail-lines,
.summary-box,
.error-box,
.empty-text {
  padding: 12px;
  border-radius: 12px;
  background: var(--meta-bg);
  color: var(--text-secondary);
  line-height: 1.6;
}

.error-box {
  color: var(--danger);
}

.json-box {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: var(--meta-bg);
  color: var(--text);
  font-size: 12px;
  overflow-x: auto;
}

.block-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.output-count {
  color: var(--text-muted);
  font-size: 12px;
}

.output-list {
  display: grid;
  gap: 8px;
}

.output-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card-bg);
  cursor: pointer;
  text-align: left;
}

.output-item:hover {
  border-color: #409eff;
}

.output-title {
  color: var(--text);
  font-size: 13px;
}

.output-file {
  color: var(--text-muted);
  font-size: 12px;
  font-family: monospace;
}

.detail-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-fact {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 42%, var(--card-bg));
  color: var(--text-secondary);
  font-size: 12px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-inline {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 12px;
}

.btn-inline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-retry-inline {
  color: #409eff;
  border-color: color-mix(in srgb, #409eff 30%, var(--border));
}

.btn-cancel-inline {
  color: #f56c6c;
  border-color: color-mix(in srgb, #f56c6c 30%, var(--border));
}

.inline-msg {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
}

.inline-msg.success {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.inline-msg.error {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}
</style>
