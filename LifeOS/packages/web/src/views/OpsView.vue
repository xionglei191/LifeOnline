<template>
  <div class="ops-view">
    <h2>运维中心</h2>

    <!-- Worker Tasks -->
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
    </div>

    <!-- Schedules -->
    <div class="settings-card">
      <h3>定时任务</h3>
      <p class="hint" style="margin-bottom:16px">配置周期性自动执行的任务，如每天定时采集热门新闻。</p>

      <div class="schedule-form">
        <div class="form-group">
          <label>名称</label>
          <input v-model="scheduleLabel" type="text" placeholder="例如：每日新闻采集" :disabled="scheduleSubmitting" />
        </div>
        <div class="form-group">
          <label>任务类型</label>
          <select v-model="scheduleTaskType" :disabled="scheduleSubmitting">
            <option value="openclaw_task">OpenClaw 通用任务</option>
            <option value="summarize_note">笔记摘要</option>
            <option value="update_persona_snapshot">人格快照更新</option>
            <option value="classify_inbox">Inbox 自动整理</option>
            <option value="daily_report">每日回顾</option>
            <option value="weekly_report">每周回顾</option>
          </select>
        </div>
        <div class="form-group">
          <label>执行频率</label>
          <select v-model="schedulePreset" :disabled="scheduleSubmitting">
            <option value="0 9 * * *">每天 9:00</option>
            <option value="0 */12 * * *">每 12 小时</option>
            <option value="0 9 * * 1-5">工作日 9:00</option>
            <option value="0 9 * * 1">每周一 9:00</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div v-if="schedulePreset === 'custom'" class="form-group">
          <label>Cron 表达式</label>
          <input v-model="scheduleCronCustom" type="text" placeholder="例如：*/5 * * * *" :disabled="scheduleSubmitting" />
        </div>
      </div>

      <div v-if="scheduleTaskType === 'openclaw_task'" class="schedule-form" style="margin-top:8px">
        <div class="form-group">
          <label>任务指令</label>
          <textarea v-model="scheduleInstruction" rows="3" placeholder="输入自然语言指令" :disabled="scheduleSubmitting"></textarea>
        </div>
        <div class="form-group">
          <label>结果归档维度（可选）</label>
          <select v-model="scheduleDimension" :disabled="scheduleSubmitting">
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

      <div class="action-row" style="margin-top:12px">
        <button @click="handleCreateSchedule" :disabled="scheduleSubmitting || !scheduleLabel.trim()" class="btn-worker">
          {{ scheduleSubmitting ? '创建中...' : '创建定时任务' }}
        </button>
      </div>

      <div v-if="scheduleMessage" :class="['message', scheduleMessageType]">{{ scheduleMessage }}</div>

      <div class="worker-list">
        <h4>定时任务列表</h4>
        <div v-if="schedules.length">
          <div v-for="s in schedules" :key="s.id" class="schedule-item">
            <!-- Edit mode -->
            <div v-if="editingScheduleId === s.id" class="schedule-edit-form">
              <div class="schedule-form">
                <div class="form-group">
                  <label>名称</label>
                  <input v-model="editLabel" type="text" />
                </div>
                <div class="form-group">
                  <label>执行频率</label>
                  <select v-model="editCronPreset">
                    <option value="0 9 * * *">每天 9:00</option>
                    <option value="0 */12 * * *">每 12 小时</option>
                    <option value="0 9 * * 1-5">工作日 9:00</option>
                    <option value="0 9 * * 1">每周一 9:00</option>
                    <option value="0 22 * * *">每天 22:00</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div v-if="editCronPreset === 'custom'" class="form-group">
                  <label>Cron 表达式</label>
                  <input v-model="editCronCustom" type="text" placeholder="例如：*/5 * * * *" />
                </div>
              </div>
              <div class="action-row" style="margin-top:8px">
                <button class="btn-worker" @click="handleSaveScheduleEdit(s.id)" :disabled="!editLabel.trim()">保存</button>
                <button class="btn-cancel" @click="editingScheduleId = null">取消</button>
              </div>
            </div>
            <!-- Display mode -->
            <template v-else>
            <div class="schedule-item-top">
              <div class="schedule-info">
                <span class="schedule-label">{{ s.label }}</span>
                <span class="worker-pill">{{ taskTypeLabel(s.taskType) }}</span>
                <span class="worker-pill">{{ s.cronExpression }}</span>
              </div>
              <div class="schedule-actions">
                <button class="btn-run-now" :disabled="scheduleRunningId === s.id" @click="handleRunScheduleNow(s.id)">
                  {{ scheduleRunningId === s.id ? '执行中...' : '立即执行' }}
                </button>
                <button class="btn-edit-sm" @click="startEditSchedule(s)">编辑</button>
                <button class="toggle-btn" :class="{ active: s.enabled }" @click="handleToggleSchedule(s)">
                  {{ s.enabled ? '已启用' : '已禁用' }}
                </button>
                <button class="btn-danger-sm" @click="handleDeleteSchedule(s.id)">删除</button>
              </div>
            </div>
            <div class="schedule-meta">
              <span v-if="s.lastRunAt">上次执行: {{ formatTime(s.lastRunAt) }}</span>
              <span v-else>尚未执行</span>
              <span v-if="s.consecutiveFailures" class="schedule-failures"> · 连续失败 {{ s.consecutiveFailures }} 次</span>
            </div>
            <div v-if="s.lastError" class="schedule-error">{{ s.lastError }}</div>
            </template>
          </div>
        </div>
        <div v-else class="worker-empty-state">暂无定时任务</div>
      </div>
    </div>

    <!-- Manual Task Entry -->
    <details class="settings-card manual-task-collapse">
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
import NoteDetail from '../components/NoteDetail.vue';
import WorkerTaskDetail from '../components/WorkerTaskDetail.vue';
import WorkerTaskCard from '../components/WorkerTaskCard.vue';
import { classifyInbox, createWorkerTask, fetchWorkerTasks, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks, createTaskSchedule, fetchTaskSchedules, updateTaskSchedule, deleteTaskSchedule, runTaskScheduleNow } from '../api/client';
import type { WorkerTask, WorkerTaskOutputNote, TaskSchedule, WsEvent } from '@lifeos/shared';
import { workerTaskActionMessage, workerTaskTypeLabel } from '../utils/workerTaskLabels';
import { useWebSocket, isIndexRefreshEvent } from '../composables/useWebSocket';

const router = useRouter();
const { isConnected } = useWebSocket();

// ── Worker Task State ──────────────────────────────────
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

// ── Schedule State ─────────────────────────────────────
const schedules = ref<TaskSchedule[]>([]);
const scheduleLabel = ref('');
const scheduleTaskType = ref<'openclaw_task' | 'summarize_note' | 'classify_inbox' | 'daily_report' | 'weekly_report'>('openclaw_task');
const schedulePreset = ref('0 9 * * *');
const scheduleCronCustom = ref('');
const scheduleInstruction = ref('');
const scheduleDimension = ref('learning');
const scheduleSubmitting = ref(false);
const scheduleMessage = ref('');
const scheduleMessageType = ref<'success' | 'error'>('success');
const scheduleRunningId = ref<string | null>(null);
const editingScheduleId = ref<string | null>(null);
const editLabel = ref('');
const editCronPreset = ref('');
const editCronCustom = ref('');

// ── Data Loading ───────────────────────────────────────
async function loadWorkerTasks() {
  try {
    workerTasks.value = await fetchWorkerTasks(8, {
      status: (workerFilterStatus.value || undefined) as any,
      taskType: (workerFilterTaskType.value || undefined) as any,
    });
  } catch (_) { /* ignore */ }
}

async function loadSchedules() {
  try {
    schedules.value = await fetchTaskSchedules();
  } catch (_) { /* ignore */ }
}

// ── Worker Task Handlers ───────────────────────────────
async function handleCreateWorkerTask() {
  workerSubmitting.value = true;
  workerMessage.value = '';
  try {
    const task = await createWorkerTask({ taskType: 'openclaw_task', input: { instruction: workerInstruction.value.trim(), outputDimension: workerDimension.value } });
    workerMessage.value = workerTaskActionMessage('created', task);
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '关联任务创建失败';
    workerMessageType.value = 'error';
  } finally {
    workerSubmitting.value = false;
  }
}

async function handleRetryWorkerTask(taskId: string) {
  workerActionTaskId.value = taskId; workerMessage.value = '';
  try {
    const task = await retryWorkerTask(taskId);
    workerMessage.value = workerTaskActionMessage('retried', task);
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '任务重试失败';
    workerMessageType.value = 'error';
  } finally { workerActionTaskId.value = null; }
}

async function handleCancelWorkerTask(taskId: string) {
  workerActionTaskId.value = taskId; workerMessage.value = '';
  try {
    const task = await cancelWorkerTask(taskId);
    workerMessage.value = workerTaskActionMessage('cancelled', task);
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '任务取消失败';
    workerMessageType.value = 'error';
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
    workerMessage.value = e.message || '清除失败';
    workerMessageType.value = 'error';
  }
}

async function handleClassifyInbox() {
  classifying.value = true; aiMessage.value = '';
  try {
    const task = await classifyInbox();
    aiMessage.value = workerTaskActionMessage('created', task);
    aiMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    aiMessage.value = e.message || 'Inbox 整理任务创建失败';
    aiMessageType.value = 'error';
  } finally { classifying.value = false; }
}

function openWorkerTaskDetail(taskId: string) { selectedWorkerTaskId.value = taskId; }
function openWorkerOutput(note: WorkerTaskOutputNote) { selectedNoteId.value = note.id; }
function jumpToSearch(note: WorkerTaskOutputNote) { router.push({ path: '/search', query: { q: note.title } }); }

// ── Schedule Handlers ──────────────────────────────────
const KNOWN_CRONS = ['0 9 * * *', '0 */12 * * *', '0 9 * * 1-5', '0 9 * * 1', '0 22 * * *'];

async function handleCreateSchedule() {
  scheduleSubmitting.value = true; scheduleMessage.value = '';
  try {
    const cronExpr = schedulePreset.value === 'custom' ? scheduleCronCustom.value : schedulePreset.value;
    let input: any = undefined;
    if (scheduleTaskType.value === 'openclaw_task') {
      input = { instruction: scheduleInstruction.value.trim(), outputDimension: scheduleDimension.value };
    } else if (scheduleTaskType.value === 'summarize_note' || scheduleTaskType.value === 'update_persona_snapshot') {
      throw new Error('该任务类型需要绑定具体笔记，暂不支持在运维页创建定时任务');
    }
    await createTaskSchedule({ taskType: scheduleTaskType.value, cronExpression: cronExpr, label: scheduleLabel.value.trim(), input });
    scheduleMessage.value = '定时任务已创建';
    scheduleMessageType.value = 'success';
    scheduleLabel.value = '';
    await loadSchedules();
  } catch (e: any) {
    scheduleMessage.value = e.message || '创建失败';
    scheduleMessageType.value = 'error';
  } finally { scheduleSubmitting.value = false; }
}

async function handleToggleSchedule(s: TaskSchedule) {
  try { await updateTaskSchedule(s.id, { enabled: !s.enabled }); await loadSchedules(); }
  catch (e: any) { scheduleMessage.value = e.message || '操作失败'; scheduleMessageType.value = 'error'; }
}

async function handleDeleteSchedule(id: string) {
  try { await deleteTaskSchedule(id); await loadSchedules(); }
  catch (e: any) { scheduleMessage.value = e.message || '删除失败'; scheduleMessageType.value = 'error'; }
}

function startEditSchedule(s: TaskSchedule) {
  editingScheduleId.value = s.id;
  editLabel.value = s.label;
  if (KNOWN_CRONS.includes(s.cronExpression)) { editCronPreset.value = s.cronExpression; editCronCustom.value = ''; }
  else { editCronPreset.value = 'custom'; editCronCustom.value = s.cronExpression; }
}

async function handleSaveScheduleEdit(id: string) {
  try {
    const cronExpr = editCronPreset.value === 'custom' ? editCronCustom.value : editCronPreset.value;
    await updateTaskSchedule(id, { label: editLabel.value.trim(), cronExpression: cronExpr });
    editingScheduleId.value = null;
    scheduleMessage.value = '定时任务已更新'; scheduleMessageType.value = 'success';
    await loadSchedules();
  } catch (e: any) { scheduleMessage.value = e.message || '更新失败'; scheduleMessageType.value = 'error'; }
}

async function handleRunScheduleNow(id: string) {
  scheduleRunningId.value = id; scheduleMessage.value = '';
  try {
    await runTaskScheduleNow(id);
    scheduleMessage.value = '已触发立即执行';
    scheduleMessageType.value = 'success';
    await loadSchedules(); await loadWorkerTasks();
  } catch (e: any) {
    scheduleMessage.value = e.message || '执行失败'; scheduleMessageType.value = 'error';
  } finally { scheduleRunningId.value = null; }
}

// ── Helpers ────────────────────────────────────────────
function taskTypeLabel(taskType: string): string { return workerTaskTypeLabel(taskType); }
function formatTime(ts: string) { return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }

// ── WebSocket ──────────────────────────────────────────
function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (wsEvent.type === 'worker-task-updated' || isIndexRefreshEvent(wsEvent)) { loadWorkerTasks(); }
  if (wsEvent.type === 'schedule-updated') { loadSchedules(); }
}

onMounted(async () => {
  await loadWorkerTasks();
  await loadSchedules();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});
</script>

<style scoped>
.ops-view { max-width: 800px; margin: 0 auto; }
.ops-view h2 { font-size: 22px; margin-bottom: 20px; }

/* ─── Shared styles ─── */
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
.btn-cancel { padding: 8px 18px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; font-size: 14px; background: var(--surface-muted); color: var(--text-secondary); }
.worker-filter { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.worker-pill { padding: 3px 8px; border-radius: 999px; background: var(--card-bg); border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-family: monospace; }
.worker-empty-state { margin-top: 12px; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; background: var(--meta-bg); color: var(--text-muted); font-size: 13px; text-align: center; }
.worker-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.worker-form .form-group { margin-bottom: 0; }
.worker-form input, .worker-form select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--surface); color: var(--text); box-sizing: border-box; }
.worker-list { margin-top: 16px; display: grid; gap: 12px; }
.worker-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.worker-header-actions { display: flex; align-items: center; gap: 10px; }
.worker-header-row h4 { margin: 0; font-size: 14px; }

/* ─── Schedule ─── */
.schedule-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.schedule-form .form-group { margin-bottom: 0; }
.schedule-form input, .schedule-form select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--surface); color: var(--text); box-sizing: border-box; }
.schedule-item { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--meta-bg); margin-top: 8px; }
.schedule-item-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.schedule-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.schedule-label { font-size: 14px; font-weight: 500; color: var(--text); }
.schedule-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.schedule-meta { margin-top: 6px; font-size: 12px; color: var(--text-muted); }
.schedule-error { margin-top: 4px; font-size: 12px; color: #f56c6c; }
.schedule-failures { color: #f56c6c; }
.schedule-edit-form { padding: 12px; border: 1px dashed var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-muted) 40%, transparent); }
.schedule-edit-form .btn-cancel { padding: 6px 14px; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 12px; margin-left: 8px; }
.btn-run-now { padding: 6px 14px; border: 1px solid color-mix(in srgb, #409eff 30%, var(--border)); border-radius: 999px; background: color-mix(in srgb, #409eff 10%, transparent); color: #409eff; cursor: pointer; font-size: 12px; }
.btn-run-now:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-edit-sm { padding: 6px 14px; border: 1px solid color-mix(in srgb, var(--signal) 30%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--signal) 10%, transparent); color: var(--signal, #409eff); cursor: pointer; font-size: 12px; }
.toggle-btn { flex-shrink: 0; padding: 6px 16px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-muted); color: var(--text-secondary); cursor: pointer; font-size: 13px; transition: all 0.2s; }
.toggle-btn.active { border-color: color-mix(in srgb, var(--ok) 40%, var(--border)); background: color-mix(in srgb, var(--ok) 12%, transparent); color: var(--ok); }
.btn-danger-sm { padding: 6px 14px; border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); cursor: pointer; font-size: 12px; }

/* ─── Manual Task ─── */
.manual-task-collapse { border-color: color-mix(in srgb, var(--text-muted) 18%, var(--border)); opacity: 0.75; transition: opacity 0.2s; }
.manual-task-collapse[open] { opacity: 1; }
.manual-task-summary { display: flex; align-items: center; gap: 10px; cursor: pointer; list-style: none; user-select: none; }
.manual-task-summary::-webkit-details-marker { display: none; }
.manual-task-summary h3 { margin: 0; }
.manual-task-badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; background: color-mix(in srgb, var(--text-muted) 14%, transparent); color: var(--text-muted); border: 1px solid color-mix(in srgb, var(--text-muted) 20%, var(--border)); }
</style>
