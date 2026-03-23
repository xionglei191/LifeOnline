/**
 * Config & Index Handlers
 */
import { Request, Response } from 'express';
import { broadcastUpdate, getIndexQueue } from '../../index.js';
import { loadConfig } from '../../config/configManager.js';
import { updateStoredVaultPath, InvalidVaultPathError } from '../../config/configUpdateService.js';
import { indexVault } from '../../indexer/indexer.js';
import type { ApiResponse, Config, UpdateConfigRequest, UpdateConfigResponse, IndexStatus, IndexErrorEventData, IndexResult } from '@lifeos/shared';

export async function getConfig(_req: Request<Record<string, never>, ApiResponse<Config>>, res: Response<ApiResponse<Config>>): Promise<void> {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
}

export async function updateConfig(req: Request<Record<string, never>, ApiResponse<UpdateConfigResponse>, UpdateConfigRequest>, res: Response<ApiResponse<UpdateConfigResponse>>): Promise<void> {
  try {
    const { vaultPath } = req.body;
    if (!vaultPath) { res.status(400).json({ error: 'vaultPath is required' }); return; }
    const result = await updateStoredVaultPath(vaultPath);
    if (result.indexResult) {
      broadcastUpdate({ type: 'index-complete', data: result.indexResult });
    }
    const response: UpdateConfigResponse = { success: true, indexResult: result.indexResult };
    res.json(response);
  } catch (error) {
    if (error instanceof InvalidVaultPathError) { res.status(400).json({ error: error.message }); return; }
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
}

export async function triggerIndex(_req: Request<Record<string, never>, ApiResponse<IndexResult>>, res: Response<ApiResponse<IndexResult>>): Promise<void> {
  try {
    const config = await loadConfig();
    const result = await indexVault(config.vaultPath);
    broadcastUpdate({ type: 'index-complete', data: result });
    res.json(result);
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({ error: 'Indexing failed' });
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
