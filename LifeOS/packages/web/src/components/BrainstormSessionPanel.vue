<template>
  <div class="settings-card brainstorm-card">
    <div class="brainstorm-head">
      <div>
        <h3>认知分析 (BrainstormSession)</h3>
        <p class="hint brainstorm-subtitle">每次笔记更新后，系统自动提炼的结构化认知快照。</p>
      </div>
      <button class="btn-link" @click="emit('refresh')">刷新</button>
    </div>

    <div v-if="loading" class="worker-empty-state">加载中...</div>
    <div v-else-if="sessions.length" class="brainstorm-list">
      <article v-for="session in sessions" :key="session.id" class="brainstorm-item">
        <div class="brainstorm-header">
          <span class="mono hint">{{ session.sourceNoteId }}</span>
          <span class="worker-pill">{{ session.emotionalTone || '—' }}</span>
          <span class="worker-pill">可行动 {{ (session.actionability * 100).toFixed(0) }}%</span>
        </div>
        <div v-if="session.themes.length" class="brainstorm-tags">
          <span v-for="t in session.themes" :key="t" class="brainstorm-tag theme">{{ t }}</span>
        </div>
        <div v-if="session.distilledInsights.length" class="brainstorm-insights">
          <span v-for="i in session.distilledInsights" :key="i" class="brainstorm-insight">{{ i }}</span>
        </div>
        <div v-if="session.suggestedActionKinds.length" class="brainstorm-tags">
          <span v-for="a in session.suggestedActionKinds" :key="a" class="brainstorm-tag action">{{ a }}</span>
        </div>
        <div v-if="session.continuitySignals.length" class="brainstorm-tags">
          <span v-for="c in session.continuitySignals" :key="c" class="brainstorm-tag continuity">{{ c }}</span>
        </div>
        <div class="brainstorm-preview">{{ session.rawInputPreview.slice(0, 150) }}{{ session.rawInputPreview.length > 150 ? '…' : '' }}</div>
        <div class="mono hint" style="font-size:11px">{{ formatTime(session.updatedAt) }}</div>
      </article>
    </div>
    <div v-else class="worker-empty-state">暂无认知分析记录。触发方式：新建或修改任意笔记。</div>
  </div>
</template>

<script setup lang="ts">
import type { BrainstormSession } from '@lifeos/shared';

defineProps<{
  sessions: BrainstormSession[];
  loading: boolean;
  formatTime: (ts: string) => string;
}>();

const emit = defineEmits<{
  (event: 'refresh'): void;
}>();
</script>

<style scoped>
/* ─── Shared styles ─── */
.settings-card { background: var(--card-bg); border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px var(--shadow); }
.settings-card h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.btn-link { border: none; background: transparent; color: #409eff; cursor: pointer; padding: 0; }
.worker-pill { padding: 3px 8px; border-radius: 999px; background: var(--card-bg); border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-family: monospace; }
.worker-empty-state { margin-top: 12px; padding: 16px; border: 1px dashed var(--border); border-radius: 8px; background: var(--meta-bg); color: var(--text-muted); font-size: 13px; text-align: center; }
.mono { font-family: monospace; font-size: 12px; }

/* ─── Brainstorm Panel ─── */
.brainstorm-card {
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(66% 0.06 200) 22%);
  background: linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(97% 0.015 200) 8%), var(--card-bg));
}

.brainstorm-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.brainstorm-subtitle { margin-top: 4px; max-width: 56ch; }

.brainstorm-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brainstorm-item {
  padding: 14px 16px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--card-bg) 92%, oklch(96% 0.01 200) 8%);
  border: 1px solid var(--border);
}

.brainstorm-header {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.brainstorm-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.brainstorm-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--border);
}

.brainstorm-tag.theme { background: oklch(95% 0.02 200); color: oklch(40% 0.1 200); }
.brainstorm-tag.action { background: oklch(95% 0.03 150); color: oklch(40% 0.1 150); }
.brainstorm-tag.continuity { background: oklch(95% 0.02 280); color: oklch(45% 0.08 280); }

.brainstorm-insights {
  margin-bottom: 6px;
}

.brainstorm-insight {
  display: block;
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
}

.brainstorm-preview {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 4px;
  margin-bottom: 4px;
}

/* ─── Mobile Responsive ─── */
@media (max-width: 640px) {
  .settings-card { padding: 16px; }
  .brainstorm-head { flex-direction: column; }
}
</style>
