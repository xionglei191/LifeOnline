import type {
  AiProviderApiKeySource,
  AiProviderSettings,
  TestAiProviderConnectionRequest,
  TestAiProviderConnectionResponse,
  UpdateAiProviderSettingsRequest,
} from '@lifeos/shared';
import { getDb } from '../db/client.js';

const DEFAULT_PROVIDER_ID = 'default';
const DEFAULT_BASE_URL = 'https://codeflow.asia/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 15000;

interface AiProviderSettingsRow {
  id: string;
  base_url: string;
  model: string;
  api_key: string | null;
  enabled: number;
  updated_at: string;
}

interface EffectiveAiProviderConfig {
  baseUrl: string;
  model: string;
  enabled: boolean;
  apiKey: string;
  apiKeySource: Exclude<AiProviderApiKeySource, 'missing'>;
  updatedAt: string | null;
}

interface ResolvedAiProviderDraft {
  baseUrl: string;
  model: string;
  enabled: boolean;
  apiKey: string | null;
  apiKeySource: AiProviderApiKeySource;
  updatedAt: string | null;
}

function getStoredSettings(): AiProviderSettingsRow | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT id, base_url, model, api_key, enabled, updated_at
    FROM ai_provider_settings
    WHERE id = ?
  `).get(DEFAULT_PROVIDER_ID) as AiProviderSettingsRow | undefined;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}...${apiKey.slice(-2)}`;
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function getEnvApiKey(): string | null {
  return normalizeOptionalString(process.env.ANTHROPIC_API_KEY);
}

function resolveDraft(input?: UpdateAiProviderSettingsRequest | TestAiProviderConnectionRequest): ResolvedAiProviderDraft {
  const stored = getStoredSettings();
  const storedApiKey = normalizeOptionalString(stored?.api_key);
  const envApiKey = getEnvApiKey();

  const baseUrl = normalizeOptionalString(input?.baseUrl) ?? stored?.base_url ?? DEFAULT_BASE_URL;
  const model = normalizeOptionalString(input?.model) ?? stored?.model ?? DEFAULT_MODEL;
  const enabled = typeof input?.enabled === 'boolean' ? input.enabled : stored ? !!stored.enabled : true;

  let apiKey = storedApiKey;
  let apiKeySource: AiProviderApiKeySource = storedApiKey ? 'database' : envApiKey ? 'env' : 'missing';

  if (input?.clearApiKey) {
    apiKey = envApiKey;
    apiKeySource = envApiKey ? 'env' : 'missing';
  }

  if (typeof input?.apiKey === 'string') {
    const normalizedInputApiKey = normalizeOptionalString(input.apiKey);
    if (normalizedInputApiKey) {
      apiKey = normalizedInputApiKey;
      apiKeySource = 'database';
    }
  }

  if (!apiKey && envApiKey) {
    apiKey = envApiKey;
    apiKeySource = 'env';
  }

  return {
    baseUrl,
    model,
    enabled,
    apiKey,
    apiKeySource,
    updatedAt: stored?.updated_at ?? null,
  };
}

function toSafeSettings(draft: ResolvedAiProviderDraft): AiProviderSettings {
  return {
    baseUrl: draft.baseUrl,
    model: draft.model,
    enabled: draft.enabled,
    updatedAt: draft.updatedAt,
    hasApiKey: !!draft.apiKey,
    apiKeyMasked: maskApiKey(draft.apiKey),
    apiKeySource: draft.apiKeySource,
  };
}

export function validateAiProviderSettings(input: UpdateAiProviderSettingsRequest | TestAiProviderConnectionRequest): void {
  if (input.baseUrl !== undefined) {
    const normalizedBaseUrl = normalizeOptionalString(input.baseUrl);
    if (!normalizedBaseUrl) {
      throw new Error('baseUrl is required');
    }
    try {
      const parsed = new URL(normalizedBaseUrl);
      if (!parsed.protocol.startsWith('http')) {
        throw new Error('invalid');
      }
    } catch {
      throw new Error('baseUrl must be a valid URL');
    }
  }

  if (input.model !== undefined && !normalizeOptionalString(input.model)) {
    throw new Error('model is required');
  }

  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    throw new Error('enabled must be a boolean');
  }

  if (input.apiKey !== undefined && typeof input.apiKey !== 'string') {
    throw new Error('apiKey must be a string');
  }

  if (input.clearApiKey !== undefined && typeof input.clearApiKey !== 'boolean') {
    throw new Error('clearApiKey must be a boolean');
  }
}

export function getAiProviderSettings(): AiProviderSettings {
  return toSafeSettings(resolveDraft());
}

export function getEffectiveAiProviderConfig(): EffectiveAiProviderConfig {
  const resolved = resolveDraft();
  if (!resolved.enabled) {
    throw new Error('AI provider is disabled');
  }
  if (!resolved.apiKey) {
    throw new Error('AI provider API key is missing');
  }

  return {
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    enabled: resolved.enabled,
    apiKey: resolved.apiKey,
    apiKeySource: resolved.apiKeySource === 'missing' ? 'env' : resolved.apiKeySource,
    updatedAt: resolved.updatedAt,
  };
}

export function upsertAiProviderSettings(input: UpdateAiProviderSettingsRequest): AiProviderSettings {
  validateAiProviderSettings(input);

  const resolved = resolveDraft(input);
  const stored = getStoredSettings();
  const db = getDb();
  const now = new Date().toISOString();

  const dbApiKey = input.clearApiKey
    ? null
    : typeof input.apiKey === 'string'
      ? normalizeOptionalString(input.apiKey)
      : normalizeOptionalString(stored?.api_key);

  db.prepare(`
    INSERT INTO ai_provider_settings (id, base_url, model, api_key, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      base_url = excluded.base_url,
      model = excluded.model,
      api_key = excluded.api_key,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `).run(
    DEFAULT_PROVIDER_ID,
    resolved.baseUrl,
    resolved.model,
    dbApiKey,
    resolved.enabled ? 1 : 0,
    now,
  );

  return getAiProviderSettings();
}

async function performProviderRequest(baseUrl: string, model: string, apiKey: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`AI provider request failed: ${response.status} ${errorText}`.trim());
    }

    const data = await response.json();
    
    // Check for OpenAI format
    if (data?.choices?.[0]?.message?.content != null) {
      return;
    }
    
    // Fallback to Anthropic format
    const block = data?.content?.[0];
    if (!block || block.type !== 'text') {
      throw new Error('AI provider returned an unexpected response');
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('AI provider request timed out');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`AI provider network error: ${String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function testAiProviderConnection(
  input?: TestAiProviderConnectionRequest,
): Promise<TestAiProviderConnectionResponse> {
  if (input) {
    validateAiProviderSettings(input);
  }

  const resolved = resolveDraft(input);
  const startedAt = Date.now();

  if (!resolved.enabled) {
    return {
      success: false,
      message: 'AI provider is disabled',
      resolvedBaseUrl: resolved.baseUrl,
      resolvedModel: resolved.model,
    };
  }

  if (!resolved.apiKey) {
    return {
      success: false,
      message: 'AI provider API key is missing',
      resolvedBaseUrl: resolved.baseUrl,
      resolvedModel: resolved.model,
    };
  }

  try {
    await performProviderRequest(resolved.baseUrl, resolved.model, resolved.apiKey);
    return {
      success: true,
      message: 'AI provider connection succeeded',
      resolvedBaseUrl: resolved.baseUrl,
      resolvedModel: resolved.model,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'AI provider connection failed',
      resolvedBaseUrl: resolved.baseUrl,
      resolvedModel: resolved.model,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export { DEFAULT_BASE_URL, DEFAULT_MODEL };
