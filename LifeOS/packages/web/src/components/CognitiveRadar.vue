<template>
  <div class="radar-chart-container">
    <svg viewBox="0 0 100 100" class="radar-svg">
      <!-- Polygon Backgrounds (Grid lines) -->
      <polygon v-for="level in levels" :key="level"
               :points="getPolygonPoints(level / 5)"
               class="radar-grid" />
      
      <!-- Axis Lines -->
      <line v-for="(point, index) in axisPoints" :key="'axis-'+index"
            x1="50" y1="50" :x2="point.x" :y2="point.y"
            class="radar-axis" />
      
      <!-- Data Polygon -->
      <polygon :points="dataPoints" class="radar-data-area" />
      
      <!-- Data Points -->
      <circle v-for="(point, index) in dataCoordinates" :key="'dot-'+index"
              :cx="point.x" :cy="point.y" r="2" class="radar-dot" />
    </svg>
    <div v-for="(label, index) in labels" :key="'label-'+index"
         class="radar-label"
         :style="getLabelStyle(index)">
      {{ label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: number[]; // Array of values from 0 to 100
  labels: string[];
}>();

const center = 50;
const radius = 38; // leave margin for labels
const levels = 5;

// pre-calculate angles
const angles = computed(() => {
  return props.labels.map((_, i) => (Math.PI * 2 * i) / props.labels.length - Math.PI / 2);
});

const axisPoints = computed(() => {
  return angles.value.map(angle => ({
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  }));
});

function getPolygonPoints(scale: number) {
  return angles.value.map(angle => {
    const x = center + radius * scale * Math.cos(angle);
    const y = center + radius * scale * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');
}

const dataCoordinates = computed(() => {
  return props.data.map((val, i) => {
    const scale = Math.max(0, Math.min(100, val)) / 100;
    return {
      x: center + radius * scale * Math.cos(angles.value[i]),
      y: center + radius * scale * Math.sin(angles.value[i])
    };
  });
});

const dataPoints = computed(() => {
  return dataCoordinates.value.map(p => `${p.x},${p.y}`).join(' ');
});

function getLabelStyle(index: number) {
  const angle = angles.value[index];
  // Calculate position in % for absolute positioning over the SVG
  const labelRadius = 46; // push labels outside the grid
  const x = 50 + labelRadius * Math.cos(angle);
  const y = 50 + labelRadius * Math.sin(angle);
  
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)'
  };
}
</script>

<style scoped>
.radar-chart-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 250px;
  margin: 0 auto;
}

.radar-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.radar-grid {
  fill: color-mix(in srgb, var(--surface-muted) 30%, transparent);
  stroke: var(--border-strong);
  stroke-width: 0.3;
}

.radar-axis {
  stroke: var(--border-strong);
  stroke-width: 0.5;
  stroke-dasharray: 1, 2;
}

.radar-data-area {
  fill: color-mix(in srgb, var(--accent) 25%, transparent);
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-linejoin: round;
  transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.radar-dot {
  fill: var(--bg-elevated);
  stroke: var(--accent);
  stroke-width: 1.5;
  transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.radar-label {
  position: absolute;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  pointer-events: none;
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  padding: 2px 6px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px -2px var(--shadow);
}
</style>
