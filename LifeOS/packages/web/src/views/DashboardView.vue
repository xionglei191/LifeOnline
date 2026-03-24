<template>
  <DashboardOverview />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
const DashboardOverview = defineAsyncComponent(() => import('../components/DashboardOverview.vue'));
</script>
