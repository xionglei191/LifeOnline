import { restartWatcher } from '../index.js';
import { indexVault } from '../indexer/indexer.js';
import { loadStoredConfig, normalizeVaultPath, saveConfig, validateVaultPath } from './configManager.js';

export const configUpdateDeps = {
  indexVault,
  restartWatcher,
};

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
  const normalizedVaultPath = normalizeVaultPath(vaultPath);
  const storedConfig = await loadStoredConfig();
  if (storedConfig.vaultPath === normalizedVaultPath) {
    return {
      indexResult: null,
    };
  }

  const isValid = await validateVaultPath(normalizedVaultPath);
  if (!isValid) {
    throw new InvalidVaultPathError();
  }

  await saveConfig({
    ...storedConfig,
    vaultPath: normalizedVaultPath,
  });

  try {
    const indexResult = await configUpdateDeps.indexVault(normalizedVaultPath);
    await configUpdateDeps.restartWatcher(normalizedVaultPath);

    return {
      indexResult,
    };
  } catch (error) {
    await saveConfig(storedConfig);

    if (storedConfig.vaultPath !== normalizedVaultPath) {
      await configUpdateDeps.indexVault(storedConfig.vaultPath);
      await configUpdateDeps.restartWatcher(storedConfig.vaultPath);
    }

    throw error;
  }
}
