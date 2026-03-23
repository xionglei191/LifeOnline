<template>
  <div class="settings-card projection-card">
    <div class="reintegration-head">
      <div>
        <h3>提升投射</h3>
        <p class="hint reintegration-subtitle">读取 PR6 promotion dispatch 后真正落地的 event node 与 continuity record。</p>
      </div>
      <div class="reintegration-head-actions">
        <button class="btn-link" @click="emit('refresh')">刷新</button>
      </div>
    </div>

    <div class="reintegration-summary-strip projection-summary-strip">
      <div class="reintegration-summary-item">
        <span>事件节点</span>
        <strong>{{ eventNodes.length }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>连续性记录</span>
        <strong>{{ continuityRecords.length }}</strong>
      </div>
    </div>

    <div v-if="message" :class="['message', messageType]">{{ message }}</div>

    <div v-if="loading" class="worker-empty-state">加载中...</div>
    <div v-else-if="!eventNodes.length && !continuityRecords.length" class="worker-empty-state">
      当前还没有提升投射
    </div>
    <div v-else class="projection-grid">
      <section class="projection-column">
        <div class="projection-section-title">事件节点</div>
        <div v-if="eventNodes.length" class="reintegration-list">
          <article v-for="eventNode in eventNodes" :key="eventNode.id" class="reintegration-item projection-item">
            <div class="reintegration-item-title-row">
              <strong>{{ eventNode.title }}</strong>
              <span class="worker-pill">{{ formatEventKindLabel(eventNode) }}</span>
              <span class="worker-pill">回流 {{ eventNode.sourceReintegrationId }}</span>
            </div>
            <div class="reintegration-summary-text">{{ eventNode.summary }}</div>
            <div class="reintegration-meta-grid">
              <span>提升动作：{{ eventNode.promotionSoulActionId }}</span>
              <span>阈值：{{ formatEventNodeThresholdLabel(eventNode) }}</span>
              <span>状态：{{ formatEventNodeStatusLabel(eventNode) }}</span>
              <span>发生于 {{ formatTime(eventNode.occurredAt) }}</span>
            </div>
            <div v-if="getProjectionExplanationSummary(eventNode)" class="projection-inline-summary">
              <span class="worker-pill subtle">{{ formatProjectionExplanationSummary(eventNode) ?? 'review-backed projection' }}</span>
            </div>
            <div class="projection-detail-grid">
              <div class="projection-detail-block">
                <span class="projection-detail-label">来源笔记</span>
                <code>{{ eventNode.sourceNoteId ?? '未提供' }}</code>
              </div>
              <div class="projection-detail-block">
                <span class="projection-detail-label">来源回流</span>
                <code>{{ eventNode.sourceReintegrationId }}</code>
              </div>
              <div v-if="eventNode.sourceSoulActionId" class="projection-detail-block">
                <span class="projection-detail-label">来源动作</span>
                <code>{{ eventNode.sourceSoulActionId }}</code>
              </div>
            </div>
            <div v-if="projectionExplanationRows(eventNode).length" class="projection-detail-block">
              <span class="projection-detail-label">判定说明</span>
              <ul class="projection-detail-list">
                <li v-for="row in projectionExplanationRows(eventNode)" :key="`${eventNode.id}-${row.label}`">{{ row.label }}：{{ row.value }}</li>
              </ul>
            </div>
            <div class="projection-detail-block">
              <span class="projection-detail-label">证据</span>
              <pre class="projection-json">{{ formatJson(eventNode.evidence) }}</pre>
            </div>
          </article>
        </div>
        <div v-else class="worker-empty-state">暂无事件节点</div>
      </section>

      <section class="projection-column">
        <div class="projection-section-title">连续性记录</div>
        <div v-if="continuityRecords.length" class="reintegration-list">
          <article v-for="continuity in continuityRecords" :key="continuity.id" class="reintegration-item projection-item">
            <div class="reintegration-item-title-row">
              <strong>{{ continuity.summary }}</strong>
              <span class="worker-pill">{{ formatContinuityKindLabel(continuity) }}</span>
              <span class="worker-pill">回流 {{ continuity.sourceReintegrationId }}</span>
            </div>
            <div class="reintegration-meta-grid">
              <span>目标：{{ formatContinuityTargetLabel(continuity) }}</span>
              <span>强度：{{ formatContinuityStrengthLabel(continuity) }}</span>
              <span>提升动作：{{ continuity.promotionSoulActionId }}</span>
              <span>记录于 {{ formatTime(continuity.recordedAt) }}</span>
            </div>
            <div v-if="formatProjectionContinuitySummary(continuity) || getProjectionExplanationSummary(continuity)" class="projection-inline-summary">
              <span v-if="formatProjectionContinuitySummary(continuity)" class="worker-pill subtle">{{ formatProjectionContinuitySummary(continuity) }}</span>
              <span v-if="formatProjectionExplanationSummary(continuity)" class="worker-pill subtle">{{ formatProjectionExplanationSummary(continuity) }}</span>
            </div>
            <div class="projection-detail-grid">
              <div class="projection-detail-block">
                <span class="projection-detail-label">来源笔记</span>
                <code>{{ continuity.sourceNoteId ?? '未提供' }}</code>
              </div>
              <div class="projection-detail-block">
                <span class="projection-detail-label">来源回流</span>
                <code>{{ continuity.sourceReintegrationId }}</code>
              </div>
              <div v-if="continuity.sourceSoulActionId" class="projection-detail-block">
                <span class="projection-detail-label">来源动作</span>
                <code>{{ continuity.sourceSoulActionId }}</code>
              </div>
            </div>
            <div v-if="formatProjectionContinuityDetails(continuity).length" class="projection-detail-block">
              <span class="projection-detail-label">连续性内容</span>
              <ul class="projection-detail-list">
                <li v-for="detail in formatProjectionContinuityDetails(continuity)" :key="detail">{{ detail }}</li>
              </ul>
            </div>
            <div v-if="projectionExplanationRows(continuity).length" class="projection-detail-block">
              <span class="projection-detail-label">判定说明</span>
              <ul class="projection-detail-list">
                <li v-for="row in projectionExplanationRows(continuity)" :key="`${continuity.id}-${row.label}`">{{ row.label }}：{{ row.value }}</li>
              </ul>
            </div>
            <div class="projection-detail-block">
              <span class="projection-detail-label">证据</span>
              <pre class="projection-json">{{ formatJson(continuity.evidence) }}</pre>
            </div>
          </article>
        </div>
        <div v-else class="worker-empty-state">暂无连续性记录</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  formatContinuityKindLabel,
  formatContinuityStrengthLabel,
  formatContinuityTargetLabel,
  formatEventKindLabel,
  formatEventNodeStatusLabel,
  formatEventNodeThresholdLabel,
  formatProjectionContinuityDetails,
  formatProjectionContinuitySummary,
  formatProjectionExplanationSummary,
  getProjectionContinuitySummary,
  getProjectionExplanationRows,
  getProjectionExplanationSummary,
} from '@lifeos/shared';
import type { ContinuityRecord, EventNode } from '@lifeos/shared';

const props = defineProps<{
  eventNodes: EventNode[];
  continuityRecords: ContinuityRecord[];
  loading: boolean;
  message: string;
  messageType: 'success' | 'error';
  formatTime: (ts: string) => string;
}>();

const emit = defineEmits<{
  (event: 'refresh'): void;
}>();

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function projectionExplanationRows(projection: EventNode | ContinuityRecord) {
  return getProjectionExplanationRows(projection);
}
</script>

<style scoped>
.projection-card {
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(73% 0.04 220) 22%);
}

.projection-summary-strip {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.projection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.projection-column {
  min-width: 0;
}

.projection-section-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.projection-item {
  min-width: 0;
}

.projection-inline-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.projection-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.projection-detail-block {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.projection-detail-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.projection-detail-list {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.projection-json {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 960px) {
  .projection-grid {
    grid-template-columns: 1fr;
  }
}
</style>
