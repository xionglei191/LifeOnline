<template>
  <div
    class="voice-capture"
    :class="{ listening, processing, unavailable: !isSupported }"
    @mousedown="startListening"
    @mouseup="stopListening"
    @mouseleave="stopListening"
    @touchstart.passive="startListening"
    @touchend="stopListening"
    @touchcancel="stopListening"
  >
    <div class="mic-icon">
      <svg v-if="!processing" viewBox="0 0 24 24" fill="none" class="feather">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
      <div v-else class="processing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
    
    <!-- Ripple effect rings -->
    <div class="ripple-rings">
      <div class="ring r1"></div>
      <div class="ring r2"></div>
    </div>
    
    <div v-if="localTranscript && listening" class="transcript-preview">
      “{{ localTranscript }}”
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{
  (e: 'result', transcript: string): void;
  (e: 'error', message: string): void;
}>();

const isSupported = ref(false);
const listening = ref(false);
const processing = ref(false);
const localTranscript = ref('');

let recognition: any = null;

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

onMounted(() => {
  // Check for Web Speech API support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    isSupported.value = true;
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening until mouseup
    recognition.interimResults = true;
    recognition.lang = 'zh-CN'; // Default language

    recognition.onstart = () => {
      listening.value = true;
      localTranscript.value = '';
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          localTranscript.value += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      // display interim quickly
      if (interimTranscript) {
        localTranscript.value = localTranscript.value + interimTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech') {
        emit('error', `语音识别错误: ${event.error}`);
        listening.value = false;
        processing.value = false;
      }
    };

    recognition.onend = () => {
      if (listening.value) {
        // Automatically restart if it stops unexpectedly while button is held
        try { recognition.start(); } catch {}
      } else {
        processResult();
      }
    };
  }
});

onUnmounted(() => {
  if (recognition) {
    recognition.onend = null; // prevent restart loops
    try { recognition.stop(); } catch {}
  }
});

function startListening(e: Event) {
  if (e.type === 'mousedown' && (e as MouseEvent).button !== 0) return; // Only left click
  if (!isSupported.value) {
    emit('error', '您的浏览器不支持语音识别协议');
    return;
  }
  if (listening.value || processing.value) return;
  
  try {
    recognition.start();
  } catch (err) {
    console.error(err);
  }
}

function stopListening() {
  if (!listening.value) return;
  listening.value = false;
  if (recognition) {
    try { recognition.stop(); } catch {}
  }
}

function processResult() {
  const final = localTranscript.value.trim();
  localTranscript.value = '';
  
  if (final) {
    processing.value = true;
    // Delay slightly to show processing dots
    setTimeout(() => {
      emit('result', final);
      processing.value = false;
    }, 400);
  } else {
    processing.value = false;
  }
}
</script>

<style scoped>
.voice-capture {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--surface-strong);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 4px 12px -4px var(--shadow);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  user-select: none;
  -webkit-touch-callout: none;
}

.voice-capture.unavailable {
  opacity: 0.5;
  cursor: not-allowed;
}

.voice-capture:not(.unavailable):hover {
  transform: scale(1.05);
  background: var(--surface-muted);
}

.voice-capture.listening {
  background: var(--signal);
  color: var(--bg);
  transform: scale(0.95);
}

.mic-icon svg {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.processing-dots {
  display: flex;
  gap: 3px;
}

.processing-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--text);
  animation: pulse 1s infinite alternate;
}

.processing-dots span:nth-child(2) { animation-delay: 0.2s; }
.processing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 1; }
}

/* Ripple rings for listening state */
.ripple-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;
}

.ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid var(--signal);
  opacity: 0;
  transform: scale(1);
}

.voice-capture.listening .r1 { animation: ripple 1.5s linear infinite; }
.voice-capture.listening .r2 { animation: ripple 1.5s linear infinite 0.75s; }

@keyframes ripple {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}

.transcript-preview {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--bg) 95%, transparent);
  color: var(--text);
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 0.85rem;
  white-space: nowrap;
  box-shadow: 0 8px 24px -8px var(--shadow-strong);
  border: 1px solid var(--border-soft);
  pointer-events: none;
  z-index: 50;
  animation: popIn 0.2s ease;
}

@keyframes popIn {
  from { opacity: 0; transform: translate(-50%, 10px) scale(0.9); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
</style>
