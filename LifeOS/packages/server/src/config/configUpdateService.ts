import { restartWatcher } from '../index.js';
import { indexVault } from '../indexer/indexer.js';
import { loadStoredConfig, saveConfig, validateVaultPath } from './configManager.js';

export class InvalidVaultPathError extends Error {
  constructor() {
    super('Invalid vault path: directory does not exist or contains no .md files');
    this.name = 'InvalidVaultPathError';
  }
}

export interface UpdateConfigResult {
  indexResult: Awaited<ReturnType<typeof indexVault>> | null;
}

export async function updateStoredVaultPath(vaultPath: string): Promise<UpdateConfigResult> {
  const storedConfig = await loadStoredConfig();
  if (storedConfig.vaultPath === vaultPath) {
    return {
      indexResult: null,
    };
  }

  const isValid = await validateVaultPath(vaultPath);
  if (!isValid) {
    throw new InvalidVaultPathError();
  }

  await saveConfig({
    ...storedConfig,
    vaultPath,
  });

  const indexResult = await indexVault(vaultPath);
  await restartWatcher(vaultPath);

  return {
    indexResult,
  };
}
