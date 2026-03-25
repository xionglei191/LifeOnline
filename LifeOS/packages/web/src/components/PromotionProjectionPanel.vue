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
              <span class="worker-pill">{{ formatEventNodeThresholdLabel(eventNode) }}</span>
              <span :class="['worker-pill', eventNode.status === 'active' ? 'success' : '']">{{ formatEventNodeStatusLabel(eventNode) }}</span>
            </div>
            <div class="reintegration-summary-text">{{ eventNode.summary }}</div>
            
            <div class="projection-inline-summary">
              <span v-if="getProjectionExplanationSummary(eventNode)" class="worker-pill subtle text-muted">💡 {{ formatProjectionExplanationSummary(eventNode) ?? 'review-backed projection' }}</span>
              <span class="worker-pill subtle text-muted">🕒 {{ formatTime(eventNode.occurredAt) }}</span>
            </div>

            <div v-if="projectionExplanationRows(eventNode).length" class="projection-detail-block">
              <span class="projection-detail-label">判定说明</span>
              <ul class="projection-detail-list">
                <li v-for="row in projectionExplanationRows(eventNode)" :key="`${eventNode.id}-${row.label}`">{{ row.label }}：{{ row.value }}</li>
              </ul>
            </div>

            <div class="projection-actions-row">
              <button class="btn-link subtle-toggle" @click="toggleMeta(eventNode.id)">
                {{ expandedMetaIds.includes(eventNode.id) ? '收起溯源 ▼' : '查看技术溯源 ▶' }}
              </button>
              <button class="btn-link subtle-toggle" @click="toggleEvidence(eventNode.id)">
                {{ expandedEvidenceIds.includes(eventNode.id) ? '收起数据 ▼' : '查看 JSON ▶' }}
              </button>
            </div>

            <div v-if="expandedMetaIds.includes(eventNode.id)" class="projection-meta-drawer">
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
                <div class="projection-detail-block">
                  <span class="projection-detail-label">提升动作</span>
                  <code>{{ eventNode.promotionSoulActionId }}</code>
                </div>
              </div>
            </div>

            <pre v-if="expandedEvidenceIds.includes(eventNode.id)" class="projection-json">{{ formatJson(eventNode.evidence) }}</pre>
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
              <span class="worker-pill text-muted">强度: {{ formatContinuityStrengthLabel(continuity) }}</span>
            </div>
            
            <div class="projection-inline-summary">
              <span class="worker-pill subtle text-muted">🎯 {{ formatContinuityTargetLabel(continuity) }}</span>
              <span v-if="formatProjectionContinuitySummary(continuity)" class="worker-pill subtle text-muted">{{ formatProjectionContinuitySummary(continuity) }}</span>
              <span v-if="getProjectionExplanationSummary(continuity)" class="worker-pill subtle text-muted">💡 {{ formatProjectionExplanationSummary(continuity) }}</span>
              <span class="worker-pill subtle text-muted">🕒 {{ formatTime(continuity.recordedAt) }}</span>
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

            <div class="projection-actions-row">
              <button class="btn-link subtle-toggle" @click="toggleMeta(continuity.id)">
                {{ expandedMetaIds.includes(continuity.id) ? '收起溯源 ▼' : '查看技术溯源 ▶' }}
              </button>
              <button class="btn-link subtle-toggle" @click="toggleEvidence(continuity.id)">
                {{ expandedEvidenceIds.includes(continuity.id) ? '收起数据 ▼' : '查看 JSON ▶' }}
              </button>
            </div>

            <div v-if="expandedMetaIds.includes(continuity.id)" class="projection-meta-drawer">
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
                <div class="projection-detail-block">
                  <span class="projection-detail-label">提升动作</span>
                  <code>{{ continuity.promotionSoulActionId }}</code>
                </div>
              </div>
            </div>

            <pre v-if="expandedEvidenceIds.includes(continuity.id)" class="projection-json">{{ formatJson(continuity.evidence) }}</pre>
          </article>
        </div>
        <div v-else class="worker-empty-state">暂无连续性记录</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

const expandedEvidenceIds = ref<string[]>([]);
const expandedMetaIds = ref<string[]>([]);

function toggleEvidence(id: string) {
  if (expandedEvidenceIds.value.includes(id)) {
    expandedEvidenceIds.value = expandedEvidenceIds.value.filter(i => i !== id);
  } else {
    expandedEvidenceIds.value.push(id);
  }
}

function toggleMeta(id: string) {
  if (expandedMetaIds.value.includes(id)) {
    expandedMetaIds.value = expandedMetaIds.value.filter(i => i !== id);
  } else {
    expandedMetaIds.value.push(id);
  }
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.projection-actions-row {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.projection-meta-drawer {
  margin-top: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.subtle-toggle {
  font-size: 11px;
  text-transform: none;
  letter-spacing: normal;
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
