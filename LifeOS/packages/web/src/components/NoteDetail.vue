<template>
  <Teleport to="body">
    <div v-if="currentNoteId" class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <div class="modal-card" :style="{ '--dimension-color': note ? dimensionColor(note.dimension) : 'var(--signal)' }">
        <button class="close-btn" @click="$emit('close')" aria-label="关闭详情">×</button>

        <div v-if="loading" class="state-card">正在调取记录详情...</div>
        <div v-else-if="error" class="state-card error-state">{{ error.message }}</div>
        <div v-else-if="note" class="note-content">
          <!-- Approval Card for OpenClaw approval requests -->
          <section v-if="isApprovalNote" class="approval-card">
            <div class="approval-header">
              <span class="approval-icon">🔔</span>
              <h3>OpenClaw 审批请求</h3>
            </div>

            <div class="approval-details">
              <div class="detail-row">
                <span class="detail-label">操作类型</span>
                <strong>{{ note.approval_operation || note.approval_action || 'N/A' }}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">风险等级</span>
                <strong :class="'risk-' + note.approval_risk">{{ note.approval_risk || 'N/A' }}</strong>
              </div>
              <div v-if="note.approval_scope" class="detail-row">
                <span class="detail-label">影响范围</span>
                <strong>{{ note.approval_scope }}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">状态</span>
                <strong :class="'status-' + note.approval_status">{{ note.approval_status || 'pending' }}</strong>
              </div>
              <div v-if="note.due" class="detail-row">
                <span class="detail-label">过期时间</span>
                <strong>{{ note.due }}</strong>
              </div>
            </div>

            <div class="approval-content">
              <p class="panel-kicker">原因</p>
              <div class="markdown-body" v-html="renderedContent"></div>
            </div>

            <div v-if="note.approval_status === 'pending'" class="approval-actions">
              <button @click="handleApprove" :disabled="saving" class="btn-approve">
                {{ saving ? '处理中...' : '✅ 批准' }}
              </button>
              <button @click="handleReject" :disabled="saving" class="btn-reject">
                {{ saving ? '处理中...' : '❌ 拒绝' }}
              </button>
            </div>
            <div v-else class="approval-result">
              审批已{{ note.approval_status === 'approved' ? '批准' : '拒绝' }}
            </div>
          </section>

          <!-- Normal Note Content -->
          <template v-else>
          <header class="note-hero">
            <div class="hero-copy">
              <p class="hero-kicker">Record Detail</p>
              <h2>{{ note.file_name.replace('.md', '') }}</h2>
              <div class="hero-meta">
                <span class="meta-pill dimension">{{ dimensionLabels[note.dimension] }}</span>
                <span class="meta-pill">{{ typeLabels[note.type] || note.type }}</span>
                <span class="meta-pill status" :class="'status-' + note.status">{{ statusLabels[note.status] }}</span>
                <span v-if="note.priority" class="meta-pill priority" :class="'priority-' + note.priority">{{ priorityLabels[note.priority] }}</span>
              </div>
            </div>

            <div class="hero-facts">
              <div class="fact">
                <span class="fact-label">日期</span>
                <strong>{{ note.date }}</strong>
              </div>
              <div v-if="note.due" class="fact">
                <span class="fact-label">截止</span>
                <strong>{{ note.due }}</strong>
              </div>
            </div>
          </header>

          <div v-if="note.tags?.length" class="tags">
            <span v-for="tag in note.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>

          <section class="control-grid">
            <div class="control-panel">
              <p class="panel-kicker">Status Control</p>
              <div class="btn-group">
                <button
                  v-for="s in statuses"
                  :key="s.value"
                  @click="handleUpdateStatus(s.value)"
                  :disabled="saving || note.status === s.value"
                  :class="['action-btn', { active: note.status === s.value }]"
                >
                  {{ s.label }}
                </button>
              </div>
            </div>

            <div class="control-panel">
              <p class="panel-kicker">Priority Control</p>
              <div class="btn-group">
                <button
                  v-for="p in priorities"
                  :key="p.value"
                  @click="handleUpdatePriority(p.value)"
                  :disabled="saving || note.priority === p.value"
                  :class="['action-btn', { active: note.priority === p.value }]"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
          </section>

          <section class="append-section">
            <div class="append-head">
              <p class="panel-kicker">Append Log</p>
              <span class="append-hint">追加说明、复盘或上下文</span>
            </div>
            <textarea v-model="appendText" placeholder="添加备注..." rows="4" class="append-input" :disabled="saving"></textarea>
            <div class="append-actions">
              <button @click="handleAppend" :disabled="saving || !appendText.trim()" class="primary-btn">
                {{ saving ? '保存中...' : '添加备注' }}
              </button>
              <span v-if="saveMsg" :class="['save-msg', saveMsgType]">{{ saveMsg }}</span>
            </div>
          </section>

          <section class="append-section danger-section">
            <div class="append-head">
              <div>
                <p class="panel-kicker">Danger Zone</p>
                <span class="append-hint">删除 Vault 中的真实 Markdown 文件</span>
              </div>
              <button @click="showDeleteConfirm = true" :disabled="saving || deleting" class="danger-btn">
                删除笔记
              </button>
            </div>
          </section>

          <section class="body-content">
            <div class="body-head">
              <p class="panel-kicker">Markdown</p>
            </div>
            <PrivacyMask :privacy="note.privacy || 'private'">
              <div class="markdown-body" v-html="renderedContent"></div>
            </PrivacyMask>
          </section>

          <section class="ai-panel">
            <div class="append-head">
              <p class="panel-kicker">External Worker Task</p>
              <span class="append-hint">基于当前笔记内容发起按需外部任务</span>
            </div>
            <div class="worker-form-grid">
              <div class="worker-field" style="grid-column: 1 / -1">
                <label>任务指令</label>
                <textarea v-model="workerInstruction" rows="2" placeholder="输入自然语言指令，例如：搜索相关领域最新进展" :disabled="workerSubmitting"></textarea>
              </div>
              <div class="worker-field">
                <label>结果归档维度</label>
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
            <div class="ai-actions">
              <button @click="handleCreateOpenClawTask" :disabled="workerSubmitting || !workerInstruction.trim()" class="primary-btn secondary">
                {{ workerSubmitting ? '发起中...' : '执行 OpenClaw 任务' }}
              </button>
              <button @click="handleCreateSummarizeTask" :disabled="workerSubmitting" class="primary-btn secondary">
                {{ workerSubmitting ? '发起中...' : '生成笔记摘要' }}
              </button>
            </div>
            <div v-if="workerMessage" :class="['inline-msg', workerMessageType]">{{ workerMessage }}</div>
          </section>

          <section class="ai-panel">
            <div class="append-head">
              <p class="panel-kicker">Recent External Tasks</p>
              <span class="append-hint">展示由当前笔记发起的最近任务</span>
            </div>
            <div class="related-worker-toolbar">
              <select v-model="relatedWorkerFilterStatus" class="related-worker-filter" @change="handleRelatedWorkerFilterChange">
                <option value="">全部状态</option>
                <option value="pending">等待执行</option>
                <option value="running">执行中</option>
                <option value="succeeded">已完成</option>
                <option value="failed">失败</option>
                <option value="cancelled">已取消</option>
              </select>
              <button type="button" class="btn-link" @click="reloadRelatedWorkerTasks">刷新</button>
            </div>
            <div v-if="relatedWorkerTasks.length" class="related-worker-list">
              <WorkerTaskCard
                v-for="task in relatedWorkerTasks"
                :key="task.id"
                :task="task"
                :busy="workerActionTaskId === task.id"
                @open-detail="openRelatedWorkerTaskDetail"
                @open-output="(output) => openRelatedWorkerOutput(output.id)"
                @cancel="handleCancelRelatedTask"
                @retry="handleRetryRelatedTask"
              />
            </div>
            <div v-else class="empty-worker-tasks">{{ relatedWorkerFilterStatus ? '当前筛选下没有关联任务' : '当前笔记还没有发起过外部任务' }}</div>
          </section>

          <section class="ai-panel">
            <div class="append-head">
              <p class="panel-kicker">Task Extraction</p>
              <span class="append-hint">将当前笔记的行动项提取为 worker task，并在下方关联任务中查看结果</span>
            </div>
            <div class="ai-actions">
              <button @click="handleExtractTasks" :disabled="extracting" class="primary-btn secondary">
                {{ extracting ? '发起中...' : '提取行动项' }}
              </button>
              <span v-if="extracting" class="extract-hint">正在创建 worker task...</span>
            </div>
          </section>
          </template>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showDeleteConfirm && note" class="confirm-overlay" @click.self="showDeleteConfirm = false">
        <div class="confirm-card">
          <h3>删除笔记</h3>
          <p>将删除 Vault 中的真实 Markdown 文件，删除后该笔记会从看板中消失。</p>
          <p class="confirm-note">当前笔记：{{ note.file_name.replace('.md', '') }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showDeleteConfirm = false" :disabled="deleting">取消</button>
            <button class="btn-confirm-danger" @click="handleDelete" :disabled="deleting">
              {{ deleting ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <WorkerTaskDetail v-if="selectedWorkerTaskId" :task-id="selectedWorkerTaskId" @close="selectedWorkerTaskId = null" />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { fetchNoteById, extractTasks, updateNote, appendNote as appendNoteApi, deleteNote as deleteNoteApi, createWorkerTask, fetchWorkerTasks, retryWorkerTask, cancelWorkerTask } from '../api/client';
import type { Note, WorkerTask, WsEvent } from '@lifeos/shared';
import PrivacyMask from './PrivacyMask.vue';
import WorkerTaskDetail from './WorkerTaskDetail.vue';
import WorkerTaskCard from './WorkerTaskCard.vue';
import { isIndexRefreshEvent } from '../composables/useWebSocket';
import { decryptContent, getEncryptionKey } from '../utils/crypto';

const props = defineProps<{ noteId: string | null }>();
const emit = defineEmits<{ close: []; deleted: [] }>();

const currentNoteId = ref<string | null>(null);
const note = ref<(Note & { encrypted?: boolean; approval_status?: string; approval_operation?: string; approval_risk?: string; approval_scope?: string }) | null>(null);
const loading = ref(false);
const error = ref<Error | null>(null);
const extracting = ref(false);
const workerSubmitting = ref(false);
const workerMessage = ref('');
const workerMessageType = ref<'success' | 'error'>('success');
const workerInstruction = ref('');
const workerDimension = ref('learning');
const relatedWorkerTasks = ref<WorkerTask[]>([]);
const relatedWorkerFilterStatus = ref('');
const workerActionTaskId = ref<string | null>(null);
const selectedWorkerTaskId = ref<string | null>(null);
const saving = ref(false);
const deleting = ref(false);
const showDeleteConfirm = ref(false);
const appendText = ref('');
const saveMsg = ref('');
const saveMsgType = ref<'success' | 'error'>('success');
const decryptedContent = ref<string | null>(null);

const isApprovalNote = computed(() => {
  return note.value && note.value.approval_status != null && note.value.approval_status !== '';
});

const renderedContent = computed(() => {
  if (!note.value?.content) return '<p>暂无正文内容。</p>';

  // Use decrypted content if available
  const content = decryptedContent.value || note.value.content;

  // If encrypted but not decrypted, show placeholder
  if (note.value.encrypted && !decryptedContent.value) {
    return '<p class="encrypted-placeholder">🔒 内容已加密，需要解锁后查看</p>';
  }

  const html = marked.parse(content) as string;
  return DOMPurify.sanitize(html);
});

const statuses = [
  { value: 'pending', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '完成' },
  { value: 'cancelled', label: '取消' },
];

const priorities = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const dimensionLabels: Record<string, string> = {
  health: '健康',
  career: '事业',
  finance: '财务',
  learning: '学习',
  relationship: '关系',
  life: '生活',
  hobby: '兴趣',
  growth: '成长',
};

const dimensionColors: Record<string, string> = {
  health: 'var(--dim-health)',
  career: 'var(--dim-career)',
  finance: 'var(--dim-finance)',
  learning: 'var(--dim-learning)',
  relationship: 'var(--dim-relationship)',
  life: 'var(--dim-life)',
  hobby: 'var(--dim-hobby)',
  growth: 'var(--dim-growth)',
};

const statusLabels: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  done: '完成',
  cancelled: '取消',
};

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const typeLabels: Record<string, string> = {
  task: '任务',
  schedule: '日程',
  note: '笔记',
  record: '记录',
  milestone: '里程碑',
  review: '复盘',
};

function dimensionColor(dimension: string) {
  return dimensionColors[dimension] || 'var(--signal)';
}

function workerTaskTypeLabel(taskType: WorkerTask['taskType']) {
  if (taskType === 'openclaw_task') return 'OpenClaw 任务';
  if (taskType === 'summarize_note') return '笔记摘要';
  if (taskType === 'classify_inbox') return 'Inbox 整理';
  if (taskType === 'extract_tasks') return '提取行动项';
  if (taskType === 'update_persona_snapshot') return '人格快照更新';
  if (taskType === 'daily_report') return '每日回顾';
  if (taskType === 'weekly_report') return '每周回顾';
  return taskType;
}

function workerTaskWorkerLabel(worker: WorkerTask['worker']) {
  if (worker === 'lifeos') return 'LifeOS';
  if (worker === 'openclaw') return 'OpenClaw';
  return worker;
}

function workerTaskStatusLabel(status: WorkerTask['status']) {
  if (status === 'pending') return '等待执行';
  if (status === 'running') return '执行中';
  if (status === 'succeeded') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'cancelled') return '已取消';
  return status;
}

function workerTaskActionMessage(action: 'created' | 'retried' | 'cancelled', task: WorkerTask) {
  const prefix = action === 'created' ? '已创建任务' : action === 'retried' ? '已重新入队任务' : '已取消任务';
  return `${prefix} ${task.id} · ${workerTaskTypeLabel(task.taskType)} · ${workerTaskStatusLabel(task.status)} · ${workerTaskWorkerLabel(task.worker)}`;
}

async function loadRelatedWorkerTasks(sourceNoteId: string) {
  try {
    relatedWorkerTasks.value = await fetchWorkerTasks(5, {
      sourceNoteId,
      status: (relatedWorkerFilterStatus.value || undefined) as any,
    });
  } catch {
    relatedWorkerTasks.value = [];
  }
}

async function reloadRelatedWorkerTasks() {
  if (!currentNoteId.value) return;
  await loadRelatedWorkerTasks(currentNoteId.value);
}

async function handleRelatedWorkerFilterChange() {
  await reloadRelatedWorkerTasks();
}

watch(() => props.noteId, (id) => {
  currentNoteId.value = id;
}, { immediate: true });

watch(currentNoteId, async (id) => {
  if (!id) {
    note.value = null;
    decryptedContent.value = null;
    relatedWorkerTasks.value = [];
    showDeleteConfirm.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  workerMessage.value = '';
  workerInstruction.value = '';
  workerDimension.value = 'learning';
  relatedWorkerFilterStatus.value = '';
  appendText.value = '';
  saveMsg.value = '';
  decryptedContent.value = null;
  showDeleteConfirm.value = false;
  try {
    note.value = await fetchNoteById(id) as any;
    workerInstruction.value = '';
    await loadRelatedWorkerTasks(id);

    // Auto-decrypt if encrypted
    if (note.value?.encrypted && note.value.content) {
      try {
        const key = getEncryptionKey();
        decryptedContent.value = await decryptContent(note.value.content, key);
      } catch (e) {
        console.error('Auto-decrypt failed:', e);
      }
    }
  } catch (e) {
    error.value = e as Error;
  } finally {
    loading.value = false;
  }
}, { immediate: true });

async function handleUpdateStatus(status: string) {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try {
    await updateNote(currentNoteId.value, { status });
    note.value = { ...note.value, status };
    showMsg('状态已更新', 'success');
  } catch (e: any) {
    showMsg(e.message || '更新失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleUpdatePriority(priority: string) {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try {
    await updateNote(currentNoteId.value, { priority });
    note.value = { ...note.value, priority };
    showMsg('优先级已更新', 'success');
  } catch (e: any) {
    showMsg(e.message || '更新失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleAppend() {
  if (!currentNoteId.value || !appendText.value.trim()) return;
  saving.value = true;
  try {
    await appendNoteApi(currentNoteId.value, appendText.value.trim());
    appendText.value = '';
    showMsg('备注已添加', 'success');
    note.value = await fetchNoteById(currentNoteId.value);
  } catch (e: any) {
    showMsg(e.message || '添加失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleExtractTasks() {
  if (!currentNoteId.value) return;
  extracting.value = true;
  workerMessage.value = '';
  try {
    const task = await extractTasks(currentNoteId.value);
    await loadRelatedWorkerTasks(currentNoteId.value);
    workerMessage.value = workerTaskActionMessage('created', task);
    workerMessageType.value = 'success';
  } catch (e: any) {
    workerMessage.value = e.message || '行动项提取任务创建失败';
    workerMessageType.value = 'error';
  } finally {
    extracting.value = false;
  }
}

async function handleCreateOpenClawTask() {
  if (!currentNoteId.value || !note.value) return;
  workerSubmitting.value = true;
  workerMessage.value = '';
  try {
    const task = await createWorkerTask({
      taskType: 'openclaw_task',
      sourceNoteId: currentNoteId.value,
      input: {
        instruction: workerInstruction.value.trim(),
        outputDimension: workerDimension.value,
      },
    });
    await loadRelatedWorkerTasks(currentNoteId.value);
    workerMessage.value = workerTaskActionMessage('created', task);
    workerMessageType.value = 'success';
  } catch (e: any) {
    workerMessage.value = e.message || '外部任务创建失败';
    workerMessageType.value = 'error';
  } finally {
    workerSubmitting.value = false;
  }
}

async function handleCreateSummarizeTask() {
  if (!currentNoteId.value || !note.value) return;
  workerSubmitting.value = true;
  workerMessage.value = '';
  try {
    const task = await createWorkerTask({
      taskType: 'summarize_note',
      sourceNoteId: currentNoteId.value,
      input: {
        noteId: currentNoteId.value,
      },
    });
    await loadRelatedWorkerTasks(currentNoteId.value);
    workerMessage.value = workerTaskActionMessage('created', task);
    workerMessageType.value = 'success';
  } catch (e: any) {
    workerMessage.value = e.message || '摘要任务创建失败';
    workerMessageType.value = 'error';
  } finally {
    workerSubmitting.value = false;
  }
}

async function handleRetryRelatedTask(taskId: string) {
  if (!currentNoteId.value) return;
  workerActionTaskId.value = taskId;
  workerMessage.value = '';
  try {
    const task = await retryWorkerTask(taskId);
    await loadRelatedWorkerTasks(currentNoteId.value);
    workerMessage.value = workerTaskActionMessage('retried', task);
    workerMessageType.value = 'success';
  } catch (e: any) {
    workerMessage.value = e.message || '任务重试失败';
    workerMessageType.value = 'error';
  } finally {
    workerActionTaskId.value = null;
  }
}

async function handleCancelRelatedTask(taskId: string) {
  if (!currentNoteId.value) return;
  workerActionTaskId.value = taskId;
  workerMessage.value = '';
  try {
    const task = await cancelWorkerTask(taskId);
    await loadRelatedWorkerTasks(currentNoteId.value);
    workerMessage.value = workerTaskActionMessage('cancelled', task);
    workerMessageType.value = 'success';
  } catch (e: any) {
    workerMessage.value = e.message || '任务取消失败';
    workerMessageType.value = 'error';
  } finally {
    workerActionTaskId.value = null;
  }
}

async function handleApprove() {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try {
    await updateNote(currentNoteId.value, { approval_status: 'approved', status: 'done' });
    note.value = { ...note.value, approval_status: 'approved', status: 'done' };
    showMsg('审批已批准', 'success');
  } catch (e: any) {
    showMsg(e.message || '操作失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleReject() {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try {
    await updateNote(currentNoteId.value, { approval_status: 'rejected', status: 'done' });
    note.value = { ...note.value, approval_status: 'rejected', status: 'done' };
    showMsg('审批已拒绝', 'success');
  } catch (e: any) {
    showMsg(e.message || '操作失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!currentNoteId.value || !note.value || deleting.value) return;
  deleting.value = true;
  try {
    await deleteNoteApi(currentNoteId.value);
    showDeleteConfirm.value = false;
    showMsg('笔记已删除', 'success');
    emit('deleted');
    emit('close');
  } catch (e: any) {
    showMsg(e.message || '删除失败', 'error');
  } finally {
    deleting.value = false;
  }
}

function openRelatedWorkerOutput(noteId: string) {
  currentNoteId.value = noteId;
}

function openRelatedWorkerTaskDetail(taskId: string) {
  selectedWorkerTaskId.value = taskId;
}

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (!currentNoteId.value) return;
  if (wsEvent.type === 'worker-task-updated' || isIndexRefreshEvent(wsEvent)) {
    loadRelatedWorkerTasks(currentNoteId.value);
  }
}

onMounted(() => {
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});

function showMsg(msg: string, type: 'success' | 'error') {
  saveMsg.value = msg;
  saveMsgType.value = type;
  setTimeout(() => {
    saveMsg.value = '';
  }, 2500);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(4, 11, 20, 0.62);
  backdrop-filter: blur(12px);
  z-index: 1000;
}

.modal-card {
  position: relative;
  width: min(980px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--dimension-color) 22%, var(--border));
  border-radius: 30px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--dimension-color) 8%, transparent), transparent 26%),
    color-mix(in srgb, var(--surface-strong) 95%, transparent);
  box-shadow: 0 40px 80px -42px var(--shadow-strong);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.state-card {
  padding: 24px;
  border-radius: 20px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.error-state {
  color: var(--danger);
}

.note-content {
  display: grid;
  gap: 18px;
}

.note-hero,
.control-panel,
.append-section,
.body-content,
.ai-panel,
.danger-section {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}

.note-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(14rem, 0.8fr);
  gap: 18px;
  padding: 22px;
  border-radius: 24px;
}

.hero-kicker,
.panel-kicker {
  margin: 0 0 6px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero-copy h2 {
  margin: 0;
  font-size: clamp(1.8rem, 1.5rem + 1vw, 2.6rem);
  line-height: 1.05;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.meta-pill,
.tag,
.task-priority,
.task-due {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
}

.meta-pill {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.meta-pill.dimension {
  background: color-mix(in srgb, var(--dimension-color) 14%, transparent);
  color: var(--dimension-color);
}

.status-pending {
  color: var(--signal);
}

.status-in_progress {
  color: var(--warn);
}

.status-done {
  color: var(--ok);
}

.status-cancelled {
  color: var(--text-muted);
}

.priority-high {
  color: var(--danger);
}

.priority-medium {
  color: var(--warn);
}

.priority-low {
  color: var(--accent);
}

.hero-facts {
  display: grid;
  gap: 12px;
}

.fact {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-muted) 86%, transparent);
}

.fact-label {
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.control-panel,
.append-section,
.body-content,
.ai-panel,
.danger-section {
  padding: 20px;
  border-radius: 22px;
}

.btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn,
.primary-btn,
.danger-btn {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-muted) 86%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
}

.action-btn.active,
.primary-btn {
  border-color: color-mix(in srgb, var(--dimension-color) 28%, var(--border));
  background: color-mix(in srgb, var(--dimension-color) 12%, transparent);
  color: var(--dimension-color);
}

.action-btn:disabled,
.primary-btn:disabled,
.danger-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.append-head,
.body-head,
.ai-actions,
.append-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.append-hint,
.extract-hint {
  color: var(--text-muted);
  font-size: 0.84rem;
}

.append-input {
  width: 100%;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  color: var(--text);
  resize: vertical;
}

.append-actions {
  margin-top: 12px;
}

.save-msg {
  font-size: 0.84rem;
}

.save-msg.success {
  color: var(--ok);
}

.save-msg.error {
  color: var(--danger);
}

.inline-msg {
  margin-top: 12px;
  font-size: 0.84rem;
}

.inline-msg.success {
  color: var(--ok);
}

.inline-msg.error {
  color: var(--danger);
}

.worker-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.worker-field {
  display: grid;
  gap: 6px;
}

.worker-field label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.worker-field input,
.worker-field select {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  color: var(--text);
}

.related-worker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  margin-bottom: 10px;
}

.related-worker-filter {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.related-worker-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.related-worker-item {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: grid;
  gap: 6px;
}

.related-worker-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.related-worker-status {
  font-size: 12px;
}

.related-worker-meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.related-worker-pill {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--text-muted) 20%, var(--border));
  background: color-mix(in srgb, var(--surface-muted) 50%, transparent);
  color: var(--text-muted);
  font-size: 11px;
  font-family: monospace;
}

.related-worker-meta,
.related-worker-summary,
.related-worker-params,
.related-worker-error {
  font-size: 13px;
  color: var(--text-secondary);
}

.related-worker-error {
  color: var(--danger);
}

.related-worker-output {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.related-worker-output-item {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: none;
  cursor: pointer;
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  color: var(--ok);
}

.related-worker-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.related-worker-action {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 12px;
  color: var(--signal);
}

.related-worker-action.danger {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
}

.related-worker-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-worker-tasks {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.markdown-body {
  color: var(--text-secondary);
  line-height: 1.75;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: var(--text);
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  padding: 14px;
  border-radius: 14px;
  background: rgba(8, 17, 28, 0.9);
  color: #e2edf8;
}

.markdown-body :deep(code) {
  font-family: "SFMono-Regular", Consolas, monospace;
}

.primary-btn.secondary {
  color: var(--signal);
  border-color: color-mix(in srgb, var(--signal) 26%, var(--border));
  background: color-mix(in srgb, var(--signal-soft) 78%, transparent);
}

.danger-section {
  border-color: color-mix(in srgb, var(--danger) 24%, var(--border));
  background: color-mix(in srgb, var(--danger) 4%, var(--surface));
}

.danger-btn {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 11, 20, 0.6);
  backdrop-filter: blur(8px);
}

.confirm-card {
  padding: 28px;
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  box-shadow: 0 32px 64px -28px var(--shadow-strong);
  width: min(380px, 90vw);
  display: grid;
  gap: 14px;
}

.confirm-card h3 {
  margin: 0;
  font-size: 18px;
}

.confirm-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.confirm-note {
  font-weight: 600;
  color: var(--text);
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-cancel,
.btn-confirm-danger {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.btn-confirm-danger {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border));
}

.btn-cancel:disabled,
.btn-confirm-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.extract-result {
  margin-top: 14px;
  display: grid;
  gap: 12px;
}

.extract-result h4 {
  margin: 0;
}

.task-list {
  display: grid;
  gap: 10px;
}

.task-item {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--surface-muted);
}

.task-title {
  font-weight: 600;
}

.task-due {
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  color: var(--warn);
}

.task-priority.pri-high {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.task-priority.pri-medium {
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  color: var(--warn);
}

.task-priority.pri-low {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

@media (max-width: 900px) {
  .note-hero,
  .control-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .modal-overlay {
    padding: 0;
    align-items: stretch;
  }

  .modal-card {
    width: 100%;
    max-height: 100vh;
    padding: 18px;
    padding-top: 60px;
    border-radius: 0;
    border: none;
  }

  .close-btn {
    top: 12px;
    right: 12px;
    width: 44px;
    height: 44px;
    z-index: 10;
  }

  .control-panel,
  .append-section,
  .body-content,
  .ai-panel,
  .danger-section,
  .note-hero {
    padding: 16px;
    border-radius: 20px;
  }
}

/* Approval Card Styles */
.approval-card {
  display: grid;
  gap: 18px;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--warn) 30%, var(--border));
  border-radius: 24px;
  background: color-mix(in srgb, var(--warn) 8%, var(--surface));
}

.approval-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.approval-icon {
  font-size: 1.5rem;
}

.approval-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.approval-details {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: var(--surface-muted);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.risk-critical {
  color: var(--danger);
}

.risk-high {
  color: var(--warn);
}

.approval-content {
  padding: 18px;
  border-radius: 18px;
  background: var(--surface);
}

.approval-actions {
  display: flex;
  gap: 12px;
}

.btn-approve,
.btn-reject {
  flex: 1;
  min-height: 44px;
  padding: 12px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-approve {
  background: color-mix(in srgb, var(--ok) 12%, var(--surface));
  color: var(--ok);
  border-color: color-mix(in srgb, var(--ok) 30%, var(--border));
}

.btn-approve:hover {
  background: color-mix(in srgb, var(--ok) 20%, var(--surface));
}

.btn-reject {
  background: color-mix(in srgb, var(--danger) 12%, var(--surface));
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
}

.btn-reject:hover {
  background: color-mix(in srgb, var(--danger) 20%, var(--surface));
}

.approval-result {
  padding: 14px 20px;
  border-radius: 16px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  text-align: center;
  font-weight: 600;
}

</style>
