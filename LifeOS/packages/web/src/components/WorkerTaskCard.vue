<template>
  <div class="wtc-card">
    <div class="wtc-top">
      <strong>{{ workerTaskTypeLabel(task.taskType) }}</strong>
      <span class="wtc-status" :class="`status-${task.status}`">{{ workerTaskStatusLabel(task.status) }}</span>
    </div>
    <div class="wtc-pills">
      <span class="wtc-pill">{{ workerTaskWorkerLabel(task.worker) }}</span>
      <span class="wtc-pill">{{ workerTaskTypeLabel(task.taskType) }}</span>
      <span v-if="task.sourceNoteId && showSourceNote" class="wtc-pill">source {{ shortId(task.sourceNoteId) }}</span>
      <span class="wtc-pill">输出 {{ task.outputNotes?.length || 0 }}</span>
    </div>
    <div class="wtc-meta">创建于 {{ formatDateTime(task.createdAt) }}</div>
    <div v-if="task.startedAt" class="wtc-meta">开始于 {{ formatDateTime(task.startedAt) }}</div>
    <div v-if="task.finishedAt" class="wtc-meta">完成于 {{ formatDateTime(task.finishedAt) }}</div>
    <div class="wtc-params">{{ formatWorkerInput(task) }}</div>
    <div class="wtc-summary">{{ taskSummary(task) }}</div>
    <div v-if="workerTaskResultFacts(task).length" class="wtc-result-facts">
      <span v-for="fact in workerTaskResultFacts(task)" :key="fact" class="wtc-result-fact">{{ fact }}</span>
    </div>
    <div v-if="task.error" class="wtc-error">{{ task.error }}</div>
    <div v-if="task.outputNotes?.length" class="wtc-output">
      <button
        v-for="output in task.outputNotes"
        :key="output.id"
        type="button"
        class="wtc-output-btn"
        @click="$emit('open-output', output)"
      >
        <span class="wtc-output-title">{{ output.title }}</span>
        <span class="wtc-output-file">{{ output.fileName }}</span>
      </button>
    </div>
    <div class="wtc-actions">
      <button type="button" class="wtc-action" @click="$emit('open-detail', task.id)">
        查看详情
      </button>
      <button
        v-if="task.status === 'pending' || task.status === 'running'"
        type="button"
        class="wtc-action danger"
        :disabled="busy"
        @click="$emit('cancel', task.id)"
      >
        {{ busy ? '处理中...' : '取消' }}
      </button>
      <button
        v-if="task.status === 'failed' || task.status === 'cancelled'"
        type="button"
        class="wtc-action"
        :disabled="busy"
        @click="$emit('retry', task.id)"
      >
        {{ busy ? '处理中...' : '重试' }}
      </button>
      <slot name="extra-actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkerTask, WorkerTaskInputMap } from '@lifeos/shared';
import { workerTaskResultFacts, workerTaskStatusLabel, workerTaskTypeLabel, workerTaskWorkerLabel } from '../utils/workerTaskLabels';

defineProps<{
  task: WorkerTask;
  busy?: boolean;
  showSourceNote?: boolean;
}>();

defineEmits<{
  'open-detail': [taskId: string];
  'open-output': [output: { id: string; title: string; filePath: string; fileName: string }];
  'cancel': [taskId: string];
  'retry': [taskId: string];
}>();

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

function formatWorkerInput(task: WorkerTask) {
  const input = task.input;
  if (!input) return '无额外参数';
  
  if (task.taskType === 'openclaw_task') {
    const t = task.input as WorkerTaskInputMap['openclaw_task'];
    return [
      `指令：${t?.instruction || '—'}`,
      `归档：${t?.outputDimension || 'learning'}`,
    ].join(' · ');
  }
  if (task.taskType === 'summarize_note') {
    const t = task.input as WorkerTaskInputMap['summarize_note'];
    return [
      `笔记：${shortId(t?.noteId || '—')}`,
      `语言：${t?.language || 'zh'}`,
      `长度：${t?.maxLength || 500}`,
    ].join(' · ');
  }
  if (task.taskType === 'classify_inbox') {
    const t = task.input as WorkerTaskInputMap['classify_inbox'];
    return `模式：${t?.dryRun ? '预演' : '实际写入'}`;
  }
  if (task.taskType === 'extract_tasks') {
    const t = task.input as WorkerTaskInputMap['extract_tasks'];
    return `源笔记：${shortId(t?.noteId || task.sourceNoteId || '—')}`;
  }
  if (task.taskType === 'update_persona_snapshot') {
    const t = task.input as WorkerTaskInputMap['update_persona_snapshot'];
    return `人格源笔记：${shortId(t?.noteId || task.sourceNoteId || '—')}`;
  }
  if (task.taskType === 'daily_report') {
    const t = task.input as WorkerTaskInputMap['daily_report'];
    return `日期：${t?.date || '今天'}`;
  }
  if (task.taskType === 'weekly_report') {
    const t = task.input as WorkerTaskInputMap['weekly_report'];
    return `周起始：${t?.weekStart || '本周一'}`;
  }
  return '无额外参数';
}

function taskSummary(task: WorkerTask) {
  if (task.status === 'pending') return '等待 LifeOS 调度执行';
  if (task.status === 'running') return task.worker === 'lifeos' ? 'LifeOS AI 执行中...' : '外部执行中，等待结构化结果';
  if (task.status === 'cancelled') return '任务已停止，不会继续生成结果笔记';
  if (task.status === 'failed') return task.resultSummary || '任务执行失败，可手动重试';
  return task.resultSummary || '任务已完成';
}
</script>

<style scoped>
.wtc-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--meta-bg);
}

.wtc-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.wtc-status {
  font-size: 12px;
  text-transform: uppercase;
}

.wtc-status.status-pending { color: #e6a23c; }
.wtc-status.status-running { color: #409eff; }
.wtc-status.status-succeeded { color: #67c23a; }
.wtc-status.status-failed { color: #f56c6c; }
.wtc-status.status-cancelled { color: #909399; }

.wtc-pills {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wtc-pill {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  font-family: monospace;
}

.wtc-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.wtc-params {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.wtc-summary {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.wtc-result-facts {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wtc-result-fact {
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-soft) 40%, var(--card-bg));
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
  color: var(--text-secondary);
  font-size: 11px;
}

.wtc-error {
  margin-top: 8px;
  font-size: 13px;
  color: #f56c6c;
}

.wtc-output {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.wtc-output-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  cursor: pointer;
  text-align: left;
}

.wtc-output-btn:hover {
  border-color: #409eff;
}

.wtc-output-title {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wtc-output-file {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  flex-shrink: 0;
}

.wtc-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wtc-action {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
}

.wtc-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wtc-action.danger {
  color: #f56c6c;
  border-color: color-mix(in srgb, #f56c6c 30%, var(--border));
}
</style>
