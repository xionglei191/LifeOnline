<template>
  <div
    class="swipe-stack"
    @mousedown="startDrag"
    @touchstart.passive="startTouchDrag"
  >
    <!-- We only render the top 3 cards for performance and visual stacking -->
    <div
      v-for="(item, index) in visibleItems"
      :key="itemKey(item)"
      class="swipe-card-wrapper"
      :style="cardStyle(index)"
      :class="{ 'is-dragging': index === 0 && isDragging, 'is-animating': index === 0 && isAnimating }"
    >
      <slot name="card" :item="item" :index="index"></slot>
      
      <!-- Overlay badges for explicit visual feedback during drag -->
      <div v-if="index === 0" class="swipe-overlay approve" :style="{ opacity: approveOpacity }">
        <span class="overlay-text">批准</span>
      </div>
      <div v-if="index === 0" class="swipe-overlay reject" :style="{ opacity: rejectOpacity }">
        <span class="overlay-text">拒绝</span>
      </div>
    </div>
    
    <div v-if="items.length === 0" class="empty-state">
      <slot name="empty"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

const props = defineProps<{
  items: any[];
  itemKey: (item: any) => string;
  threshold?: number;
}>();

const emit = defineEmits<{
  (e: 'approve', item: any): void;
  (e: 'reject', item: any): void;
}>();

const swipeThreshold = props.threshold || 120; // px to trigger action

const isDragging = ref(false);
const isAnimating = ref(false);
const startX = ref(0);
const startY = ref(0);
const currentX = ref(0);
const currentY = ref(0);
const deltaX = ref(0);
const deltaY = ref(0);

const visibleItems = computed(() => props.items.slice(0, 3));

const approveOpacity = computed(() => {
  if (deltaX.value <= 0) return 0;
  return Math.min(deltaX.value / (swipeThreshold * 0.8), 1);
});

const rejectOpacity = computed(() => {
  if (deltaX.value >= 0) return 0;
  return Math.min(Math.abs(deltaX.value) / (swipeThreshold * 0.8), 1);
});

function cardStyle(index: number) {
  if (index === 0) {
    const rotate = deltaX.value * 0.05;
    return {
      transform: isDragging.value || isAnimating.value 
        ? `translate3d(${deltaX.value}px, ${deltaY.value}px, 0) rotate(${rotate}deg)` 
        : '',
      zIndex: 10
    };
  }
  
  // Background cards scale and translate down slightly
  const scale = 1 - (index * 0.05);
  const translateY = index * 12;
  return {
    transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
    zIndex: 10 - index,
    opacity: 1 - (index * 0.2)
  };
}

// Mouse events
function startDrag(e: MouseEvent) {
  if (props.items.length === 0 || isAnimating.value) return;
  isDragging.value = true;
  startX.value = e.clientX;
  startY.value = e.clientY;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  currentX.value = e.clientX;
  currentY.value = e.clientY;
  deltaX.value = currentX.value - startX.value;
  deltaY.value = currentY.value - startY.value;
}

// Touch events
function startTouchDrag(e: TouchEvent) {
  if (props.items.length === 0 || isAnimating.value) return;
  isDragging.value = true;
  startX.value = e.touches[0].clientX;
  startY.value = e.touches[0].clientY;
  document.addEventListener('touchmove', onTouchDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
}

function onTouchDrag(e: TouchEvent) {
  if (!isDragging.value) return;
  // Prevent scrolling while swiping horizontally
  if (Math.abs(deltaX.value) > Math.abs(deltaY.value) && e.cancelable) {
    e.preventDefault();
  }
  currentX.value = e.touches[0].clientX;
  currentY.value = e.touches[0].clientY;
  deltaX.value = currentX.value - startX.value;
  deltaY.value = currentY.value - startY.value;
}

function endDrag() {
  if (!isDragging.value) return;
  isDragging.value = false;
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onTouchDrag);
  document.removeEventListener('touchend', endDrag);
  
  const topItem = props.items[0];
  if (!topItem) return;

  if (deltaX.value >= swipeThreshold) {
    // Swipe Right -> Approve
    animateRelease(window.innerWidth);
    setTimeout(() => {
      emit('approve', topItem);
      resetPosition();
    }, 250);
  } else if (deltaX.value <= -swipeThreshold) {
    // Swipe Left -> Reject
    animateRelease(-window.innerWidth);
    setTimeout(() => {
      emit('reject', topItem);
      resetPosition();
    }, 250);
  } else {
    // Snap back
    isAnimating.value = true;
    deltaX.value = 0;
    deltaY.value = 0;
    setTimeout(() => {
      isAnimating.value = false;
    }, 300);
  }
}

function animateRelease(targetX: number) {
  isAnimating.value = true;
  deltaX.value = targetX;
  const ratio = Math.abs(targetX / deltaX.value) || 1;
  deltaY.value = deltaY.value * ratio; // Keep trajectory 
}

function resetPosition() {
  isAnimating.value = false;
  deltaX.value = 0;
  deltaY.value = 0;
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onTouchDrag);
  document.removeEventListener('touchend', endDrag);
});
</script>

<style scoped>
.swipe-stack {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 480px; /* Fixed height for the card stack container */
  margin: 0 auto;
  perspective: 1000px;
  user-select: none;
  touch-action: pan-y; /* Allow vertical scroll, hijack horizontal */
}

.swipe-card-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
  transform-origin: 50% 100%;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 12px 32px -12px var(--shadow-strong);
  background: var(--surface);
}

.swipe-card-wrapper:not(.is-dragging) {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease;
}

.swipe-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}

.swipe-overlay.approve {
  background: linear-gradient(to right, transparent, color-mix(in srgb, var(--signal) 20%, transparent));
}

.swipe-overlay.reject {
  background: linear-gradient(to left, transparent, color-mix(in srgb, var(--danger) 20%, transparent));
}

.overlay-text {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 12px 24px;
  border-radius: 16px;
  border: 4px solid;
  transform: rotate(-15deg);
}

.swipe-overlay.approve .overlay-text {
  color: var(--signal);
  border-color: var(--signal);
  transform: rotate(-15deg) translate(-20px, -40px);
}

.swipe-overlay.reject .overlay-text {
  color: var(--danger);
  border-color: var(--danger);
  transform: rotate(15deg) translate(20px, -40px);
}

.empty-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
</style>
