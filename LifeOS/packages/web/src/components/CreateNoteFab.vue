<template>
  <div>
    <button class="fab" @click="showModal = true">+</button>

    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="handleClose">
        <div class="modal-card">
          <h3>创建新笔记</h3>
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>标题 *</label>
              <input v-model="form.title" type="text" placeholder="输入笔记标题" required />
            </div>
            <div class="form-group">
              <label>维度 *</label>
              <select v-model="form.dimension" required>
                <option value="">选择维度</option>
                <option v-for="d in dimensions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>类型</label>
              <select v-model="form.type">
                <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>优先级</label>
              <select v-model="form.priority">
                <option v-for="p in priorities" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>内容</label>
              <textarea v-model="form.content" rows="6" placeholder="输入笔记内容（可选）"></textarea>
            </div>
            <div v-if="error" class="error-msg">{{ error }}</div>
            <div class="form-actions">
              <button type="button" @click="handleClose" class="btn-cancel">取消</button>
              <button type="submit" :disabled="saving" class="btn-submit">
                {{ saving ? '创建中...' : '创建' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { createNote } from '../api/client';

const emit = defineEmits<{ created: [] }>();

const showModal = ref(false);
const saving = ref(false);
const error = ref('');

const form = ref({
  title: '',
  dimension: '',
  type: 'note',
  priority: 'medium',
  content: '',
});

const dimensions = [
  { value: 'health', label: '健康' },
  { value: 'career', label: '事业' },
  { value: 'finance', label: '财务' },
  { value: 'learning', label: '学习' },
  { value: 'relationship', label: '关系' },
  { value: 'life', label: '生活' },
  { value: 'hobby', label: '兴趣' },
  { value: 'growth', label: '成长' },
];

const types = [
  { value: 'note', label: '笔记' },
  { value: 'task', label: '任务' },
  { value: 'schedule', label: '日程' },
  { value: 'record', label: '记录' },
  { value: 'milestone', label: '里程碑' },
  { value: 'review', label: '复盘' },
];

const priorities = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

async function handleSubmit() {
  saving.value = true;
  error.value = '';
  try {
    await createNote(form.value);
    emit('created');
    handleClose();
    resetForm();
  } catch (e: any) {
    error.value = e.message || '创建失败';
  } finally {
    saving.value = false;
  }
}

function handleClose() {
  showModal.value = false;
  error.value = '';
}

function resetForm() {
  form.value = { title: '', dimension: '', type: 'note', priority: 'medium', content: '' };
}
</script>

<style scoped>
.fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 62px;
  height: 62px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--signal) 28%, var(--border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--signal-soft) 85%, transparent), transparent),
    color-mix(in srgb, var(--surface-strong) 92%, transparent);
  color: var(--text);
  font-size: 34px;
  line-height: 0.95;
  cursor: pointer;
  box-shadow: 0 24px 48px -28px var(--shadow-strong);
  backdrop-filter: blur(18px);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  z-index: 40;
}

.fab:hover {
  transform: translateY(-2px) scale(1.02);
  border-color: color-mix(in srgb, var(--signal) 50%, var(--border));
  box-shadow: 0 30px 54px -26px var(--shadow-strong);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(4, 11, 20, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(12px);
}

.modal-card {
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  border: 1px solid var(--border);
  border-radius: 24px;
  max-width: 500px;
  width: 100%;
  padding: 24px;
  box-shadow: 0 40px 80px -36px var(--shadow-strong);
}

.modal-card h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 14px;
  font-family: inherit;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--signal) 44%, var(--border));
}

.form-group textarea {
  resize: vertical;
}

.error-msg {
  padding: 10px;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  border-radius: 14px;
  font-size: 13px;
  margin-bottom: 16px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-submit {
  padding: 10px 18px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 14px;
  cursor: pointer;
}

.btn-cancel {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: color-mix(in srgb, var(--surface-muted) 88%, white);
}

.btn-submit {
  background: color-mix(in srgb, var(--signal-soft) 75%, transparent);
  color: var(--signal);
  border-color: color-mix(in srgb, var(--signal) 28%, var(--border));
}

.btn-submit:hover:not(:disabled) {
  background: color-mix(in srgb, var(--signal-soft) 90%, transparent);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
