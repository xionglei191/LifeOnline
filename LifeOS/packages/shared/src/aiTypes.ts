// ── AI Provider Types ──────────────────────────────────

import type { Dimension } from './core.js';

export type PromptKey = 'classify' | 'extract_tasks' | 'summarize_note' | 'daily_report' | 'weekly_report' | 'suggest';

export interface PromptRecord {
  key: PromptKey;
  label: string;
  description: string;
  requiredPlaceholders: string[];
  defaultContent: string;
  overrideContent: string | null;
  effectiveContent: string;
  enabled: boolean;
  updatedAt: string | null;
  notes?: string | null;
  isOverridden: boolean;
}

export interface ListAiPromptsResponse {
  prompts: PromptRecord[];
}

export interface AiPromptResponse {
  prompt: PromptRecord;
}

export interface ResetAiPromptResponse {
  success: true;
}

export interface UpdatePromptRequest {
  content: string;
  enabled?: boolean;
  notes?: string | null;
}

export type AiProviderApiKeySource = 'database' | 'env' | 'missing';

export interface AiProviderSettings {
  baseUrl: string;
  model: string;
  enabled: boolean;
  updatedAt: string | null;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  apiKeySource: AiProviderApiKeySource;
}

export interface UpdateAiProviderSettingsRequest {
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface TestAiProviderConnectionRequest {
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface TestAiProviderConnectionResponse {
  success: boolean;
  message: string;
  resolvedBaseUrl: string;
  resolvedModel: string;
  latencyMs?: number;
}

export interface AISuggestion {
  id: string;
  type: 'balance' | 'overload' | 'goal' | 'reminder';
  title: string;
  content: string;
  dimension?: Exclude<Dimension, '_inbox'>;
  createdAt: string;
}

export interface ListAiSuggestionsResponse {
  suggestions: AISuggestion[];
}

export interface PersonaDimensionPortrait {
  dimension: string;
  summary: string;
  coreDrivers: string[];
  recurringBottlenecks: string[];
  generatedAt: string;
}

export interface GetLongTermMemoryResponse {
  portrait: PersonaDimensionPortrait;
}

export interface GetInsightsReportResponse {
  reportMarkdown: string;
}
