<template>
  <section class="approval-card">
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
      <button @click="$emit('approve')" :disabled="saving" class="btn-approve">
        {{ saving ? '处理中...' : '✅ 批准' }}
      </button>
      <button @click="$emit('reject')" :disabled="saving" class="btn-reject">
        {{ saving ? '处理中...' : '❌ 拒绝' }}
      </button>
    </div>
    <div v-else class="approval-result">
      审批已{{ note.approval_status === 'approved' ? '批准' : '拒绝' }}
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Note } from '@lifeos/shared';

defineProps<{
  note: Note;
  renderedContent: string;
  saving: boolean;
}>();

defineEmits<{
  approve: [];
  reject: [];
}>();
</script>

<style scoped>
.approval-card {
  border: 1px solid color-mix(in srgb, var(--warn) 30%, var(--border));
  background: color-mix(in srgb, var(--warn) 6%, var(--surface));
  border-radius: 22px;
  padding: 20px;
}

.approval-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.approval-header h3 { margin: 0; }
.approval-icon { font-size: 1.5rem; }

.approval-details {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.detail-label { color: var(--text-muted); }

.risk-high { color: var(--danger); }
.risk-medium { color: var(--warn); }
.risk-low { color: var(--ok); }
.status-approved { color: var(--ok); }
.status-rejected { color: var(--danger); }
.status-pending { color: var(--warn); }

.panel-kicker {
  margin: 0 0 6px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.approval-content { margin-bottom: 16px; }

.approval-actions {
  display: flex;
  gap: 12px;
}

.btn-approve, .btn-reject {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-approve { background: color-mix(in srgb, var(--ok) 14%, transparent); color: var(--ok); }
.btn-approve:hover:not(:disabled) { background: color-mix(in srgb, var(--ok) 22%, transparent); }
.btn-reject { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.btn-reject:hover:not(:disabled) { background: color-mix(in srgb, var(--danger) 22%, transparent); }
.btn-approve:disabled, .btn-reject:disabled { opacity: 0.6; cursor: not-allowed; }

.approval-result {
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  text-align: center;
  font-weight: 500;
}
</style>
