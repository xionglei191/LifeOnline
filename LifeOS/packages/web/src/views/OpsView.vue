<template>
  <div class="ops-view">
    <h2>运维中心</h2>

    <!-- Worker Tasks -->
    <WorkerTaskPanel />

    <!-- Schedules -->
    <SchedulePanel />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
const WorkerTaskPanel = defineAsyncComponent(() => import('../components/WorkerTaskPanel.vue'));
const SchedulePanel = defineAsyncComponent(() => import('../components/SchedulePanel.vue'));
</script>

<style scoped>
.ops-view { max-width: 800px; margin: 0 auto; padding-bottom: 24px; }
.ops-view h2 { font-size: 22px; margin-bottom: 20px; }
</style>
