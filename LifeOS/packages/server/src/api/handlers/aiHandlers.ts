/**
 * AI Handlers — prompts, provider, suggestions
 */
import { Request, Response } from 'express';
import { isValidPromptKey, listPromptRecords, resetPromptOverride, upsertPromptOverride } from '../../ai/promptService.js';
import { getAiProviderSettings, testAiProviderConnection, upsertAiProviderSettings, validateAiProviderSettings } from '../../ai/providerConfigService.js';
import { listAiSuggestions } from '../../ai/suggestions.js';
import { generateLongTermPortrait } from '../../soul/longTermMemory.js';
import { generateInsightsReport } from '../../soul/insightsReport.js';
import { Logger } from '../../utils/logger.js';
import { sendSuccess, sendError } from '../responseHelper.js';

const logger = new Logger('aiHandlers');

import type { ApiResponse, ListAiPromptsResponse, AiPromptResponse, ResetAiPromptResponse, AiProviderSettings, UpdatePromptRequest, UpdateAiProviderSettingsRequest, TestAiProviderConnectionRequest, TestAiProviderConnectionResponse, ListAiSuggestionsResponse, GetLongTermMemoryResponse, GetInsightsReportResponse } from '@lifeos/shared';

export async function listAiPrompts(
  _req: Request<Record<string, never>, ApiResponse<ListAiPromptsResponse>>,
  res: Response<ApiResponse<ListAiPromptsResponse>>,
): Promise<void> {
  try {
    const data: ListAiPromptsResponse = { prompts: listPromptRecords() };
    sendSuccess(res, data);
  } catch (error) {
    logger.error('List AI prompts error:', error);
    sendError(res, 'Failed to list AI prompts');
  }
}

export async function updateAiPrompt(
  req: Request<{ key: string }, ApiResponse<AiPromptResponse>, UpdatePromptRequest>,
  res: Response<ApiResponse<AiPromptResponse>>,
): Promise<void> {
  try {
    const { key } = req.params;
    if (!isValidPromptKey(key)) { sendError(res, 'Invalid prompt key', 400); return; }
    const body = req.body;
    if (typeof body?.content !== 'string') { sendError(res, 'content is required', 400); return; }
    const record = upsertPromptOverride(key, body.content, body.enabled ?? true, body.notes ?? null);
    sendSuccess(res, { prompt: record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update AI prompt';
    if (message.includes('Prompt content') || message.includes('placeholder')) { sendError(res, message, 400); return; }
    logger.error('Update AI prompt error:', error);
    sendError(res, message);
  }
}

export async function resetAiPrompt(
  req: Request<{ key: string }, ApiResponse<ResetAiPromptResponse>>,
  res: Response<ApiResponse<ResetAiPromptResponse>>,
): Promise<void> {
  try {
    const { key } = req.params;
    if (!isValidPromptKey(key)) { sendError(res, 'Invalid prompt key', 400); return; }
    resetPromptOverride(key);
    sendSuccess(res, { success: true } as ResetAiPromptResponse);
  } catch (error) {
    logger.error('Reset AI prompt error:', error);
    sendError(res, 'Failed to reset AI prompt');
  }
}

export async function getAiProviderHandler(
  _req: Request<Record<string, never>, ApiResponse<AiProviderSettings>>,
  res: Response<ApiResponse<AiProviderSettings>>,
): Promise<void> {
  try {
    const data: AiProviderSettings = getAiProviderSettings();
    sendSuccess(res, data);
  } catch (error) {
    logger.error('Get AI provider settings error:', error);
    sendError(res, 'Failed to fetch AI provider settings');
  }
}

export async function updateAiProviderHandler(
  req: Request<Record<string, never>, ApiResponse<AiProviderSettings>, UpdateAiProviderSettingsRequest>,
  res: Response<ApiResponse<AiProviderSettings>>,
): Promise<void> {
  try {
    const body = req.body;
    validateAiProviderSettings(body || {});
    const data: AiProviderSettings = upsertAiProviderSettings(body || {});
    sendSuccess(res, data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update AI provider settings';
    if (message.includes('baseUrl') || message.includes('model') || message.includes('enabled') || message.includes('apiKey') || message.includes('clearApiKey')) {
      sendError(res, message, 400); return;
    }
    logger.error('Update AI provider settings error:', error);
    sendError(res, message);
  }
}

export async function testAiProviderHandler(
  req: Request<Record<string, never>, ApiResponse<TestAiProviderConnectionResponse>, TestAiProviderConnectionRequest>,
  res: Response<ApiResponse<TestAiProviderConnectionResponse>>,
): Promise<void> {
  try {
    const body = req.body || {};
    validateAiProviderSettings(body);
    const data: TestAiProviderConnectionResponse = await testAiProviderConnection(body);
    sendSuccess(res, data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to test AI provider connection';
    if (message.includes('baseUrl') || message.includes('model') || message.includes('enabled') || message.includes('apiKey') || message.includes('clearApiKey')) {
      sendError(res, message, 400); return;
    }
    logger.error('Test AI provider connection error:', error);
    sendError(res, message);
  }
}

export async function listAiSuggestionsHandler(
  _req: Request<Record<string, never>, ApiResponse<ListAiSuggestionsResponse>>,
  res: Response<ApiResponse<ListAiSuggestionsResponse>>,
): Promise<void> {
  try {
    const data: ListAiSuggestionsResponse = { suggestions: await listAiSuggestions() };
    sendSuccess(res, data);
  } catch (error) {
    logger.error('List AI suggestions error:', error);
    sendError(res, 'Failed to fetch AI suggestions');
  }
}

export async function getLongTermMemoryHandler(
  req: Request<Record<string, never>, ApiResponse<GetLongTermMemoryResponse>, any, { dimension?: string }>,
  res: Response<ApiResponse<GetLongTermMemoryResponse>>,
): Promise<void> {
  try {
    const { dimension } = req.query;
    if (!dimension || typeof dimension !== 'string') {
      sendError(res, 'Missing or invalid query parameter: dimension', 400);
      return;
    }
    const portrait = await generateLongTermPortrait(dimension);
    if (!portrait) {
      sendError(res, `No long term memory found for dimension: ${dimension}`, 404);
      return;
    }
    sendSuccess(res, { portrait });
  } catch (error) {
    logger.error('Get long term memory error:', error);
    sendError(res, 'Failed to generate long term memory');
  }
}

export async function getInsightsReportHandler(
  req: Request<Record<string, never>, ApiResponse<GetInsightsReportResponse>, any, { timeframeDays?: string }>,
  res: Response<ApiResponse<GetInsightsReportResponse>>,
): Promise<void> {
  try {
    const { timeframeDays } = req.query;
    let days = 14;
    if (timeframeDays && !isNaN(Number(timeframeDays))) {
      days = Number(timeframeDays);
    }
    const reportMarkdown = await generateInsightsReport(days);
    sendSuccess(res, { reportMarkdown });
  } catch (error) {
    logger.error('Get insights report error:', error);
    sendError(res, 'Failed to generate insights report');
  }
}
