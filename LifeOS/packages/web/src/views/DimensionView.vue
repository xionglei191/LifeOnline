<template>
  <div class="dimension-view">
    <StateDisplay v-if="loading" type="loading" message="正在读取维度信号..." />
    <StateDisplay v-else-if="error" type="error" :message="error.message" />
    <div v-else class="content">
      <DimensionStats
        :dimension="dimension"
        :total="stats.total"
        :pending="stats.pending"
        :in-progress="stats.inProgress"
        :done="stats.done"
      />

      <DimensionCharts :notes="notes" :dimension="dimension" />

      <FilterBar
        :filters="filters"
        :available-tags="availableTags"
        @update:filters="filters = $event"
      />

      <NoteList
        :notes="filteredNotes"
        @select-note="handleSelectNote"
        @refresh="load"
      />
    </div>

    <NoteDetail :note-id="selectedNoteId" @close="selectedNoteId = null" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useDimensionNotes } from '../composables/useDimensionNotes';
import DimensionStats from '../components/DimensionStats.vue';
import DimensionCharts from '../components/DimensionCharts.vue';
import FilterBar from '../components/FilterBar.vue';
import NoteList from '../components/NoteList.vue';
import NoteDetail from '../components/NoteDetail.vue';
import type { Dimension } from '@lifeos/shared';
import StateDisplay from '../components/StateDisplay.vue';

const route = useRoute();
const dimension = computed(() => route.params.dimension as Dimension);

const { notes, loading, error, filters, filteredNotes, availableTags, stats, load } = useDimensionNotes(dimension.value);

const selectedNoteId = ref<string | null>(null);

function handleSelectNote(noteId: string) {
  selectedNoteId.value = noteId;
}

async function handleDeleted() {
  selectedNoteId.value = null;
  await load();
}

onMounted(() => {
  load();
});
</script>

<style scoped>
.dimension-view {
  padding: 8px 0 32px;
}

.content {
  display: grid;
  gap: 20px;
}

</style>
