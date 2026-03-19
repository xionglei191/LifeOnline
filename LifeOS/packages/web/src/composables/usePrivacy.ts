import { ref, computed, onMounted, onUnmounted } from 'vue';

// ── Layer 1: Privacy Mode (screen-sharing protection) ──────────────────────
const privacyMode = ref(sessionStorage.getItem('privacyMode') === '1');

export function togglePrivacyMode() {
  privacyMode.value = !privacyMode.value;
  sessionStorage.setItem('privacyMode', privacyMode.value ? '1' : '0');
}

export function isContentVisible(privacy: string): boolean {
  if (!privacyMode.value) return true;
  return privacy !== 'sensitive' && privacy !== 'private';
}

// ── Layer 2: PIN Lock ──────────────────────────────────────────────────────
const isLocked = ref(false);
const pinError = ref('');
const pinAttempts = ref(0);
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30_000;

const pinEnabled = computed(() => !!localStorage.getItem('pin_hash'));

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function setupPin(pin: string, securityQuestion?: string, securityAnswer?: string): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem('pin_hash', hash);
  if (securityQuestion && securityAnswer) {
    localStorage.setItem('pin_security_question', securityQuestion);
    const answerHash = await hashPin(securityAnswer.toLowerCase().trim());
    localStorage.setItem('pin_security_answer', answerHash);
  }
  const timeout = localStorage.getItem('pin_timeout') || '15';
  localStorage.setItem('pin_timeout', timeout);
  isLocked.value = false;
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (pinAttempts.value >= PIN_MAX_ATTEMPTS) {
    pinError.value = '尝试次数过多，请等待 30 秒';
    return false;
  }
  const hash = await hashPin(pin);
  const stored = localStorage.getItem('pin_hash');
  if (hash === stored) {
    isLocked.value = false;
    pinAttempts.value = 0;
    pinError.value = '';
    resetIdleTimer();
    return true;
  }
  pinAttempts.value++;
  if (pinAttempts.value >= PIN_MAX_ATTEMPTS) {
    pinError.value = '尝试次数过多，请等待 30 秒';
    setTimeout(() => { pinAttempts.value = 0; pinError.value = ''; }, PIN_LOCKOUT_MS);
  } else {
    pinError.value = `PIN 错误，还剩 ${PIN_MAX_ATTEMPTS - pinAttempts.value} 次`;
  }
  return false;
}

export function lock() {
  if (pinEnabled.value) isLocked.value = true;
}

export function clearPin() {
  localStorage.removeItem('pin_hash');
  localStorage.removeItem('pin_security_question');
  localStorage.removeItem('pin_security_answer');
  isLocked.value = false;
  pinAttempts.value = 0;
  pinError.value = '';
}

export async function verifySecurityAnswer(answer: string): Promise<boolean> {
  const storedHash = localStorage.getItem('pin_security_answer');
  if (!storedHash) return false;
  const answerHash = await hashPin(answer.toLowerCase().trim());
  return answerHash === storedHash;
}

export function getSecurityQuestion(): string | null {
  return localStorage.getItem('pin_security_question');
}

// ── Idle timeout ───────────────────────────────────────────────────────────
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function getTimeoutMs(): number {
  const val = localStorage.getItem('pin_timeout') || '15';
  if (val === '0') return 0; // never
  return parseInt(val) * 60 * 1000;
}

export function resetIdleTimer() {
  if (!pinEnabled.value) return;
  if (idleTimer) clearTimeout(idleTimer);
  const ms = getTimeoutMs();
  if (ms === 0) return;
  idleTimer = setTimeout(() => { lock(); }, ms);
}

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function initPrivacy() {
  // Lock on load if PIN is set
  if (pinEnabled.value) {
    isLocked.value = true;
  }
  ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
}

export function destroyPrivacy() {
  ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer));
  if (idleTimer) clearTimeout(idleTimer);
}

export function usePrivacy() {
  return {
    privacyMode,
    isLocked,
    pinEnabled,
    pinError,
    pinAttempts,
    togglePrivacyMode,
    isContentVisible,
    setupPin,
    verifyPin,
    verifySecurityAnswer,
    getSecurityQuestion,
    lock,
    clearPin,
    resetIdleTimer,
    initPrivacy,
    destroyPrivacy,
  };
}
