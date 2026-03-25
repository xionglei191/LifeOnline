<template>
  <div class="settings-card">
    <h3>外部执行任务</h3>
    <p class="hint" style="margin-bottom:16px">LifeOS 负责发起任务与落地结果，按需调用 AI 或外部执行器完成。</p>

    <div class="worker-form">
      <div class="form-group">
        <label>任务指令</label>
        <textarea v-model="workerInstruction" rows="3" placeholder="输入自然语言指令，例如：搜索最近一周 AI Agent 领域的重要进展并整理" :disabled="workerSubmitting"></textarea>
      </div>
      <div class="form-group">
        <label>结果归档维度（可选）</label>
        <select v-model="workerDimension" :disabled="workerSubmitting">
          <option value="learning">学习</option>
          <option value="career">事业</option>
          <option value="finance">财务</option>
          <option value="health">健康</option>
          <option value="relationship">关系</option>
          <option value="life">生活</option>
          <option value="hobby">兴趣</option>
          <option value="growth">成长</option>
        </select>
      </div>
    </div>

    <div class="action-row">
      <button @click="handleCreateWorkerTask" :disabled="workerSubmitting || !workerInstruction.trim()" class="btn-worker">
        {{ workerSubmitting ? '执行中...' : '执行任务' }}
      </button>
      <span v-if="workerSubmitting" class="queue-info">正在执行任务...</span>
    </div>

    <div v-if="workerMessage" :class="['message', workerMessageType]">{{ workerMessage }}</div>

    <div class="worker-list">
      <div class="worker-header-row">
        <h4>最近任务</h4>
        <div class="worker-header-actions">
          <select v-model="workerFilterStatus" class="worker-filter" @change="loadWorkerTasks">
            <option value="">全部状态</option>
            <option value="pending">等待执行</option>
            <option value="running">执行中</option>
            <option value="succeeded">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>
          <select v-model="workerFilterTaskType" class="worker-filter" @change="loadWorkerTasks">
            <option value="">全部任务</option>
            <option value="openclaw_task">OpenClaw 任务</option>
            <option value="summarize_note">笔记摘要</option>
            <option value="classify_inbox">Inbox 自动整理</option>
            <option value="extract_tasks">提取行动项</option>
            <option value="update_persona_snapshot">人格快照更新</option>
            <option value="daily_report">每日回顾</option>
            <option value="weekly_report">每周回顾</option>
          </select>
          <button class="btn-link" @click="loadWorkerTasks">刷新</button>
          <button class="btn-link btn-clear" @click="handleClearFinishedTasks">清除已结束</button>
        </div>
      </div>
      <div v-if="workerTasks.length">
        <WorkerTaskCard
          v-for="task in workerTasks"
          :key="task.id"
          :task="task"
          :busy="workerActionTaskId === task.id"
          :show-source-note="true"
          @open-detail="openWorkerTaskDetail"
          @open-output="openWorkerOutput"
          @cancel="handleCancelWorkerTask"
          @retry="handleRetryWorkerTask"
        >
          <template #extra-actions>
            <button
              v-if="task.outputNotes?.length"
              type="button"
              class="wtc-action jump"
              @click="jumpToSearch(task.outputNotes[0])"
            >
              去搜索页查看
            </button>
          </template>
        </WorkerTaskCard>
      </div>
      <div v-else class="worker-empty-state">当前筛选下没有任务</div>
    </div>

    <!-- Manual Task Entry -->
    <details class="manual-task-collapse">
      <summary class="manual-task-summary">
        <h3>手动任务入口</h3>
        <span class="manual-task-badge">补充入口</span>
      </summary>
      <p class="hint" style="margin-top:12px;margin-bottom:16px">主入口已统一走 worker task；这里保留一个手动创建 Inbox 整理任务的快捷入口。</p>
      <div class="action-row">
        <button @click="handleClassifyInbox" :disabled="classifying" class="btn-ai">
          {{ classifying ? '创建中...' : '手动整理 Inbox（创建任务）' }}
        </button>
        <span v-if="classifying" class="queue-info">正在创建 worker task...</span>
      </div>
      <div v-if="aiMessage" :class="['message', aiMessageType]">{{ aiMessage }}</div>
    </details>

    <Teleport to="body">
      <NoteDetail v-if="selectedNoteId" :note-id="selectedNoteId" @close="selectedNoteId = null" />
    </Teleport>

    <Teleport to="body">
      <WorkerTaskDetail v-if="selectedWorkerTaskId" :task-id="selectedWorkerTaskId" @close="selectedWorkerTaskId = null" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import NoteDetail from './NoteDetail.vue';
import WorkerTaskDetail from './WorkerTaskDetail.vue';
import WorkerTaskCard from './WorkerTaskCard.vue';
import { classifyInbox, createWorkerTask, fetchWorkerTasks, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks } from '../api/client';
import type { WorkerTask, WorkerTaskOutputNote, WsEvent, WorkerTaskType, WorkerTaskStatus } from '@lifeos/shared';
import { workerTaskActionMessage } from '../utils/workerTaskLabels';
import { isIndexRefreshEvent } from '../composables/useWebSocket';

const router = useRouter();

const workerSubmitting = ref(false);
const workerTasks = ref<WorkerTask[]>([]);
const workerMessage = ref('');
const workerMessageType = ref<'success' | 'error'>('success');
const workerActionTaskId = ref<string | null>(null);
const selectedNoteId = ref<string | null>(null);
const selectedWorkerTaskId = ref<string | null>(null);
const workerInstruction = ref('');
const workerDimension = ref('learning');
const workerFilterStatus = ref('');
const workerFilterTaskType = ref('');

const classifying = ref(false);
const aiMessage = ref('');
const aiMessageType = ref<'success' | 'error'>('success');

async function loadWorkerTasks() {
  try {
    workerTasks.value = await fetchWorkerTasks(8, {
      status: (workerFilterStatus.value || undefined) as WorkerTaskStatus | undefined,
      taskType: (workerFilterTaskType.value || undefined) as WorkerTaskType | undefined,
    });
  } catch (_) { /* ignore */ }
}

async function handleCreateWorkerTask() {
  workerSubmitting.value = true; workerMessage.value = '';
  try {
    const task = await createWorkerTask({ taskType: 'openclaw_task', input: { instruction: workerInstruction.value.trim(), outputDimension: workerDimension.value } });
    workerMessage.value = workerTaskActionMessage('created', task);
    workerMessageType.value = 'success';
    workerInstruction.value = '';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '关联任务创建失败'; workerMessageType.value = 'error';
  } finally { workerSubmitting.value = false; }
}

async function handleRetryWorkerTask(taskId: string) {
  workerActionTaskId.value = taskId; workerMessage.value = '';
  try {
    const task = await retryWorkerTask(taskId);
    workerMessage.value = workerTaskActionMessage('retried', task); workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '任务重试失败'; workerMessageType.value = 'error';
  } finally { workerActionTaskId.value = null; }
}

async function handleCancelWorkerTask(taskId: string) {
  workerActionTaskId.value = taskId; workerMessage.value = '';
  try {
    const task = await cancelWorkerTask(taskId);
    workerMessage.value = workerTaskActionMessage('cancelled', task); workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '任务取消失败'; workerMessageType.value = 'error';
  } finally { workerActionTaskId.value = null; }
}

async function handleClearFinishedTasks() {
  workerMessage.value = '';
  try {
    const deleted = await clearFinishedWorkerTasks();
    workerMessage.value = deleted > 0 ? `已清除 ${deleted} 条任务记录` : '没有可清除的任务';
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '清除失败'; workerMessageType.value = 'error';
  }
}

async function handleClassifyInbox() {
  classifying.value = true; aiMessage.value = '';
  try {
    const task = await classifyInbox();
    aiMessage.value = workerTaskActionMessage('created', task); aiMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    aiMessage.value = e.message || 'Inbox 整理任务创建失败'; aiMessageType.value = 'error';
  } finally { classifying.value = false; }
}

function openWorkerTaskDetail(taskId: string) { selectedWorkerTaskId.value = taskId; }
function openWorkerOutput(note: WorkerTaskOutputNote) { selectedNoteId.value = note.id; }
function jumpToSearch(note: WorkerTaskOutputNote) { router.push({ path: '/search', query: { q: note.title } }); }

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (wsEvent.type === 'worker-task-updated' || isIndexRefreshEvent(wsEvent)) { loadWorkerTasks(); }
}

onMounted(async () => {
  await loadWorkerTasks();
  document.addEventListener('ws-update', handleWsUpdate);
});
onUnmounted(() => { document.removeEventListener('ws-update', handleWsUpdate); });
</script>

<style scoped>
.settings-card { background: var(--card-bg); border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px var(--shadow); }
.settings-card h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #555; }
.hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.message { padding: 10px 14px; border-radius: 4px; font-size: 14px; margin-top: 12px; }
.message.success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
.message.error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }
.action-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.queue-info { font-size: 13px; color: #909399; }
.btn-worker { padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-worker:hover:not(:disabled) { background: #337ecc; }
.btn-worker:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ai { padding: 8px 16px; background: #67c23a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-ai:hover:not(:disabled) { background: #529b2e; }
.btn-ai:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-link { border: none; background: transparent; color: #409eff; cursor: pointer; padding: 0; }
.btn-link.btn-clear { color: #f56c6c; }
.worker-filter { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.worker-empty-state { margin-top: 12px; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; background: var(--meta-bg); color: var(--text-muted); font-size: 13px; text-align: center; }
.worker-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.worker-form .form-group { margin-bottom: 0; }
.worker-form input, .worker-form select, .worker-form textarea { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--surface); color: var(--text); box-sizing: border-box; }
.worker-form textarea { font-family: inherit; }
.worker-list { margin-top: 16px; display: grid; gap: 12px; }
.worker-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.worker-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.worker-header-row h4 { margin: 0; font-size: 14px; }

/* ─── Manual Task ─── */
.manual-task-collapse { border-color: color-mix(in srgb, var(--text-muted) 18%, var(--border)); opacity: 0.75; transition: opacity 0.2s; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); }
.manual-task-collapse[open] { opacity: 1; }
.manual-task-summary { display: flex; align-items: center; gap: 10px; cursor: pointer; list-style: none; user-select: none; }
.manual-task-summary::-webkit-details-marker { display: none; }
.manual-task-summary h3 { margin: 0; font-size: 16px; color: var(--text); }
.manual-task-badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; background: color-mix(in srgb, var(--text-muted) 14%, transparent); color: var(--text-muted); border: 1px solid color-mix(in srgb, var(--text-muted) 20%, var(--border)); }
</style>
