<template>
  <div class="settings-view">
    <h2>设置</h2>

    <div class="settings-card">
      <h3>Vault 配置</h3>
      <div class="form-group">
        <label>Vault 路径</label>
        <div class="input-row">
          <input
            v-model="vaultPath"
            type="text"
            placeholder="输入 Obsidian Vault 路径，如 /home/user/MyVault"
            :disabled="saving"
          />
          <button @click="handleSave" :disabled="saving || !vaultPath">
            {{ saving ? '保存中...' : '保存并重新索引' }}
          </button>
        </div>
        <p class="hint">设置你的 Obsidian Vault 目录路径，系统会自动扫描其中的 .md 文件</p>
      </div>

      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>

      <div v-if="indexResult" class="index-result">
        <h4>索引结果</h4>
        <div class="stats-row">
          <span class="stat">总文件: {{ indexResult.total }}</span>
          <span class="stat indexed">已索引: {{ indexResult.indexed }}</span>
          <span class="stat skipped">跳过: {{ indexResult.skipped }}</span>
          <span class="stat deleted">删除: {{ indexResult.deleted }}</span>
          <span v-if="indexResult.errors.length" class="stat errors">
            错误: {{ indexResult.errors.length }}
          </span>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>索引管理</h3>
      <div class="action-row">
        <button @click="handleReindex" :disabled="reindexing" class="btn-reindex">
          {{ reindexing ? '索引中...' : '手动重新索引' }}
        </button>
        <span v-if="indexStatus" class="queue-info">
          队列: {{ indexStatus.queueSize }} 个文件
          <template v-if="indexStatus.processing"> (处理中)</template>
        </span>
      </div>

      <div v-if="indexErrors.length > 0" class="error-log">
        <h4>索引错误日志 ({{ indexErrors.length }})</h4>
        <div class="error-list">
          <div v-for="(err, i) in indexErrors" :key="i" class="error-item">
            <span class="error-time">{{ formatTime(err.timestamp) }}</span>
            <span class="error-path">{{ err.filePath }}</span>
            <span class="error-msg">{{ err.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>AI Provider 配置</h3>
      <p class="hint" style="margin-bottom:16px">在线管理 Base URL、Model 与 API Key，保存后立即作用于运行中的 AI 调用。</p>

      <div class="provider-summary">
        <div class="provider-summary-row">
          <span>当前状态</span>
          <span class="prompt-status" :class="aiProviderStatusClass">{{ aiProviderStatusText }}</span>
        </div>
        <div class="provider-summary-row">
          <span>Key 来源</span>
          <span>{{ aiProviderSourceText }}</span>
        </div>
        <div class="provider-summary-row">
          <span>最近更新</span>
          <span>{{ aiProviderSettings?.updatedAt ? formatTime(aiProviderSettings.updatedAt) : '使用默认运行时配置' }}</span>
        </div>
      </div>

      <div v-if="aiProviderMessage" :class="['message', aiProviderMessageType]">{{ aiProviderMessage }}</div>

      <div class="provider-grid">
        <div class="form-group">
          <label>Base URL</label>
          <input v-model="aiProviderBaseUrl" type="url" :disabled="aiProviderSaving || aiProviderTesting" placeholder="https://codeflow.asia/v1/messages" />
        </div>
        <div class="form-group">
          <label>Model</label>
          <input v-model="aiProviderModel" type="text" :disabled="aiProviderSaving || aiProviderTesting" placeholder="claude-haiku-4-5-20251001" />
        </div>
        <div class="form-group">
          <label>API Key（仅写入）</label>
          <input
            v-model="aiProviderApiKey"
            type="password"
            :disabled="aiProviderSaving || aiProviderTesting"
            placeholder="已配置则留空；如需替换请重新输入"
            @input="aiProviderClearKeyPending = false"
          />
          <div class="hint provider-key-meta">
            <span>当前摘要：</span>
            <PrivacyMask privacy="sensitive">
              <span>{{ aiProviderSettings?.apiKeyMasked || '未配置' }}</span>
            </PrivacyMask>
          </div>
        </div>
        <div class="form-group provider-toggle-group">
          <label>Enabled</label>
          <label class="switch-row">
            <input v-model="aiProviderEnabled" type="checkbox" :disabled="aiProviderSaving || aiProviderTesting" />
            <span>{{ aiProviderEnabled ? '启用 AI Provider' : '禁用 AI Provider' }}</span>
          </label>
          <p class="hint">禁用后 AI 相关流程会直接报未启用错误。</p>
        </div>
      </div>

      <div v-if="aiProviderValidationError" class="message error">{{ aiProviderValidationError }}</div>

      <div v-if="aiProviderTestResult" class="provider-test-result">
        <div><strong>测试结果：</strong>{{ aiProviderTestResult.success ? '成功' : '失败' }}</div>
        <div>Base URL：{{ aiProviderTestResult.resolvedBaseUrl }}</div>
        <div>Model：{{ aiProviderTestResult.resolvedModel }}</div>
        <div v-if="aiProviderTestResult.latencyMs !== undefined">耗时：{{ aiProviderTestResult.latencyMs }} ms</div>
      </div>

      <div class="action-row prompt-actions">
        <button @click="handleSaveAiProvider" :disabled="aiProviderSaving || aiProviderTesting || !!aiProviderValidationError || !aiProviderDirty" class="btn-worker">
          {{ aiProviderSaving ? '保存中...' : '保存配置' }}
        </button>
        <button @click="handleTestAiProvider" :disabled="aiProviderSaving || aiProviderTesting || !!aiProviderValidationError" class="btn-cancel">
          {{ aiProviderTesting ? '测试中...' : '测试连接' }}
        </button>
        <button @click="markAiProviderKeyForClear" :disabled="aiProviderSaving || aiProviderTesting || aiProviderSettings?.apiKeySource !== 'database'" class="btn-danger-sm">
          清空已保存 Key
        </button>
        <button class="btn-link" @click="discardAiProviderChanges" :disabled="aiProviderSaving || aiProviderTesting || !aiProviderDirty">放弃未保存修改</button>
      </div>
    </div>

    <div class="settings-card">
      <AICostPanel />
    </div>

    <div class="settings-card">
      <h3>外部集成管理</h3>
      <p class="hint" style="margin-bottom:16px">管理已授权的外部服务连接，允许 LifeOS 代你执行物理动作。</p>
      <div class="integration-list">
        <IntegrationCard
          v-for="intg in integrations"
          :key="intg.provider"
          :integration="intg"
          @connect="handleConnect"
          @disconnect="handleDisconnect"
        />
      </div>
    </div>

    <div class="settings-card">
      <h3>AI Prompt 调优中心</h3>
      <p class="hint" style="margin-bottom:16px">在线编辑 Prompt override，保存后立即作用于运行中的 AI 流程。</p>

      <div v-if="promptMessage" :class="['message', promptMessageType]">{{ promptMessage }}</div>

      <div class="prompt-center">
        <div class="prompt-list">
          <button
            v-for="prompt in promptRecords"
            :key="prompt.key"
            type="button"
            class="prompt-list-item"
            :class="{ active: selectedPromptKey === prompt.key }"
            @click="selectPrompt(prompt.key)"
          >
            <div class="prompt-list-top">
              <strong>{{ prompt.label }}</strong>
              <span class="prompt-status" :class="promptStatusClass(prompt)">{{ promptStatusText(prompt) }}</span>
            </div>
            <div class="prompt-key">{{ prompt.key }}</div>
            <div class="prompt-desc">{{ prompt.description }}</div>
            <div class="prompt-updated">{{ prompt.updatedAt ? `更新于 ${formatTime(prompt.updatedAt)}` : '使用默认 Prompt' }}</div>
          </button>
        </div>

        <div v-if="selectedPrompt" class="prompt-editor">
          <div class="prompt-editor-head">
            <div>
              <h4>{{ selectedPrompt.label }}</h4>
              <p class="hint">{{ selectedPrompt.description }}</p>
            </div>
            <div class="prompt-editor-actions-top">
              <button class="btn-link" @click="discardPromptChanges" :disabled="promptSaving || !promptDirty">放弃未保存修改</button>
            </div>
          </div>

          <div class="form-group">
            <label>Required placeholders</label>
            <div class="placeholder-list">
              <code v-for="placeholder in selectedPrompt.requiredPlaceholders" :key="placeholder">{{ placeholder }}</code>
            </div>
          </div>

          <div class="form-group">
            <label>Override Prompt</label>
            <textarea
              v-model="promptDraft"
              class="prompt-textarea"
              rows="16"
              :disabled="promptSaving"
              placeholder="输入 override Prompt 内容"
            ></textarea>
          </div>

          <div v-if="promptValidationError" class="message error">{{ promptValidationError }}</div>

          <div class="action-row prompt-actions">
            <button @click="handleSavePrompt(true)" :disabled="promptSaving || !canSavePrompt" class="btn-worker">
              {{ promptSaving ? '保存中...' : '保存 override' }}
            </button>
            <button @click="handleSavePrompt(false)" :disabled="promptSaving || !canSavePrompt" class="btn-cancel">
              保存并禁用 override
            </button>
            <button
              v-if="selectedPrompt.isOverridden"
              @click="handleTogglePromptEnabled"
              :disabled="promptSaving"
              class="toggle-btn"
              :class="{ active: selectedPrompt.enabled }"
            >
              {{ selectedPrompt.enabled ? '已启用 override' : '已禁用 override' }}
            </button>
            <button
              v-if="selectedPrompt.isOverridden"
              @click="handleResetPrompt"
              :disabled="promptSaving"
              class="btn-danger-sm"
            >
              重置为默认
            </button>
          </div>

          <details class="prompt-default-panel">
            <summary>查看默认 Prompt</summary>
            <textarea class="prompt-textarea readonly" :value="selectedPrompt.defaultContent" rows="12" readonly></textarea>
          </details>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>隐私与安全</h3>

      <!-- Privacy mode -->
      <div class="security-row">
        <div>
          <div class="security-label">隐私模式</div>
          <div class="security-hint">开启后隐藏 private/sensitive 内容，适合分享屏幕时使用</div>
        </div>
        <button class="toggle-btn" :class="{ active: privacyMode }" @click="togglePrivacyMode">
          {{ privacyMode ? '已开启' : '已关闭' }}
        </button>
      </div>

      <!-- PIN setup -->
      <div class="security-row">
        <div>
          <div class="security-label">PIN 锁定</div>
          <div class="security-hint">{{ pinEnabled ? '已设置 PIN，打开看板需要验证' : '未设置 PIN，任何人都可以直接访问' }}</div>
        </div>
        <div class="security-actions">
          <button v-if="pinEnabled" class="btn-danger-sm" @click="confirmClearPin">取消 PIN</button>
          <button class="toggle-btn" :class="{ active: pinEnabled }" @click="showPinSetup = !showPinSetup">
            {{ pinEnabled ? '修改 PIN' : '设置 PIN' }}
          </button>
        </div>
      </div>

      <!-- PIN setup form -->
      <div v-if="showPinSetup" class="pin-setup">
        <div class="form-group">
          <label>新 PIN（4-6 位数字）</label>
          <input v-model="newPin" type="password" inputmode="numeric" maxlength="6" placeholder="输入 PIN" />
        </div>
        <div class="form-group">
          <label>确认 PIN</label>
          <input v-model="confirmPin" type="password" inputmode="numeric" maxlength="6" placeholder="再次输入 PIN" />
        </div>
        <div class="security-question-section">
          <p class="section-label">密保问题（可选，用于重置 PIN）</p>
          <div class="form-group">
            <label>密保问题</label>
            <select v-model="securityQuestion">
              <option value="">不设置密保问题</option>
              <option value="你的出生城市是？">你的出生城市是？</option>
              <option value="你的第一个宠物叫什么？">你的第一个宠物叫什么？</option>
              <option value="你母亲的姓氏是？">你母亲的姓氏是？</option>
              <option value="你小学的名字是？">你小学的名字是？</option>
              <option value="你最喜欢的书是？">你最喜欢的书是？</option>
              <option value="custom">自定义问题...</option>
            </select>
          </div>
          <div v-if="securityQuestion === 'custom'" class="form-group">
            <label>自定义问题</label>
            <input v-model="customQuestion" type="text" placeholder="输入你的密保问题" />
          </div>
          <div v-if="securityQuestion && securityQuestion !== 'custom'" class="form-group">
            <label>答案</label>
            <input v-model="securityAnswer" type="text" placeholder="输入答案（不区分大小写）" />
          </div>
          <div v-else-if="securityQuestion === 'custom' && customQuestion" class="form-group">
            <label>答案</label>
            <input v-model="securityAnswer" type="text" placeholder="输入答案（不区分大小写）" />
          </div>
        </div>
        <div v-if="pinSetupError" class="message error">{{ pinSetupError }}</div>
        <div class="action-row">
          <button class="btn-reindex" @click="handleSetPin" :disabled="!newPin || newPin !== confirmPin || newPin.length < 4">
            保存 PIN
          </button>
        </div>
      </div>

      <!-- Auto-lock timeout -->
      <div v-if="pinEnabled" class="security-row">
        <div>
          <div class="security-label">自动锁定</div>
          <div class="security-hint">无操作后自动锁定</div>
        </div>
        <select v-model="lockTimeout" @change="saveLockTimeout" class="timeout-select">
          <option value="0">永不</option>
          <option value="15">15 分钟</option>
          <option value="60">1 小时</option>
        </select>
      </div>

      <!-- PIN feedback message -->
      <div v-if="pinMessage" :class="['message', pinMessageType]">{{ pinMessage }}</div>
    </div>

    <!-- Clear PIN confirmation -->
    <Teleport to="body">
      <div v-if="showClearConfirm" class="confirm-overlay" @click.self="showClearConfirm = false">
        <div class="confirm-card">
          <h3>取消 PIN 锁定</h3>
          <p>取消后任何人都可以直接访问看板，确认继续？</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showClearConfirm = false">取消</button>
            <button class="btn-confirm-danger" @click="handleClearPin">确认取消</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="settings-card">
      <h3>系统信息</h3>
      <div class="info-row">
        <span class="label">服务端口</span>
        <span class="value">{{ config?.port || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">当前 Vault</span>
        <span class="value">{{ config?.vaultPath || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">WebSocket</span>
        <span :class="['value', isConnected ? 'ws-on' : 'ws-off']">
          {{ isConnected ? '已连接' : '已断开' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import PrivacyMask from '../components/PrivacyMask.vue';
import AICostPanel from '../components/AICostPanel.vue';
import IntegrationCard from '../components/IntegrationCard.vue';
import { fetchConfig, updateConfig, triggerIndex, fetchIndexStatus, fetchIndexErrors, fetchAiPrompts, updateAiPrompt, resetAiPrompt, fetchAiProviderSettings, updateAiProviderSettings, testAiProviderConnection, fetchIntegrations, type Config, type IndexResult, type IndexStatus, type IndexError } from '../api/client';
import type { PromptKey, PromptRecord, AiProviderSettings, TestAiProviderConnectionResponse } from '@lifeos/shared';
import { useWebSocket } from '../composables/useWebSocket';
import { usePrivacy } from '../composables/usePrivacy';

const { isConnected } = useWebSocket();
const { privacyMode, pinEnabled, togglePrivacyMode, setupPin, clearPin } = usePrivacy();

// ── PIN State ──────────────────────────────────────────
const showPinSetup = ref(false);
const newPin = ref('');
const confirmPin = ref('');
const pinSetupError = ref('');
const lockTimeout = ref(localStorage.getItem('pin_timeout') || '15');
const showClearConfirm = ref(false);
const pinMessage = ref('');
const pinMessageType = ref<'success' | 'error'>('success');
const securityQuestion = ref('');
const customQuestion = ref('');
const securityAnswer = ref('');

async function handleSetPin() {
  if (newPin.value.length < 4) { pinSetupError.value = 'PIN 至少 4 位'; return; }
  if (newPin.value !== confirmPin.value) { pinSetupError.value = '两次输入不一致'; return; }
  const finalQuestion = securityQuestion.value === 'custom' ? customQuestion.value : securityQuestion.value;
  const finalAnswer = securityAnswer.value;
  if (finalQuestion && !finalAnswer) { pinSetupError.value = '请输入密保问题的答案'; return; }
  await setupPin(newPin.value, finalQuestion || undefined, finalAnswer || undefined);
  newPin.value = ''; confirmPin.value = ''; securityQuestion.value = ''; customQuestion.value = ''; securityAnswer.value = ''; pinSetupError.value = ''; showPinSetup.value = false;
  showPinMessage('PIN 已设置' + (finalQuestion ? '（含密保问题）' : ''), 'success');
}

function confirmClearPin() { showClearConfirm.value = true; }
function handleClearPin() { clearPin(); showPinSetup.value = false; showClearConfirm.value = false; showPinMessage('PIN 已取消', 'success'); }
function saveLockTimeout() { localStorage.setItem('pin_timeout', lockTimeout.value); showPinMessage('自动锁定设置已保存', 'success'); }
function showPinMessage(msg: string, type: 'success' | 'error') { pinMessage.value = msg; pinMessageType.value = type; setTimeout(() => { pinMessage.value = ''; }, 3000); }

// ── Config / Index State ───────────────────────────────
const config = ref<Config | null>(null);
const vaultPath = ref('');
const saving = ref(false);
const reindexing = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const indexResult = ref<IndexResult | null>(null);
const indexStatus = ref<IndexStatus | null>(null);
const indexErrors = ref<IndexError[]>([]);

// ── AI Provider State ──────────────────────────────────
const aiProviderSettings = ref<AiProviderSettings | null>(null);
const aiProviderBaseUrl = ref('');
const aiProviderModel = ref('');
const aiProviderEnabled = ref(true);
const aiProviderApiKey = ref('');
const aiProviderSaving = ref(false);
const aiProviderTesting = ref(false);
const aiProviderMessage = ref('');
const aiProviderMessageType = ref<'success' | 'error'>('success');
const aiProviderTestResult = ref<TestAiProviderConnectionResponse | null>(null);
const aiProviderClearKeyPending = ref(false);

// ── Prompt State ───────────────────────────────────────
const promptRecords = ref<PromptRecord[]>([]);
const selectedPromptKey = ref<PromptKey | null>(null);
const promptDraft = ref('');
const promptSaving = ref(false);
const promptMessage = ref('');
const promptMessageType = ref<'success' | 'error'>('success');

// ── Computed ───────────────────────────────────────────
const selectedPrompt = computed(() => promptRecords.value.find(prompt => prompt.key === selectedPromptKey.value) || null);
const promptValidationError = computed(() => {
  const prompt = selectedPrompt.value; const content = promptDraft.value.trim();
  if (!prompt) return ''; if (!content) return 'Prompt 内容不能为空';
  const missing = prompt.requiredPlaceholders.filter(placeholder => !content.includes(placeholder));
  return missing.length ? `缺少占位符：${missing.join(', ')}` : '';
});
const promptDirty = computed(() => {
  const prompt = selectedPrompt.value; if (!prompt) return false;
  return promptDraft.value !== (prompt.overrideContent ?? prompt.defaultContent);
});
const canSavePrompt = computed(() => !!selectedPrompt.value && !promptValidationError.value);
const aiProviderStatusText = computed(() => {
  if (!aiProviderSettings.value) return '加载中';
  if (!aiProviderSettings.value.enabled) return '已禁用';
  if (!aiProviderSettings.value.hasApiKey) return '缺少 API Key';
  return '已配置';
});
const aiProviderStatusClass = computed(() => {
  if (!aiProviderSettings.value) return 'default';
  if (!aiProviderSettings.value.enabled) return 'disabled';
  if (!aiProviderSettings.value.hasApiKey) return 'warning';
  return 'overridden';
});
const aiProviderSourceText = computed(() => {
  const source = aiProviderSettings.value?.apiKeySource;
  if (source === 'database') return '数据库'; if (source === 'env') return '环境变量'; return '未配置';
});
const aiProviderValidationError = computed(() => {
  if (!aiProviderBaseUrl.value.trim()) return 'Base URL 不能为空';
  try { const parsed = new URL(aiProviderBaseUrl.value.trim()); if (!parsed.protocol.startsWith('http')) return 'Base URL 必须是 http/https'; } catch { return 'Base URL 必须是合法 URL'; }
  if (!aiProviderModel.value.trim()) return 'Model 不能为空';
  return '';
});
const aiProviderDirty = computed(() => {
  const current = aiProviderSettings.value; if (!current) return false;
  return aiProviderBaseUrl.value !== current.baseUrl || aiProviderModel.value !== current.model || aiProviderEnabled.value !== current.enabled || !!aiProviderApiKey.value.trim() || aiProviderClearKeyPending.value;
});

// ── Data Loading ───────────────────────────────────────
async function loadStatus() { try { indexStatus.value = await fetchIndexStatus(); indexErrors.value = await fetchIndexErrors(); } catch (_) {} }
async function loadPrompts() {
  try { promptRecords.value = await fetchAiPrompts(); if (!selectedPromptKey.value && promptRecords.value.length) selectedPromptKey.value = promptRecords.value[0].key; syncPromptDraft(); }
  catch (e: any) { promptMessage.value = e.message || '加载 Prompt 失败'; promptMessageType.value = 'error'; }
}
async function loadAiProviderSettings() {
  try { aiProviderSettings.value = await fetchAiProviderSettings(); resetAiProviderDraft(); }
  catch (e: any) { aiProviderMessage.value = e.message || '加载 AI Provider 配置失败'; aiProviderMessageType.value = 'error'; }
}

// ── AI Provider Handlers ───────────────────────────────
function resetAiProviderDraft() {
  if (!aiProviderSettings.value) return;
  aiProviderBaseUrl.value = aiProviderSettings.value.baseUrl; aiProviderModel.value = aiProviderSettings.value.model; aiProviderEnabled.value = aiProviderSettings.value.enabled; aiProviderApiKey.value = ''; aiProviderClearKeyPending.value = false;
}
function markAiProviderKeyForClear() { aiProviderApiKey.value = ''; aiProviderClearKeyPending.value = true; }
function buildAiProviderPayload() {
  return { baseUrl: aiProviderBaseUrl.value.trim(), model: aiProviderModel.value.trim(), enabled: aiProviderEnabled.value, ...(aiProviderApiKey.value.trim() ? { apiKey: aiProviderApiKey.value.trim() } : {}), ...(aiProviderClearKeyPending.value ? { clearApiKey: true } : {}) };
}
async function handleSaveAiProvider() {
  if (aiProviderValidationError.value) { aiProviderMessage.value = aiProviderValidationError.value; aiProviderMessageType.value = 'error'; return; }
  aiProviderSaving.value = true; aiProviderMessage.value = '';
  try { aiProviderSettings.value = await updateAiProviderSettings(buildAiProviderPayload()); resetAiProviderDraft(); aiProviderTestResult.value = null; aiProviderMessage.value = aiProviderEnabled.value ? 'AI Provider 配置已保存并立即生效' : 'AI Provider 已保存为禁用状态'; aiProviderMessageType.value = 'success'; }
  catch (e: any) { aiProviderMessage.value = e.message || '保存 AI Provider 配置失败'; aiProviderMessageType.value = 'error'; }
  finally { aiProviderSaving.value = false; }
}
async function handleTestAiProvider() {
  if (aiProviderValidationError.value) { aiProviderMessage.value = aiProviderValidationError.value; aiProviderMessageType.value = 'error'; return; }
  aiProviderTesting.value = true; aiProviderMessage.value = ''; aiProviderTestResult.value = null;
  try { aiProviderTestResult.value = await testAiProviderConnection(buildAiProviderPayload()); aiProviderMessage.value = aiProviderTestResult.value.message; aiProviderMessageType.value = aiProviderTestResult.value.success ? 'success' : 'error'; }
  catch (e: any) { aiProviderMessage.value = e.message || '测试连接失败'; aiProviderMessageType.value = 'error'; }
  finally { aiProviderTesting.value = false; }
}
function discardAiProviderChanges() { resetAiProviderDraft(); aiProviderTestResult.value = null; aiProviderMessage.value = '已放弃未保存修改'; aiProviderMessageType.value = 'success'; }

// ── Prompt Handlers ────────────────────────────────────
function selectPrompt(key: PromptKey) { selectedPromptKey.value = key; syncPromptDraft(); promptMessage.value = ''; }
function syncPromptDraft() { const prompt = selectedPrompt.value; if (!prompt) return; promptDraft.value = prompt.overrideContent ?? prompt.defaultContent; }
function promptStatusText(prompt: PromptRecord) { if (!prompt.isOverridden) return '默认'; return prompt.enabled ? '已覆盖' : '已禁用覆盖'; }
function promptStatusClass(prompt: PromptRecord) { if (!prompt.isOverridden) return 'default'; return prompt.enabled ? 'overridden' : 'disabled'; }
function discardPromptChanges() { syncPromptDraft(); promptMessage.value = '已放弃未保存修改'; promptMessageType.value = 'success'; }
async function handleSavePrompt(enabled: boolean) {
  const prompt = selectedPrompt.value; if (!prompt) return; promptSaving.value = true; promptMessage.value = '';
  try { await updateAiPrompt(prompt.key, { content: promptDraft.value, enabled }); await loadPrompts(); selectedPromptKey.value = prompt.key; syncPromptDraft(); promptMessage.value = enabled ? 'Prompt override 已保存并启用' : 'Prompt override 已保存但未启用'; promptMessageType.value = 'success'; }
  catch (e: any) { promptMessage.value = e.message || '保存 Prompt 失败'; promptMessageType.value = 'error'; }
  finally { promptSaving.value = false; }
}
async function handleTogglePromptEnabled() {
  const prompt = selectedPrompt.value; if (!prompt || !prompt.isOverridden) return; promptSaving.value = true; promptMessage.value = '';
  try { await updateAiPrompt(prompt.key, { content: prompt.overrideContent || promptDraft.value, enabled: !prompt.enabled, notes: prompt.notes ?? null }); await loadPrompts(); selectedPromptKey.value = prompt.key; syncPromptDraft(); promptMessage.value = !prompt.enabled ? 'Override 已启用' : 'Override 已禁用，运行时将回退默认 Prompt'; promptMessageType.value = 'success'; }
  catch (e: any) { promptMessage.value = e.message || '切换 override 状态失败'; promptMessageType.value = 'error'; }
  finally { promptSaving.value = false; }
}
async function handleResetPrompt() {
  const prompt = selectedPrompt.value; if (!prompt) return; promptSaving.value = true; promptMessage.value = '';
  try { await resetAiPrompt(prompt.key); await loadPrompts(); selectedPromptKey.value = prompt.key; syncPromptDraft(); promptMessage.value = '已恢复默认 Prompt'; promptMessageType.value = 'success'; }
  catch (e: any) { promptMessage.value = e.message || '重置 Prompt 失败'; promptMessageType.value = 'error'; }
  finally { promptSaving.value = false; }
}

// ── Config Handlers ────────────────────────────────────
async function handleSave() {
  saving.value = true; message.value = ''; indexResult.value = null;
  try { const result = await updateConfig(vaultPath.value); config.value = { ...config.value!, vaultPath: vaultPath.value }; indexResult.value = result.indexResult; message.value = 'Vault 路径已更新，索引完成'; messageType.value = 'success'; }
  catch (e: any) { message.value = e.message || '保存失败'; messageType.value = 'error'; }
  finally { saving.value = false; }
}
async function handleReindex() {
  reindexing.value = true; message.value = ''; indexResult.value = null;
  try { indexResult.value = await triggerIndex(); message.value = '重新索引完成'; messageType.value = 'success'; await loadStatus(); }
  catch (e: any) { message.value = e.message || '索引失败'; messageType.value = 'error'; }
  finally { reindexing.value = false; }
}

function formatTime(ts: string) { return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }

// ── WebSocket ──────────────────────────────────────────
function handleWsUpdate(_event: Event) { loadStatus(); }

// ── Integrations ──────────────────────────────────────
import type { IntegrationStatus } from '@lifeos/shared';
const integrations = ref<IntegrationStatus[]>([]);

async function loadIntegrations() {
  try { integrations.value = await fetchIntegrations(); } catch { /* ignore */ }
}

function handleConnect(provider: string) {
  // Future: redirect to OAuth flow. For now, placeholder.
  alert(`即将跳转至 ${provider} 授权页面（OAuth 流程由 C 组后端提供）`);
}

function handleDisconnect(provider: string) {
  if (!confirm(`确定断开与 ${provider} 的连接吗？`)) return;
  integrations.value = integrations.value.map(i => i.provider === provider ? { ...i, connected: false, lastSyncAt: null } : i);
}

onMounted(async () => {
  try { config.value = await fetchConfig(); vaultPath.value = config.value.vaultPath; }
  catch (e) { message.value = '加载配置失败'; messageType.value = 'error'; }
  await loadStatus();
  await loadPrompts();
  await loadAiProviderSettings();
  loadIntegrations();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => { document.removeEventListener('ws-update', handleWsUpdate); });
</script>

<style scoped>
.settings-view { max-width: 800px; margin: 0 auto; }
.settings-view h2 { font-size: 22px; margin-bottom: 20px; }
.settings-card { background: var(--card-bg); border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px var(--shadow); }
.settings-card h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #555; }
.input-row { display: flex; gap: 8px; }
.input-row input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.input-row input:focus { outline: none; border-color: #409eff; }
.input-row button { padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; white-space: nowrap; }
.input-row button:hover:not(:disabled) { background: #337ecc; }
.input-row button:disabled { opacity: 0.6; cursor: not-allowed; }
.hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.message { padding: 10px 14px; border-radius: 4px; font-size: 14px; margin-top: 12px; }
.message.success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
.message.error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }
.index-result { margin-top: 16px; padding: 12px; background: var(--meta-bg); border-radius: 4px; }
.index-result h4 { font-size: 14px; margin-bottom: 8px; color: #555; }
.stats-row { display: flex; gap: 16px; flex-wrap: wrap; }
.stat { font-size: 13px; color: var(--text-secondary); }
.stat.indexed { color: #67c23a; } .stat.skipped { color: #909399; } .stat.deleted { color: #e6a23c; } .stat.errors { color: #f56c6c; }
.action-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.btn-reindex { padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-reindex:hover:not(:disabled) { background: #337ecc; }
.btn-reindex:disabled { opacity: 0.6; cursor: not-allowed; }
.queue-info { font-size: 13px; color: #909399; }
.error-log { margin-top: 16px; }
.error-log h4 { font-size: 14px; color: #f56c6c; margin-bottom: 8px; }
.error-list { max-height: 200px; overflow-y: auto; border: 1px solid #fde2e2; border-radius: 4px; background: #fef0f0; }
.error-item { display: flex; gap: 12px; padding: 6px 10px; font-size: 12px; border-bottom: 1px solid #fde2e2; }
.error-item:last-child { border-bottom: none; }
.error-time { color: #999; white-space: nowrap; } .error-path { color: #333; word-break: break-all; } .error-msg { color: #f56c6c; white-space: nowrap; }
.btn-worker { padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-worker:hover:not(:disabled) { background: #337ecc; }
.btn-worker:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-link { border: none; background: transparent; color: #409eff; cursor: pointer; padding: 0; }
.btn-cancel, .btn-confirm-danger { padding: 8px 18px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; font-size: 14px; transition: all 0.2s; }
.btn-cancel { background: var(--surface-muted); color: var(--text-secondary); }
.btn-cancel:hover { background: color-mix(in srgb, var(--surface-muted) 88%, white); }
.btn-confirm-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); border-color: color-mix(in srgb, var(--danger) 28%, var(--border)); }
.btn-confirm-danger:hover { background: color-mix(in srgb, var(--danger) 20%, transparent); }
.btn-danger-sm { padding: 6px 14px; border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); cursor: pointer; font-size: 12px; }
.toggle-btn { flex-shrink: 0; padding: 6px 16px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-muted); color: var(--text-secondary); cursor: pointer; font-size: 13px; transition: all 0.2s; }
.toggle-btn.active { border-color: color-mix(in srgb, var(--ok) 40%, var(--border)); background: color-mix(in srgb, var(--ok) 12%, transparent); color: var(--ok); }

/* Provider */
.provider-summary { display: grid; gap: 8px; margin-bottom: 16px; }
.provider-summary-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.provider-summary-row:last-child { border-bottom: none; }
.provider-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.provider-toggle-group { display: flex; flex-direction: column; justify-content: center; }
.switch-row { display: flex; align-items: center; gap: 8px; }
.provider-key-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.provider-key-meta :deep(.privacy-wrap) { display: inline-flex; width: auto; }
.provider-key-meta :deep(.privacy-mask) { padding: 6px 10px; border-radius: 999px; }
.provider-test-result { margin-top: 12px; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; background: var(--meta-bg); font-size: 13px; color: var(--text-secondary); display: grid; gap: 6px; }

/* Prompt */
.prompt-center { display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); gap: 16px; }
.prompt-list { display: flex; flex-direction: column; gap: 10px; }
.prompt-list-item { text-align: left; border: 1px solid var(--border-color, #e5e7eb); background: var(--card-bg); border-radius: 8px; padding: 12px; cursor: pointer; }
.prompt-list-item.active { border-color: #409eff; box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.15); }
.prompt-list-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.prompt-key, .prompt-updated { font-size: 12px; color: var(--text-muted); }
.prompt-desc { font-size: 13px; color: var(--text-secondary); margin: 6px 0; }
.prompt-status { font-size: 12px; border-radius: 999px; padding: 2px 8px; }
.prompt-status.default { background: #f3f4f6; color: #6b7280; }
.prompt-status.overridden { background: #ecfdf3; color: #16a34a; }
.prompt-status.disabled { background: #fff7ed; color: #ea580c; }
.prompt-status.warning { background: #fef3c7; color: #b45309; }
.prompt-editor { border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: 16px; background: var(--card-bg); }
.prompt-editor-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.prompt-editor-head h4 { margin: 0; }
.placeholder-list { display: flex; flex-wrap: wrap; gap: 8px; }
.placeholder-list code { background: var(--meta-bg); border-radius: 4px; padding: 2px 6px; font-size: 12px; }
.prompt-textarea { width: 100%; resize: vertical; min-height: 240px; border: 1px solid #ddd; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: var(--card-bg); color: var(--text); }
.prompt-textarea.readonly { background: var(--meta-bg); }
.prompt-default-panel { margin-top: 16px; }
.prompt-default-panel summary { cursor: pointer; color: var(--text-secondary); margin-bottom: 12px; }
.prompt-actions { flex-wrap: wrap; }

/* System info */
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.info-row:last-child { border-bottom: none; }
.info-row .label { color: var(--text-muted); }
.info-row .value { color: var(--text); font-family: monospace; }
.info-row .value.ws-on { color: #67c23a; }
.info-row .value.ws-off { color: #f56c6c; }

/* Security */
.security-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border); }
.security-row:last-of-type { border-bottom: none; }
.security-label { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.security-hint { font-size: 12px; color: var(--text-muted); }
.security-actions { display: flex; gap: 8px; align-items: center; }
.pin-setup { padding: 16px; margin-top: 8px; border: 1px solid var(--border); border-radius: 16px; background: color-mix(in srgb, var(--surface-muted) 60%, transparent); display: grid; gap: 12px; }
.security-question-section { padding: 14px; border-radius: 12px; background: color-mix(in srgb, var(--signal-soft) 50%, transparent); border: 1px solid color-mix(in srgb, var(--signal) 16%, var(--border)); display: grid; gap: 10px; }
.section-label { margin: 0 0 4px; font-size: 13px; font-weight: 600; color: var(--signal); }
.timeout-select { padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 13px; cursor: pointer; }

/* Confirm overlay */
.confirm-overlay { position: fixed; inset: 0; z-index: 9100; display: flex; align-items: center; justify-content: center; background: rgba(4, 11, 20, 0.6); backdrop-filter: blur(8px); }
.confirm-card { padding: 28px; border: 1px solid var(--border-strong); border-radius: 24px; background: color-mix(in srgb, var(--surface-strong) 96%, transparent); box-shadow: 0 32px 64px -28px var(--shadow-strong); width: min(380px, 90vw); display: grid; gap: 14px; }
.confirm-card h3 { margin: 0; font-size: 18px; }
.confirm-card p { margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.6; }
.confirm-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }

@media (max-width: 900px) {
  .prompt-center { grid-template-columns: 1fr; }
}
</style>
