/**
 * Config & Index Handlers
 */
import { Request, Response } from 'express';
import { broadcastUpdate, getIndexQueue } from '../../index.js';
import { loadConfig } from '../../config/configManager.js';
import { updateStoredVaultPath, InvalidVaultPathError } from '../../config/configUpdateService.js';
import { indexVault } from '../../indexer/indexer.js';
import { Logger } from '../../utils/logger.js';
import { sendSuccess, sendError } from '../responseHelper.js';
import type { ApiResponse, Config, UpdateConfigRequest, UpdateConfigResponse, IndexStatus, IndexErrorEventData, IndexResult } from '@lifeos/shared';

const logger = new Logger('configHandlers');

export async function getConfig(_req: Request<Record<string, never>, ApiResponse<Config>>, res: Response<ApiResponse<Config>>): Promise<void> {
  try {
    const config = await loadConfig();
    sendSuccess(res, config);
  } catch (error) {
    logger.error('Get config error:', error);
    sendError(res, 'Failed to fetch config');
  }
}

export async function updateConfig(req: Request<Record<string, never>, ApiResponse<UpdateConfigResponse>, UpdateConfigRequest>, res: Response<ApiResponse<UpdateConfigResponse>>): Promise<void> {
  try {
    const { vaultPath } = req.body;
    if (!vaultPath) { sendError(res, 'vaultPath is required', 400); return; }
    const result = await updateStoredVaultPath(vaultPath);
    if (result.indexResult) {
      broadcastUpdate({ type: 'index-complete', data: result.indexResult });
    }
    sendSuccess(res, { success: true, indexResult: result.indexResult } as UpdateConfigResponse);
  } catch (error) {
    if (error instanceof InvalidVaultPathError) { sendError(res, error.message, 400); return; }
    logger.error('Update config error:', error);
    sendError(res, 'Failed to update config');
  }
}

export async function triggerIndex(_req: Request<Record<string, never>, ApiResponse<IndexResult>>, res: Response<ApiResponse<IndexResult>>): Promise<void> {
  try {
    const config = await loadConfig();
    const result = await indexVault(config.vaultPath);
    broadcastUpdate({ type: 'index-complete', data: result });
    sendSuccess(res, result);
  } catch (error) {
    logger.error('Index error:', error);
    sendError(res, 'Indexing failed');
  }
}

export async function getIndexStatus(_req: Request<Record<string, never>, IndexStatus>, res: Response<IndexStatus>): Promise<void> {
  const queue = getIndexQueue();
  const status: IndexStatus = queue ? queue.getStatus() : { queueSize: 0, processing: false, processingFile: null };
  res.json(status);
}

export async function getIndexErrors(_req: Request<Record<string, never>, IndexErrorEventData[]>, res: Response<IndexErrorEventData[]>): Promise<void> {
  const queue = getIndexQueue();
  const errors: IndexErrorEventData[] = queue ? queue.getErrors() : [];
  res.json(errors);
}
