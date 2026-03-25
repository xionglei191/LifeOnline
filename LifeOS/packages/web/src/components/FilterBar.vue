<template>
  <section class="filter-bar">
    <div class="bar-head">
      <div>
        <p class="bar-kicker">信号筛选</p>
        <h3>筛选与排序</h3>
      </div>
      <button class="reset-btn" @click="resetFilters">重置</button>
    </div>

    <div class="filter-grid">
      <div class="filter-group">
        <label>类型</label>
        <div class="filter-options">
          <button
            v-for="type in noteTypes"
            :key="type.value"
            :class="{ active: filters.types.includes(type.value) }"
            @click="toggleFilter('types', type.value)"
          >
            {{ type.label }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label>状态</label>
        <div class="filter-options">
          <button
            v-for="status in statuses"
            :key="status.value"
            :class="{ active: filters.statuses.includes(status.value) }"
            @click="toggleFilter('statuses', status.value)"
          >
            {{ status.label }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label>优先级</label>
        <div class="filter-options">
          <button
            v-for="priority in priorities"
            :key="priority.value"
            :class="{ active: filters.priorities.includes(priority.value) }"
            @click="toggleFilter('priorities', priority.value)"
          >
            {{ priority.label }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label>日期范围</label>
        <div class="date-range">
          <input
            type="date"
            :value="filters.dateFrom"
            @change="updateField('dateFrom', ($event.target as HTMLInputElement).value)"
          />
          <span class="date-sep">—</span>
          <input
            type="date"
            :value="filters.dateTo"
            @change="updateField('dateTo', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="filter-group" v-if="availableTags.length > 0">
        <label>标签</label>
        <div class="filter-options">
          <button
            v-for="tag in availableTags"
            :key="tag"
            :class="{ active: filters.tags.includes(tag) }"
            @click="toggleFilter('tags', tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label>关键词</label>
        <input
          type="text"
          class="keyword-input"
          placeholder="搜索标题或内容..."
          :value="filters.keyword"
          @input="updateField('keyword', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="filter-group">
        <label>排序</label>
        <div class="sort-row">
          <select :value="filters.sortBy" @change="updateField('sortBy', ($event.target as HTMLSelectElement).value as 'date' | 'priority')">
            <option value="date">按日期</option>
            <option value="priority">按优先级</option>
          </select>
          <button class="sort-order" @click="toggleSortOrder">
            {{ filters.sortOrder === 'desc' ? '降序' : '升序' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Filters {
  types: string[];
  statuses: string[];
  priorities: string[];
  sortBy: 'date' | 'priority';
  sortOrder: 'asc' | 'desc';
  dateFrom: string;
  dateTo: string;
  tags: string[];
  keyword: string;
}

const props = defineProps<{
  filters: Filters;
  availableTags: string[];
}>();

const emit = defineEmits<{
  'update:filters': [filters: Filters];
}>();

const noteTypes = [
  { value: 'task', label: '任务' },
  { value: 'schedule', label: '日程' },
  { value: 'note', label: '笔记' },
  { value: 'record', label: '记录' },
  { value: 'milestone', label: '里程碑' },
  { value: 'review', label: '复盘' },
];

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

const filters = ref<Filters>({ ...props.filters });

watch(() => props.filters, (newFilters) => {
  filters.value = { ...newFilters };
}, { deep: true });

const emitFilterUpdate = () => emit('update:filters', { ...filters.value });

function toggleFilter(key: 'types' | 'statuses' | 'priorities' | 'tags', value: string) {
  const index = filters.value[key].indexOf(value);
  if (index > -1) {
    filters.value[key].splice(index, 1);
  } else {
    filters.value[key].push(value);
  }
  emitFilterUpdate();
}

function updateField<K extends keyof Filters>(key: K, value: Filters[K]) {
  filters.value[key] = value;
  emitFilterUpdate();
}

function toggleSortOrder() {
  filters.value.sortOrder = filters.value.sortOrder === 'desc' ? 'asc' : 'desc';
  emit('update:filters', { ...filters.value });
}

function resetFilters() {
  filters.value = {
    types: [],
    statuses: [],
    priorities: [],
    sortBy: 'date',
    sortOrder: 'desc',
    dateFrom: '',
    dateTo: '',
    tags: [],
    keyword: '',
  };
  emit('update:filters', { ...filters.value });
}
</script>

<style scoped>
.filter-bar {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
  box-shadow: 0 24px 60px -42px var(--shadow-strong);
}

.bar-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 18px;
}

.bar-kicker {
  margin: 0 0 4px;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.bar-head h3 {
  margin: 0;
  font-size: 1.35rem;
}

.reset-btn,
.sort-order,
.filter-options button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
}

.reset-btn {
  color: var(--signal);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 20px;
}

.filter-group {
  display: grid;
  gap: 10px;
}

.filter-group label {
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.filter-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-options button.active {
  border-color: color-mix(in srgb, var(--signal) 34%, var(--border));
  background: color-mix(in srgb, var(--signal-soft) 78%, transparent);
  color: var(--signal);
}

.date-range,
.sort-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.date-range input,
.keyword-input,
select {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--text);
}

.keyword-input {
  width: 100%;
}

.date-sep {
  color: var(--text-muted);
}

@media (max-width: 960px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .filter-bar {
    padding: 20px;
    border-radius: 24px;
  }

  .bar-head {
    flex-direction: column;
  }
}
</style>
