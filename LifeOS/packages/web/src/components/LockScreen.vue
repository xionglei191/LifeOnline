<template>
  <Teleport to="body">
    <div class="lock-screen">
      <div class="lock-card">
        <div class="lock-icon">🔐</div>
        <p class="lock-kicker">LIFE/OS</p>
        <h2>已锁定</h2>
        <p class="lock-sub">输入 PIN 码继续</p>

        <div class="pin-display">
          <span
            v-for="i in 6"
            :key="i"
            class="pin-dot"
            :class="{ filled: pin.length >= i, error: hasError }"
          ></span>
        </div>

        <p v-if="pinError" class="pin-error">{{ pinError }}</p>

        <div class="numpad">
          <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" class="num-btn" @click="appendPin(String(n))">{{ n }}</button>
          <button class="num-btn clear-btn" @click="clearPin">⌫</button>
          <button class="num-btn" @click="appendPin('0')">0</button>
          <button class="num-btn submit-btn" @click="submitPin" :disabled="pin.length < 4">✓</button>
        </div>

        <button class="forgot-btn" @click="showForgot = true">忘记 PIN？</button>
      </div>

      <!-- Forgot PIN confirm -->
      <div v-if="showForgot" class="forgot-overlay" @click.self="closeForgot">
        <div class="forgot-card">
          <h3>{{ hasSecurityQuestion ? '🔑 回答密保问题' : '⚠️ 重置 PIN' }}</h3>

          <!-- With security question -->
          <template v-if="hasSecurityQuestion">
            <p class="forgot-hint">回答正确后可以重置 PIN</p>
            <div class="security-question-box">
              <p class="question-text">{{ securityQuestionText }}</p>
              <input
                v-model="securityAnswerInput"
                type="text"
                placeholder="输入答案（不区分大小写）"
                class="answer-input"
                @keydown.enter="verifyAnswer"
              />
            </div>
            <p v-if="securityError" class="security-error">{{ securityError }}</p>
            <div class="forgot-actions">
              <button class="btn-cancel" @click="closeForgot">取消</button>
              <button class="btn-reset" @click="verifyAnswer" :disabled="!securityAnswerInput.trim()">
                验证答案
              </button>
            </div>
          </template>

          <!-- Without security question -->
          <template v-else>
            <p class="forgot-warning">重置 PIN 将清除所有本地安全设置，此操作<strong>不可恢复</strong>。</p>
            <p class="forgot-hint">如果只是忘记了 PIN，建议联系管理员或查看备份记录。</p>
            <div class="forgot-confirm">
              <label class="confirm-checkbox">
                <input type="checkbox" v-model="confirmReset" />
                <span>我确认要清除 PIN 并重置所有安全设置</span>
              </label>
            </div>
            <div class="forgot-actions">
              <button class="btn-cancel" @click="closeForgot">取消</button>
              <button class="btn-reset" @click="handleReset" :disabled="!confirmReset">确认重置</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePrivacy } from '../composables/usePrivacy';

const { verifyPin, clearPin: clearPinData, pinError, verifySecurityAnswer, getSecurityQuestion } = usePrivacy();

const pin = ref('');
const hasError = ref(false);
const showForgot = ref(false);
const confirmReset = ref(false);
const securityAnswerInput = ref('');
const securityError = ref('');

const securityQuestionText = computed(() => getSecurityQuestion());
const hasSecurityQuestion = computed(() => !!securityQuestionText.value);

function appendPin(digit: string) {
  if (pin.value.length >= 6) return;
  pin.value += digit;
  if (pin.value.length >= 4) hasError.value = false;
}

function clearPin() {
  pin.value = pin.value.slice(0, -1);
}

async function submitPin() {
  if (pin.value.length < 4) return;
  const ok = await verifyPin(pin.value);
  if (!ok) {
    hasError.value = true;
    pin.value = '';
    setTimeout(() => { hasError.value = false; }, 600);
  }
}

async function verifyAnswer() {
  if (!securityAnswerInput.value.trim()) return;
  const ok = await verifySecurityAnswer(securityAnswerInput.value);
  if (ok) {
    clearPinData();
    showForgot.value = false;
    securityAnswerInput.value = '';
    securityError.value = '';
  } else {
    securityError.value = '答案错误，请重试';
    securityAnswerInput.value = '';
  }
}

function handleReset() {
  if (!confirmReset.value) return;
  clearPinData();
  closeForgot();
}

function closeForgot() {
  showForgot.value = false;
  confirmReset.value = false;
  securityAnswerInput.value = '';
  securityError.value = '';
}

function onKeydown(e: KeyboardEvent) {
  if (e.key >= '0' && e.key <= '9') appendPin(e.key);
  else if (e.key === 'Backspace') clearPin();
  else if (e.key === 'Enter') submitPin();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 20%, rgba(29, 78, 216, 0.18), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(15, 118, 110, 0.14), transparent 36%),
    var(--bg);
  backdrop-filter: blur(24px);
}

.lock-card {
  display: grid;
  gap: 16px;
  justify-items: center;
  padding: 40px 32px;
  border: 1px solid var(--border-strong);
  border-radius: 32px;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  box-shadow: 0 40px 80px -32px var(--shadow-strong);
  width: min(380px, 92vw);
}

.lock-icon { font-size: 2.4rem; }

.lock-kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.lock-card h2 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
}

.lock-sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.94rem;
}

.pin-display {
  display: flex;
  gap: 12px;
  margin: 8px 0;
}

.pin-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid var(--border-strong);
  background: transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.pin-dot.filled {
  background: var(--signal);
  border-color: var(--signal);
}

.pin-dot.error {
  background: var(--danger);
  border-color: var(--danger);
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.pin-error {
  margin: 0;
  font-size: 0.82rem;
  color: var(--danger);
  min-height: 1.2em;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
}

.num-btn {
  height: 56px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  color: var(--text);
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.num-btn:hover { background: color-mix(in srgb, var(--surface-strong) 90%, transparent); }
.num-btn:active { transform: scale(0.94); }
.num-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.clear-btn { color: var(--text-secondary); font-size: 1.4rem; }

.submit-btn {
  background: color-mix(in srgb, var(--signal-soft) 80%, transparent);
  border-color: color-mix(in srgb, var(--signal) 30%, var(--border));
  color: var(--signal);
}

.forgot-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.forgot-overlay {
  position: fixed;
  inset: 0;
  z-index: 9100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 11, 20, 0.6);
  backdrop-filter: blur(8px);
}

.forgot-card {
  padding: 28px;
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  box-shadow: 0 32px 64px -28px var(--shadow-strong);
  width: min(420px, 90vw);
  display: grid;
  gap: 14px;
}

.forgot-card h3 { margin: 0; }

.forgot-warning {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 20%, var(--border));
  color: var(--text);
  font-size: 0.94rem;
  line-height: 1.6;
}

.forgot-warning strong { color: var(--danger); }

.forgot-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.6;
}

.forgot-confirm {
  padding: 14px;
  border-radius: 12px;
  background: var(--surface-muted);
}

.confirm-checkbox {
  display: flex;
  align-items: start;
  gap: 10px;
  cursor: pointer;
  font-size: 0.88rem;
  line-height: 1.5;
}

.confirm-checkbox input[type="checkbox"] {
  margin-top: 2px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.security-question-box {
  padding: 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--signal-soft) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--signal) 20%, var(--border));
  display: grid;
  gap: 12px;
}

.question-text {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
}

.answer-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.94rem;
}

.answer-input:focus {
  outline: none;
  border-color: var(--signal);
}

.security-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 20%, var(--border));
  color: var(--danger);
  font-size: 0.88rem;
}

.forgot-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel, .btn-reset {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 0.88rem;
}

.btn-cancel { background: var(--surface-muted); color: var(--text-secondary); }
.btn-reset { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 28%, var(--border)); }
.btn-reset:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
