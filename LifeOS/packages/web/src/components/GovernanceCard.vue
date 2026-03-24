<template>
  <div class="governance-card">
    <div class="g-header">
      <span class="action-kind-badge" :class="`kind-${action.actionKind}`">
        {{ formatSoulActionKindLabel(action.actionKind) }}
      </span>
      <span class="source-hint">{{ formatSoulActionSourceLabel(action) }}</span>
    </div>

    <div class="g-body">
      <div v-if="action.governanceReason" class="payload-section">
        <h4>治理理由</h4>
        <p>{{ action.governanceReason }}</p>
      </div>

      <div v-if="promotionText" class="payload-section reasoning">
        <h4>推荐理由</h4>
        <p>{{ promotionText }}</p>
      </div>

      <div v-if="action.resultSummary" class="payload-section">
        <h4>结果摘要</h4>
        <p>{{ action.resultSummary }}</p>
      </div>

      <div v-if="action.error" class="payload-section question">
        <h4>错误</h4>
        <p>{{ action.error }}</p>
      </div>

      <!-- Dual-Plan Display for multiple_choices -->
      <div v-if="action.actionKind === 'multiple_choices' && action.governanceReason" class="dual-plan-section">
        <h4>🔀 双生子方案抉择</h4>
        <div class="plan-options">
          <div class="plan-card plan-a">
            <span class="plan-label">Plan A</span>
            <p class="plan-desc">{{ parsePlanA(action.governanceReason) }}</p>
          </div>
          <div class="plan-card plan-b">
            <span class="plan-label">Plan B</span>
            <p class="plan-desc">{{ parsePlanB(action.governanceReason) }}</p>
          </div>
        </div>
        <p class="plan-hint">请在授权时选择其中一个方案执行</p>
      </div>
    </div>
    
    <div class="g-meta">
      <span class="meta-item">{{ action.governanceStatus }}</span>
      <span class="meta-item">{{ action.executionStatus }}</span>
      <span class="meta-item">{{ formatTime(action.createdAt) }}</span>
    </div>
    
    <div class="g-footer-hints">
      <span class="swipe-hint reject">← 左滑忽略</span>
      <span class="swipe-hint approve">右滑批准 →</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SoulAction } from '@lifeos/shared';
import { formatSoulActionKindLabel, formatSoulActionSourceLabel, formatSoulActionPromotionSummary } from '@lifeos/shared';
import { computed } from 'vue';

const props = defineProps<{
  action: SoulAction;
}>();

const promotionText = computed(() => formatSoulActionPromotionSummary(props.action));

function parsePlanA(reason: string): string {
  // Try to split on common delimiters for A/B plans
  const match = reason.match(/Plan\s*A[：:.]?\s*(.+?)(?:(?:Plan\s*B|；|;|\n)|$)/i);
  if (match) return match[1].trim();
  const parts = reason.split(/[；;\n]/).filter(Boolean);
  return parts[0]?.trim() || reason;
}

function parsePlanB(reason: string): string {
  const match = reason.match(/Plan\s*B[：:.]?\s*(.+?)$/i);
  if (match) return match[1].trim();
  const parts = reason.split(/[；;\n]/).filter(Boolean);
  return parts[1]?.trim() || '仅设置提醒，不自动执行';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.governance-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 24px;
  background: color-mix(in srgb, var(--surface) 95%, transparent);
  border: 1px solid var(--border);
  border-radius: 24px;
  overflow-y: auto;
  user-select: none;
  touch-action: pan-y;
}

.g-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 14px;
}

.action-kind-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--surface-strong);
  color: var(--text-secondary);
}

.action-kind-badge.kind-promote_event_node { background: color-mix(in srgb, var(--signal) 15%, transparent); color: var(--signal); }
.action-kind-badge.kind-promote_continuity_record { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
.action-kind-badge.kind-create_worker_task { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
.action-kind-badge.kind-defer_worker_task { background: var(--surface-muted); color: var(--text-muted); }
.action-kind-badge.kind-clarify_note { background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
.action-kind-badge.kind-dispatch_physical_action { background: color-mix(in srgb, #3b82f6 15%, transparent); color: #3b82f6; }
.action-kind-badge.kind-multiple_choices { background: linear-gradient(135deg, color-mix(in srgb, #f59e0b 15%, transparent), color-mix(in srgb, #8b5cf6 15%, transparent)); color: #8b5cf6; }

.source-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.g-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.payload-section h4 {
  margin: 0 0 8px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.payload-section p {
  margin: 0 0 6px;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.payload-section.question {
  padding: 12px;
  background: color-mix(in srgb, var(--danger) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 20%, transparent);
  border-radius: 12px;
}

.payload-section.question p {
  color: var(--danger);
  font-weight: 500;
  margin: 0;
}

.payload-section.reasoning {
  padding: 12px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-radius: 12px;
}

.g-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 14px;
}

.meta-item {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  background: var(--surface-strong);
  color: var(--text-muted);
}

.g-footer-hints {
  display: flex;
  justify-content: space-between;
  padding-top: 16px;
}

.swipe-hint {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.swipe-hint.reject { color: var(--danger); }
.swipe-hint.approve { color: var(--signal); }

/* ── Dual-Plan (multiple_choices) ── */
.dual-plan-section {
  padding: 14px;
  background: color-mix(in srgb, #8b5cf6 5%, transparent);
  border: 1px solid color-mix(in srgb, #8b5cf6 20%, transparent);
  border-radius: 12px;
}
.dual-plan-section h4 {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: #8b5cf6;
  font-weight: 700;
}
.plan-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.plan-card {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  transition: transform 0.15s, box-shadow 0.15s;
}
.plan-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px -4px var(--shadow);
}
.plan-card.plan-a { border-left: 3px solid #3b82f6; }
.plan-card.plan-b { border-left: 3px solid #f59e0b; }
.plan-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.plan-desc {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}
.plan-hint {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}
</style>
