/**
 * AI Handlers — prompts, provider, suggestions
 */
import { Request, Response } from 'express';
import { isValidPromptKey, listPromptRecords, resetPromptOverride, upsertPromptOverride } from '../../ai/promptService.js';
import { getAiProviderSettings, testAiProviderConnection, upsertAiProviderSettings, validateAiProviderSettings } from '../../ai/providerConfigService.js';
import { listAiSuggestions } from '../../ai/suggestions.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('aiHandlers');

import type { ApiResponse, ListAiPromptsResponse, AiPromptResponse, ResetAiPromptResponse, AiProviderSettings, UpdatePromptRequest, UpdateAiProviderSettingsRequest, TestAiProviderConnectionRequest, TestAiProviderConnectionResponse, ListAiSuggestionsResponse } from '@lifeos/shared';

export async function listAiPrompts(
  _req: Request<Record<string, never>, ApiResponse<ListAiPromptsResponse>>,
  res: Response<ApiResponse<ListAiPromptsResponse>>,
): Promise<void> {
  try {
    const response: ListAiPromptsResponse = { prompts: listPromptRecords() };
    res.json(response);
  } catch (error) {
    logger.error('List AI prompts error:', error);
    res.status(500).json({ error: 'Failed to list AI prompts' });
  }
}

export async function updateAiPrompt(
  req: Request<{ key: string }, ApiResponse<AiPromptResponse>, UpdatePromptRequest>,
  res: Response<ApiResponse<AiPromptResponse>>,
): Promise<void> {
  try {
    const { key } = req.params;
    if (!isValidPromptKey(key)) { res.status(400).json({ error: 'Invalid prompt key' }); return; }
    const body = req.body;
    if (typeof body?.content !== 'string') { res.status(400).json({ error: 'content is required' }); return; }
    const record = upsertPromptOverride(key, body.content, body.enabled ?? true, body.notes ?? null);
    const response: AiPromptResponse = { prompt: record };
    res.json(response);
  } catch (error: any) {
    const message = error?.message || 'Failed to update AI prompt';
    if (message.includes('Prompt content') || message.includes('placeholder')) { res.status(400).json({ error: message }); return; }
    logger.error('Update AI prompt error:', error);
    res.status(500).json({ error: message });
  }
}

export async function resetAiPrompt(
  req: Request<{ key: string }, ApiResponse<ResetAiPromptResponse>>,
  res: Response<ApiResponse<ResetAiPromptResponse>>,
): Promise<void> {
  try {
    const { key } = req.params;
    if (!isValidPromptKey(key)) { res.status(400).json({ error: 'Invalid prompt key' }); return; }
    resetPromptOverride(key);
    const response: ResetAiPromptResponse = { success: true };
    res.json(response);
  } catch (error) {
    logger.error('Reset AI prompt error:', error);
    res.status(500).json({ error: 'Failed to reset AI prompt' });
  }
}

export async function getAiProviderHandler(
  _req: Request<Record<string, never>, ApiResponse<AiProviderSettings>>,
  res: Response<ApiResponse<AiProviderSettings>>,
): Promise<void> {
  try {
    const response: AiProviderSettings = getAiProviderSettings();
    res.json(response);
  } catch (error) {
    logger.error('Get AI provider settings error:', error);
    res.status(500).json({ error: 'Failed to fetch AI provider settings' });
  }
}

export async function updateAiProviderHandler(
  req: Request<Record<string, never>, ApiResponse<AiProviderSettings>, UpdateAiProviderSettingsRequest>,
  res: Response<ApiResponse<AiProviderSettings>>,
): Promise<void> {
  try {
    const body = req.body;
    validateAiProviderSettings(body || {});
    const response: AiProviderSettings = upsertAiProviderSettings(body || {});
    res.json(response);
  } catch (error: any) {
    const message = error?.message || 'Failed to update AI provider settings';
    if (message.includes('baseUrl') || message.includes('model') || message.includes('enabled') || message.includes('apiKey') || message.includes('clearApiKey')) {
      res.status(400).json({ error: message }); return;
    }
    logger.error('Update AI provider settings error:', error);
    res.status(500).json({ error: message });
  }
}

export async function testAiProviderHandler(
  req: Request<Record<string, never>, ApiResponse<TestAiProviderConnectionResponse>, TestAiProviderConnectionRequest>,
  res: Response<ApiResponse<TestAiProviderConnectionResponse>>,
): Promise<void> {
  try {
    const body = req.body || {};
    validateAiProviderSettings(body);
    const response: TestAiProviderConnectionResponse = await testAiProviderConnection(body);
    res.json(response);
  } catch (error: any) {
    const message = error?.message || 'Failed to test AI provider connection';
    if (message.includes('baseUrl') || message.includes('model') || message.includes('enabled') || message.includes('apiKey') || message.includes('clearApiKey')) {
      res.status(400).json({ error: message }); return;
    }
    logger.error('Test AI provider connection error:', error);
    res.status(500).json({ error: message });
  }
}

export async function listAiSuggestionsHandler(
  _req: Request<Record<string, never>, ApiResponse<ListAiSuggestionsResponse>>,
  res: Response<ApiResponse<ListAiSuggestionsResponse>>,
): Promise<void> {
  try {
    const response: ListAiSuggestionsResponse = { suggestions: await listAiSuggestions() };
    res.json(response);
  } catch (error) {
    logger.error('List AI suggestions error:', error);
    res.status(500).json({ error: 'Failed to fetch AI suggestions' });
  }
}
