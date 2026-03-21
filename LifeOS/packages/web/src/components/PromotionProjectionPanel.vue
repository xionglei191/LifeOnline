<template>
  <div class="settings-card projection-card">
    <div class="reintegration-head">
      <div>
        <h3>Promotion Projections</h3>
        <p class="hint reintegration-subtitle">读取 PR6 promotion dispatch 后真正落地的 event node 与 continuity record。</p>
      </div>
      <div class="reintegration-head-actions">
        <button class="btn-link" @click="emit('refresh')">刷新</button>
      </div>
    </div>

    <div class="reintegration-summary-strip projection-summary-strip">
      <div class="reintegration-summary-item">
        <span>Event Nodes</span>
        <strong>{{ eventNodes.length }}</strong>
      </div>
      <div class="reintegration-summary-item">
        <span>Continuity Records</span>
        <strong>{{ continuityRecords.length }}</strong>
      </div>
    </div>

    <div v-if="message" :class="['message', messageType]">{{ message }}</div>

    <div v-if="loading" class="worker-empty-state">加载中...</div>
    <div v-else-if="!eventNodes.length && !continuityRecords.length" class="worker-empty-state">
      当前还没有 promotion projections
    </div>
    <div v-else class="projection-grid">
      <section class="projection-column">
        <div class="projection-section-title">Event Nodes</div>
        <div v-if="eventNodes.length" class="reintegration-list">
          <article v-for="eventNode in eventNodes" :key="eventNode.id" class="reintegration-item projection-item">
            <div class="reintegration-item-title-row">
              <strong>{{ eventNode.title }}</strong>
              <span class="worker-pill">{{ eventNode.eventKind }}</span>
              <span class="worker-pill">{{ eventNode.sourceReintegrationId }}</span>
            </div>
            <div class="reintegration-summary-text">{{ eventNode.summary }}</div>
            <div class="reintegration-meta-grid">
              <span>Promotion: {{ eventNode.promotionSoulActionId }}</span>
              <span>发生于 {{ formatTime(eventNode.occurredAt) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="worker-empty-state">暂无 event nodes</div>
      </section>

      <section class="projection-column">
        <div class="projection-section-title">Continuity Records</div>
        <div v-if="continuityRecords.length" class="reintegration-list">
          <article v-for="continuity in continuityRecords" :key="continuity.id" class="reintegration-item projection-item">
            <div class="reintegration-item-title-row">
              <strong>{{ continuity.summary }}</strong>
              <span class="worker-pill">{{ continuity.continuityKind }}</span>
              <span class="worker-pill">{{ continuity.sourceReintegrationId }}</span>
            </div>
            <div class="reintegration-meta-grid">
              <span>Target: {{ continuity.target }}</span>
              <span>Promotion: {{ continuity.promotionSoulActionId }}</span>
              <span>记录于 {{ formatTime(continuity.recordedAt) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="worker-empty-state">暂无 continuity records</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContinuityRecord, EventNode } from '@lifeos/shared';

defineProps<{
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

@media (max-width: 960px) {
  .projection-grid {
    grid-template-columns: 1fr;
  }
}
</style>
