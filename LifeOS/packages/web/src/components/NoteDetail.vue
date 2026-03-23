<template>
  <Teleport to="body">
    <div v-if="currentNoteId" class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <div class="modal-card" :style="{ '--dimension-color': note ? dimensionColor(note.dimension) : 'var(--signal)' }">
        <button class="close-btn" @click="$emit('close')" aria-label="关闭详情">×</button>

        <div v-if="loading" class="state-card">正在调取记录详情...</div>
        <div v-else-if="error" class="state-card error-state">{{ error.message }}</div>
        <div v-else-if="note" class="note-content">

          <!-- Approval Card -->
          <NoteApprovalCard
            v-if="isApprovalNote"
            :note="note"
            :rendered-content="renderedContent"
            :saving="saving"
            @approve="handleApprove"
            @reject="handleReject"
          />

          <!-- Normal Note Content -->
          <template v-else>
          <header class="note-hero">
            <div class="hero-copy">
              <p class="hero-kicker">记录详情</p>
              <h2>{{ note.title || note.file_name.replace('.md', '') }}</h2>
              <div class="hero-meta">
                <span class="meta-pill dimension">{{ getDimensionLabel(note.dimension) }}</span>
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
              <p class="panel-kicker">状态调整</p>
              <div class="btn-group">
                <button v-for="s in statuses" :key="s.value" @click="handleUpdateStatus(s.value)" :disabled="saving || note.status === s.value" :class="['action-btn', { active: note.status === s.value }]">{{ s.label }}</button>
              </div>
            </div>
            <div class="control-panel">
              <p class="panel-kicker">优先级调整</p>
              <div class="btn-group">
                <button v-for="p in priorities" :key="p.value" @click="handleUpdatePriority(p.value)" :disabled="saving || note.priority === p.value" :class="['action-btn', { active: note.priority === p.value }]">{{ p.label }}</button>
              </div>
            </div>
          </section>

          <section class="append-section">
            <div class="append-head">
              <p class="panel-kicker">追加记录</p>
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
                <p class="panel-kicker">危险操作</p>
                <span class="append-hint">删除 Vault 中的真实 Markdown 文件</span>
              </div>
              <button @click="showDeleteConfirm = true" :disabled="saving || deleting" class="danger-btn">删除笔记</button>
            </div>
          </section>

          <section class="body-content">
            <div class="body-head">
              <p class="panel-kicker">正文内容</p>
            </div>
            <PrivacyMask :privacy="note.privacy || 'private'">
              <div class="markdown-body" v-html="renderedContent"></div>
            </PrivacyMask>
          </section>

          <section v-if="personaSnapshot" class="ai-panel">
            <div class="append-head">
              <p class="panel-kicker">人格快照</p>
              <span class="append-hint">当前笔记最近一次人格快照</span>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-meta-row">
                <span class="meta-pill">{{ personaSnapshot.snapshot.sourceNoteTitle }}</span>
                <span class="meta-pill">{{ personaSnapshot.snapshot.updatedAt }}</span>
              </div>
              <p class="snapshot-summary">{{ personaSnapshot.summary }}</p>
              <p class="snapshot-preview">{{ personaSnapshot.snapshot.contentPreview }}</p>
            </div>
          </section>

          <!-- Promotion Projection Panel -->
          <section v-if="projection.hasPromotionProjectionSection.value" class="ai-panel projection-panel-shell">
            <div class="append-head">
              <div>
                <p class="panel-kicker">提升投射</p>
                <span class="append-hint">当前笔记触发的 PR6 promotion 落地结果</span>
              </div>
              <div class="projection-note-meta" v-if="projection.noteProjectionSourceReintegrationIds.value.length">
                <span class="meta-pill">来源 {{ projection.noteProjectionSourceReintegrationIds.value.length }}</span>
                <span class="meta-pill" v-if="projection.relevantNoteSoulActions.value.length">动作 {{ projection.relevantNoteSoulActions.value.length }}</span>
              </div>
            </div>
            <div v-if="projection.relevantNoteSoulActions.value.length" class="projection-action-summary">
              <span class="meta-pill">待治理 {{ projection.notePendingSoulActions.value.length }}</span>
              <span class="meta-pill">待派发 {{ projection.noteApprovedSoulActions.value.length }}</span>
              <span class="meta-pill">已执行 {{ projection.noteDispatchedSoulActions.value.length }}</span>
            </div>
            <div v-if="projection.relevantNoteSoulActions.value.length" class="projection-action-list">
              <article v-for="action in projection.relevantNoteSoulActions.value" :key="action.id" class="projection-action-item">
                <div class="projection-action-top">
                  <strong>{{ projection.promotionActionLabel(action.actionKind) }}</strong>
                  <span class="prompt-status">{{ projection.soulActionStatusText(action) }}</span>
                </div>
                <div class="projection-action-meta">
                  <span>治理 {{ action.governanceStatus }}</span>
                  <span>执行 {{ action.executionStatus }}</span>
                  <span v-if="action.sourceReintegrationId">{{ projection.formatSoulActionSourceLabel(action) }}</span>
                  <span>创建于 {{ projection.formatProjectionTime(action.createdAt) }}</span>
                </div>
                <div v-if="action.governanceReason || projection.formatSoulActionOutcomeSummary(action)" class="projection-action-detail-grid">
                  <div v-if="action.governanceReason" class="reintegration-review-reason">治理理由：{{ action.governanceReason }}</div>
                  <div v-if="projection.formatSoulActionOutcomeSummary(action)" class="reintegration-review-reason">执行摘要：{{ projection.formatSoulActionOutcomeSummary(action) }}</div>
                </div>
              </article>
            </div>
            <PromotionProjectionPanel
              :event-nodes="projection.noteEventNodes.value"
              :continuity-records="projection.noteContinuityRecords.value"
              :loading="projection.projectionLoading.value"
              :message="projection.projectionMessage.value"
              :message-type="projection.projectionMessageType.value"
              :format-time="projection.formatProjectionTime"
              @refresh="() => currentNoteId && projection.loadPromotionProjections(currentNoteId)"
            />
          </section>

          <!-- Worker Task Panel -->
          <NoteWorkerPanel
            :tasks="relatedWorkerTasks"
            :busy-task-id="workerActionTaskId"
            :submitting="workerSubmitting"
            :extracting="extracting"
            :message="workerMessage"
            :message-type="workerMessageType"
            @create-openclaw="handleCreateOpenClawTask"
            @create-summarize="handleCreateSummarizeTask"
            @create-persona-snapshot="handleCreatePersonaSnapshotTask"
            @extract-tasks="handleExtractTasks"
            @cancel-task="handleCancelRelatedTask"
            @retry-task="handleRetryRelatedTask"
            @open-detail="openRelatedWorkerTaskDetail"
            @open-output="(output) => openRelatedWorkerOutput(output.id)"
            @filter-change="handleRelatedWorkerFilterChange"
            @refresh="reloadRelatedWorkerTasks"
          />

          </template>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showDeleteConfirm && note" class="confirm-overlay" @click.self="showDeleteConfirm = false">
        <div class="confirm-card">
          <h3>删除笔记</h3>
          <p>将删除 Vault 中的真实 Markdown 文件，删除后该笔记会从看板中消失。</p>
          <p class="confirm-note">当前笔记：{{ note.title || note.file_name.replace('.md', '') }}</p>
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
import { fetchNoteById, fetchPersonaSnapshot, extractTasks, updateNote, appendNote as appendNoteApi, deleteNote as deleteNoteApi, createWorkerTask, fetchWorkerTasks, retryWorkerTask, cancelWorkerTask } from '../api/client';
import type { Note, WorkerTask, WsEvent, PersonaSnapshot, SelectableDimension } from '@lifeos/shared';
import PrivacyMask from './PrivacyMask.vue';
import WorkerTaskDetail from './WorkerTaskDetail.vue';
import NoteApprovalCard from './NoteApprovalCard.vue';
import NoteWorkerPanel from './NoteWorkerPanel.vue';
import PromotionProjectionPanel from './PromotionProjectionPanel.vue';
import { isIndexRefreshEvent } from '../composables/useWebSocket';
import { useNoteProjection } from '../composables/useNoteProjection';
import { decryptContent, getEncryptionKey } from '../utils/crypto';
import { workerTaskActionMessage } from '../utils/workerTaskLabels';
import { getDimensionColor, getDimensionLabel, SELECTABLE_DIMENSIONS } from '../utils/dimensions';

const props = defineProps<{ noteId: string | null }>();
const emit = defineEmits<{ close: []; deleted: [] }>();

const currentNoteId = ref<string | null>(null);
let activeNoteRequestId = 0;
const note = ref<Note | null>(null);
const loading = ref(false);
const error = ref<Error | null>(null);
const extracting = ref(false);
const workerSubmitting = ref(false);
const workerMessage = ref('');
const workerMessageType = ref<'success' | 'error'>('success');
const relatedWorkerTasks = ref<WorkerTask[]>([]);
const relatedWorkerFilterStatus = ref('');
const workerActionTaskId = ref<string | null>(null);
const selectedWorkerTaskId = ref<string | null>(null);
const personaSnapshot = ref<PersonaSnapshot | null>(null);
const saving = ref(false);
const deleting = ref(false);
const showDeleteConfirm = ref(false);
const appendText = ref('');
const saveMsg = ref('');
const saveMsgType = ref<'success' | 'error'>('success');
const decryptedContent = ref<string | null>(null);

const projection = useNoteProjection(currentNoteId);

const isApprovalNote = computed(() => {
  return note.value && note.value.approval_status != null && note.value.approval_status !== '';
});

const renderedContent = computed(() => {
  if (!note.value?.content) return '<p>暂无正文内容。</p>';
  const content = decryptedContent.value || note.value.content;
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
const statusLabels: Record<string, string> = { pending: '待办', in_progress: '进行中', done: '完成', cancelled: '取消' };
const priorityLabels: Record<string, string> = { high: '高', medium: '中', low: '低' };
const typeLabels: Record<string, string> = { task: '任务', schedule: '日程', note: '笔记', record: '记录', milestone: '里程碑', review: '复盘' };

function dimensionColor(dimension: string) {
  return getDimensionColor(dimension as typeof SELECTABLE_DIMENSIONS[number]);
}

// ── Data Loading ──

async function loadCurrentNote(noteId: string, requestId?: number) {
  const nextNote = await fetchNoteById(noteId) as any;
  if (requestId != null && (requestId !== activeNoteRequestId || currentNoteId.value !== noteId)) return null;
  note.value = nextNote;
  decryptedContent.value = null;
  if (note.value?.encrypted && note.value.content) {
    try {
      const key = getEncryptionKey();
      const decrypted = await decryptContent(note.value.content, key);
      if (requestId != null && (requestId !== activeNoteRequestId || currentNoteId.value !== noteId)) return note.value;
      decryptedContent.value = decrypted;
    } catch (e) { console.error('Auto-decrypt failed:', e); }
  }
  return note.value;
}

async function loadRelatedWorkerTasks(sourceNoteId: string, requestId?: number) {
  try {
    const tasks = await fetchWorkerTasks(5, { sourceNoteId, status: (relatedWorkerFilterStatus.value || undefined) as any });
    if (requestId != null && (requestId !== activeNoteRequestId || currentNoteId.value !== sourceNoteId)) return;
    relatedWorkerTasks.value = tasks;
  } catch {
    if (requestId != null && (requestId !== activeNoteRequestId || currentNoteId.value !== sourceNoteId)) return;
    relatedWorkerTasks.value = [];
  }
}

async function loadPersonaSnapshot(sourceNoteId: string, requestId?: number) {
  try {
    const snapshot = await fetchPersonaSnapshot(sourceNoteId);
    if (requestId != null && (requestId !== activeNoteRequestId || currentNoteId.value !== sourceNoteId)) return;
    personaSnapshot.value = snapshot;
  } catch {
    if (requestId != null && (requestId !== activeNoteRequestId || currentNoteId.value !== sourceNoteId)) return;
    personaSnapshot.value = null;
  }
}

async function reloadRelatedWorkerTasks() {
  if (!currentNoteId.value) return;
  await loadRelatedWorkerTasks(currentNoteId.value);
}

async function handleRelatedWorkerFilterChange(status: string) {
  relatedWorkerFilterStatus.value = status;
  await reloadRelatedWorkerTasks();
}

// ── Watchers ──

watch(() => props.noteId, (id) => { currentNoteId.value = id; }, { immediate: true });

watch(currentNoteId, async (id) => {
  const requestId = ++activeNoteRequestId;
  if (!id) {
    note.value = null; error.value = null; loading.value = false; decryptedContent.value = null;
    relatedWorkerTasks.value = []; personaSnapshot.value = null;
    projection.resetProjectionState();
    showDeleteConfirm.value = false;
    return;
  }
  loading.value = true; error.value = null; workerMessage.value = '';
  relatedWorkerFilterStatus.value = ''; appendText.value = ''; saveMsg.value = '';
  decryptedContent.value = null; showDeleteConfirm.value = false;
  try {
    const loadedNote = await loadCurrentNote(id, requestId);
    if (!loadedNote || requestId !== activeNoteRequestId || currentNoteId.value !== id) return;
    await Promise.all([
      loadRelatedWorkerTasks(id, requestId),
      loadPersonaSnapshot(id, requestId),
      projection.loadPromotionProjections(id, requestId, activeNoteRequestId),
    ]);
    if (requestId !== activeNoteRequestId || currentNoteId.value !== id) return;
  } catch (e) {
    if (requestId !== activeNoteRequestId || currentNoteId.value !== id) return;
    error.value = e as Error;
  } finally {
    if (requestId === activeNoteRequestId && currentNoteId.value === id) loading.value = false;
  }
}, { immediate: true });

// ── Handlers ──

async function handleUpdateStatus(status: string) {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try { await updateNote(currentNoteId.value, { status }); note.value = { ...note.value, status }; showMsg('状态已更新', 'success'); }
  catch (e: any) { showMsg(e.message || '更新失败', 'error'); }
  finally { saving.value = false; }
}

async function handleUpdatePriority(priority: string) {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try { await updateNote(currentNoteId.value, { priority }); note.value = { ...note.value, priority }; showMsg('优先级已更新', 'success'); }
  catch (e: any) { showMsg(e.message || '更新失败', 'error'); }
  finally { saving.value = false; }
}

async function handleAppend() {
  if (!currentNoteId.value || !appendText.value.trim()) return;
  saving.value = true;
  try { await appendNoteApi(currentNoteId.value, appendText.value.trim()); appendText.value = ''; showMsg('备注已添加', 'success'); note.value = await fetchNoteById(currentNoteId.value); }
  catch (e: any) { showMsg(e.message || '添加失败', 'error'); }
  finally { saving.value = false; }
}

async function handleExtractTasks() {
  if (!currentNoteId.value) return;
  extracting.value = true; workerMessage.value = '';
  try { const task = await extractTasks(currentNoteId.value); await loadRelatedWorkerTasks(currentNoteId.value); workerMessage.value = workerTaskActionMessage('created', task); workerMessageType.value = 'success'; }
  catch (e: any) { workerMessage.value = e.message || '行动项提取任务创建失败'; workerMessageType.value = 'error'; }
  finally { extracting.value = false; }
}

async function handleCreateOpenClawTask(payload: { instruction: string; dimension: SelectableDimension }) {
  if (!currentNoteId.value || !note.value) return;
  workerSubmitting.value = true; workerMessage.value = '';
  try { const task = await createWorkerTask({ taskType: 'openclaw_task', sourceNoteId: currentNoteId.value, input: { instruction: payload.instruction, outputDimension: payload.dimension } }); await loadRelatedWorkerTasks(currentNoteId.value); workerMessage.value = workerTaskActionMessage('created', task); workerMessageType.value = 'success'; }
  catch (e: any) { workerMessage.value = e.message || '关联任务创建失败'; workerMessageType.value = 'error'; }
  finally { workerSubmitting.value = false; }
}

async function handleCreateSummarizeTask() {
  if (!currentNoteId.value || !note.value) return;
  workerSubmitting.value = true; workerMessage.value = '';
  try { const task = await createWorkerTask({ taskType: 'summarize_note', sourceNoteId: currentNoteId.value, input: { noteId: currentNoteId.value } }); await loadRelatedWorkerTasks(currentNoteId.value); workerMessage.value = workerTaskActionMessage('created', task); workerMessageType.value = 'success'; }
  catch (e: any) { workerMessage.value = e.message || '摘要任务创建失败'; workerMessageType.value = 'error'; }
  finally { workerSubmitting.value = false; }
}

async function handleCreatePersonaSnapshotTask() {
  if (!currentNoteId.value || !note.value) return;
  workerSubmitting.value = true; workerMessage.value = '';
  try { const task = await createWorkerTask({ taskType: 'update_persona_snapshot', sourceNoteId: currentNoteId.value, input: { noteId: currentNoteId.value } }); await Promise.all([loadRelatedWorkerTasks(currentNoteId.value), loadPersonaSnapshot(currentNoteId.value)]); workerMessage.value = workerTaskActionMessage('created', task); workerMessageType.value = 'success'; }
  catch (e: any) { workerMessage.value = e.message || '人格快照任务创建失败'; workerMessageType.value = 'error'; }
  finally { workerSubmitting.value = false; }
}

async function handleRetryRelatedTask(taskId: string) {
  if (!currentNoteId.value) return;
  workerActionTaskId.value = taskId; workerMessage.value = '';
  try { const task = await retryWorkerTask(taskId); await loadRelatedWorkerTasks(currentNoteId.value); workerMessage.value = workerTaskActionMessage('retried', task); workerMessageType.value = 'success'; }
  catch (e: any) { workerMessage.value = e.message || '任务重试失败'; workerMessageType.value = 'error'; }
  finally { workerActionTaskId.value = null; }
}

async function handleCancelRelatedTask(taskId: string) {
  if (!currentNoteId.value) return;
  workerActionTaskId.value = taskId; workerMessage.value = '';
  try { const task = await cancelWorkerTask(taskId); await loadRelatedWorkerTasks(currentNoteId.value); workerMessage.value = workerTaskActionMessage('cancelled', task); workerMessageType.value = 'success'; }
  catch (e: any) { workerMessage.value = e.message || '任务取消失败'; workerMessageType.value = 'error'; }
  finally { workerActionTaskId.value = null; }
}

async function handleApprove() {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try { await updateNote(currentNoteId.value, { approval_status: 'approved', status: 'done' }); note.value = { ...note.value, approval_status: 'approved', status: 'done' }; showMsg('审批已批准', 'success'); }
  catch (e: any) { showMsg(e.message || '操作失败', 'error'); }
  finally { saving.value = false; }
}

async function handleReject() {
  if (!currentNoteId.value || !note.value) return;
  saving.value = true;
  try { await updateNote(currentNoteId.value, { approval_status: 'rejected', status: 'done' }); note.value = { ...note.value, approval_status: 'rejected', status: 'done' }; showMsg('审批已拒绝', 'success'); }
  catch (e: any) { showMsg(e.message || '操作失败', 'error'); }
  finally { saving.value = false; }
}

async function handleDelete() {
  if (!currentNoteId.value || !note.value || deleting.value) return;
  deleting.value = true;
  try { await deleteNoteApi(currentNoteId.value); showDeleteConfirm.value = false; showMsg('笔记已删除', 'success'); emit('deleted'); emit('close'); }
  catch (e: any) { showMsg(e.message || '删除失败', 'error'); }
  finally { deleting.value = false; }
}

function openRelatedWorkerOutput(noteId: string) { currentNoteId.value = noteId; }
function openRelatedWorkerTaskDetail(taskId: string) { selectedWorkerTaskId.value = taskId; }

// ── WebSocket ──

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  if (!currentNoteId.value) return;
  if (wsEvent.type === 'note-worker-tasks-updated') {
    if (wsEvent.data.sourceNoteId !== currentNoteId.value) return;
    void loadRelatedWorkerTasks(currentNoteId.value);
    if (wsEvent.data.task.taskType === 'update_persona_snapshot') void loadPersonaSnapshot(currentNoteId.value);
    return;
  }
  if (wsEvent.type === 'note-updated') { if (wsEvent.data.noteId !== currentNoteId.value) return; void loadCurrentNote(currentNoteId.value); return; }
  if (wsEvent.type === 'note-deleted') { if (wsEvent.data.noteId !== currentNoteId.value) return; emit('deleted'); emit('close'); return; }
  if (wsEvent.type === 'event-node-updated') {
    if (!projection.doesProjectionArtifactAffectCurrentNote(wsEvent.data.eventNode.sourceNoteId, wsEvent.data.eventNode.sourceReintegrationId)) return;
    void projection.loadPromotionProjections(currentNoteId.value); return;
  }
  if (wsEvent.type === 'continuity-record-updated') {
    if (!projection.doesProjectionArtifactAffectCurrentNote(wsEvent.data.continuityRecord.sourceNoteId, wsEvent.data.continuityRecord.sourceReintegrationId)) return;
    void projection.loadPromotionProjections(currentNoteId.value); return;
  }
  if (wsEvent.type === 'reintegration-record-updated') { if (wsEvent.data.sourceNoteId !== currentNoteId.value) return; void projection.loadPromotionProjections(currentNoteId.value); return; }
  if (wsEvent.type === 'soul-action-updated') { if (!projection.doesSoulActionAffectCurrentNote(wsEvent.data)) return; void projection.loadPromotionProjections(currentNoteId.value); return; }
  if (isIndexRefreshEvent(wsEvent)) void loadRelatedWorkerTasks(currentNoteId.value);
}

onMounted(() => { document.addEventListener('ws-update', handleWsUpdate); });
onUnmounted(() => { document.removeEventListener('ws-update', handleWsUpdate); });

function showMsg(msg: string, type: 'success' | 'error') {
  saveMsg.value = msg; saveMsgType.value = type;
  setTimeout(() => { saveMsg.value = ''; }, 2500);
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(4, 11, 20, 0.62); backdrop-filter: blur(12px); z-index: 1000; }
.modal-card { position: relative; width: min(980px, 100%); max-height: 90vh; overflow-y: auto; padding: 24px; border: 1px solid color-mix(in srgb, var(--dimension-color) 22%, var(--border)); border-radius: 30px; background: linear-gradient(145deg, color-mix(in srgb, var(--dimension-color) 8%, transparent), transparent 26%), color-mix(in srgb, var(--surface-strong) 95%, transparent); box-shadow: 0 40px 80px -42px var(--shadow-strong); }
.close-btn { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 999px; background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--text-muted); font-size: 1.5rem; cursor: pointer; }
.state-card { padding: 24px; border-radius: 20px; background: var(--surface-muted); color: var(--text-secondary); }
.error-state { color: var(--danger); }
.note-content { display: grid; gap: 18px; }

.note-hero, .control-panel, .append-section, .body-content, .ai-panel, .danger-section {
  border: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 92%, transparent); padding: 20px; border-radius: 22px;
}
.note-hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(14rem, 0.8fr); gap: 18px; padding: 22px; border-radius: 24px; }
.hero-kicker, .panel-kicker { margin: 0 0 6px; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); }
.hero-copy h2 { margin: 0; font-size: clamp(1.8rem, 1.5rem + 1vw, 2.6rem); line-height: 1.05; }
.hero-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.meta-pill, .tag { padding: 5px 10px; border-radius: 999px; font-size: 0.74rem; }
.meta-pill { background: var(--surface-muted); color: var(--text-secondary); }
.meta-pill.dimension { background: color-mix(in srgb, var(--dimension-color) 14%, transparent); color: var(--dimension-color); }
.status-pending { color: var(--signal); } .status-in_progress { color: var(--warn); } .status-done { color: var(--ok); } .status-cancelled { color: var(--text-muted); }
.priority-high { color: var(--danger); } .priority-medium { color: var(--warn); } .priority-low { color: var(--accent); }
.hero-facts { display: grid; gap: 12px; }
.fact { display: grid; gap: 6px; padding: 14px 16px; border-radius: 18px; background: color-mix(in srgb, var(--surface-muted) 86%, transparent); }
.fact-label { font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
.tags { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { background: var(--surface-muted); color: var(--text-secondary); }
.control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
.action-btn, .primary-btn, .danger-btn { min-height: 38px; padding: 0 14px; border: 1px solid var(--border); border-radius: 999px; background: color-mix(in srgb, var(--surface-muted) 86%, transparent); color: var(--text-secondary); cursor: pointer; }
.action-btn.active, .primary-btn { border-color: color-mix(in srgb, var(--dimension-color) 28%, var(--border)); background: color-mix(in srgb, var(--dimension-color) 12%, transparent); color: var(--dimension-color); }
.action-btn:disabled, .primary-btn:disabled, .danger-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.append-head, .body-head, .append-actions { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.append-hint { color: var(--text-muted); font-size: 0.84rem; }

.snapshot-card { display: grid; gap: 10px; margin-top: 10px; padding: 16px 18px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--signal) 16%, var(--border)); background: color-mix(in srgb, var(--surface) 94%, transparent); }
.snapshot-meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
.snapshot-summary { margin: 0; color: var(--text-primary); font-weight: 600; }
.snapshot-preview { margin: 0; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; }

.projection-panel-shell :deep(.projection-card) { border: none; padding: 0; background: transparent; }
.projection-panel-shell :deep(.reintegration-head) { display: none; }
.projection-note-meta { display: flex; align-items: center; gap: 8px; }
.projection-action-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.projection-action-list { display: grid; gap: 10px; margin-bottom: 14px; }
.projection-action-item { padding: 12px 14px; border-radius: 14px; border: 1px solid var(--border); background: color-mix(in srgb, var(--surface-muted) 88%, transparent); display: grid; gap: 8px; }
.projection-action-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.projection-action-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; color: var(--text-muted); font-size: 0.84rem; }
.projection-action-detail-grid { display: grid; gap: 8px; }

.append-input { width: 100%; margin-top: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 16px; background: color-mix(in srgb, var(--surface-strong) 94%, transparent); color: var(--text); resize: vertical; }
.append-actions { margin-top: 12px; }
.save-msg { font-size: 0.84rem; } .save-msg.success { color: var(--ok); } .save-msg.error { color: var(--danger); }

.danger-section { border-color: color-mix(in srgb, var(--danger) 24%, var(--border)); background: color-mix(in srgb, var(--danger) 4%, var(--surface)); }
.danger-btn { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); background: color-mix(in srgb, var(--danger) 10%, transparent); }

.markdown-body { color: var(--text-secondary); line-height: 1.75; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { color: var(--text); }
.markdown-body :deep(pre) { overflow-x: auto; padding: 14px; border-radius: 14px; background: rgba(8, 17, 28, 0.9); color: #e2edf8; }
.markdown-body :deep(code) { font-family: "SFMono-Regular", Consolas, monospace; }

.confirm-overlay { position: fixed; inset: 0; z-index: 1100; display: flex; align-items: center; justify-content: center; background: rgba(4, 11, 20, 0.6); backdrop-filter: blur(8px); }
.confirm-card { padding: 28px; border: 1px solid var(--border-strong); border-radius: 24px; background: color-mix(in srgb, var(--surface-strong) 96%, transparent); box-shadow: 0 32px 64px -28px var(--shadow-strong); width: min(380px, 90vw); display: grid; gap: 14px; }
.confirm-card h3 { margin: 0; font-size: 18px; }
.confirm-card p { margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.6; }
.confirm-note { font-weight: 600; color: var(--text); }
.confirm-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
.btn-cancel, .btn-confirm-danger { padding: 8px 18px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; font-size: 14px; transition: all 0.2s; }
.btn-cancel { background: var(--surface-muted); color: var(--text-secondary); }
.btn-confirm-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 28%, var(--border)); }
.btn-cancel:disabled, .btn-confirm-danger:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 900px) { .note-hero, .control-grid { grid-template-columns: 1fr; } }
@media (max-width: 720px) {
  .modal-overlay { padding: 0; align-items: stretch; }
  .modal-card { width: 100%; max-height: 100vh; padding: 18px; padding-top: 60px; border-radius: 0; border: none; }
  .close-btn { top: 12px; right: 12px; width: 44px; height: 44px; z-index: 10; }
  .control-panel, .append-section, .body-content, .ai-panel, .danger-section, .note-hero { padding: 16px; border-radius: 20px; }
}
</style>
