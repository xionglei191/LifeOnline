<template>
  <Teleport to="body">
    <div v-if="isVisible" class="onboarding-overlay">
      <div class="onboarding-card">
        <div class="onboarding-progress">
          <div
            v-for="step in totalSteps"
            :key="step"
            class="progress-dot"
            :class="{ active: currentStep >= step }"
          ></div>
        </div>

        <div class="onboarding-content">
          <div v-if="currentStep === 1" class="step-pane">
            <span class="step-icon">📝</span>
            <h2 class="step-title">欢迎使用 LIFE/OS</h2>
            <p class="step-desc">
              我们相信记录是认知的开始。<br><br>
              使用右下角的 <strong>"写笔记"</strong> 按钮（或全局按 <kbd>C</kbd>）即可记录你的想法、代办或日记。系统会在后台自动将你的文字向量化，编织进你的数字大脑中。
            </p>
          </div>

          <div v-if="currentStep === 2" class="step-pane">
            <span class="step-icon">◈</span>
            <h2 class="step-title">多维生命轨迹</h2>
            <p class="step-desc">
              人生不仅是单一的流水账。<br><br>
              LifeOS 会凭借 AI 将你的每条笔记划分至如 <strong>健康、事业、情感</strong> 等多维投影。在 <strong>统计 (Stats)</strong> 与 <strong>事件 (Events)</strong> 中，你可以直观透视各项能力值的变迁图谱。
            </p>
          </div>

          <div v-if="currentStep === 3" class="step-pane">
            <span class="step-icon">⚖</span>
            <h2 class="step-title">认知自治理</h2>
            <p class="step-desc">
              最强大的特性是，LifeOS 是一台<strong>活的机器</strong>。<br><br>
              它具有闲时思考引擎。在 <strong>治理 (Governance)</strong> 中，它会向你派发待办与反思；在 <strong>洞察 (Insights)</strong> 中，它会推送从你历史数据缝隙中察觉到的深刻结论。
            </p>
          </div>
        </div>

        <div class="onboarding-actions">
          <button v-if="currentStep < totalSteps" class="btn-primary" @click="nextStep">下一步</button>
          <button v-else class="btn-success" @click="finishOnboarding">开启旅程</button>
          <button v-if="currentStep < totalSteps" class="btn-skip" @click="finishOnboarding">跳过引导</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'lifeos_has_seen_onboarding';
const isVisible = ref(false);
const currentStep = ref(1);
const totalSteps = 3;

onMounted(() => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    isVisible.value = true;
  }
});

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

function finishOnboarding() {
  localStorage.setItem(STORAGE_KEY, 'true');
  isVisible.value = false;
}
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(4, 11, 20, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.onboarding-card {
  width: 100%;
  max-width: 500px;
  background: color-mix(in srgb, var(--surface-strong) 98%, transparent);
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  box-shadow: 0 32px 64px -28px var(--shadow-strong);
  padding: 40px;
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  0% { opacity: 0; transform: translateY(40px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.onboarding-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--surface-muted);
  transition: all 0.3s ease;
}

.progress-dot.active {
  background: var(--dimension-color, #409eff);
  width: 24px;
  border-radius: 4px;
}

.onboarding-content {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.step-pane {
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  0% { opacity: 0; transform: translateX(10px); }
  100% { opacity: 1; transform: translateX(0); }
}

.step-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 20px;
  filter: drop-shadow(0 4px 12px rgba(64, 158, 255, 0.3));
}

.step-title {
  margin: 0 0 16px;
  font-size: 1.6rem;
  color: var(--text);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.step-desc {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.step-desc kbd {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85em;
  color: var(--text);
}

.onboarding-actions {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.btn-primary, .btn-success {
  width: 100%;
  max-width: 240px;
  padding: 12px 24px;
  border-radius: 999px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
}

.btn-primary {
  background: var(--dimension-color, #409eff);
  box-shadow: 0 4px 12px -2px rgba(64, 158, 255, 0.4);
}
.btn-primary:hover {
  background: color-mix(in srgb, var(--dimension-color, #409eff) 80%, white);
  transform: translateY(-1px);
}

.btn-success {
  background: var(--ok);
  box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--ok) 40%, transparent);
}
.btn-success:hover {
  background: color-mix(in srgb, var(--ok) 80%, white);
  transform: translateY(-1px);
}

.btn-skip {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 8px 16px;
  transition: color 0.2s;
}
.btn-skip:hover {
  color: var(--text-secondary);
}
</style>
