import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export interface Config {
  vaultPath: string;
  port: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../..');
const CONFIG_FILE = path.join(SERVER_ROOT, 'config.json');

function resolvePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptionalPath(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveVaultPath(vaultPath: string): string {
  if (vaultPath.startsWith('~')) {
    return path.join(process.env.HOME || '', vaultPath.slice(1));
  }
  if (path.isAbsolute(vaultPath)) return vaultPath;
  return path.resolve(SERVER_ROOT, vaultPath);
}

export async function loadConfig(): Promise<Config> {
  const envVaultPath = normalizeOptionalPath(process.env.VAULT_PATH);
  const envPort = process.env.PORT;

  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as Partial<Config>;
    const fallbackPort = typeof config.port === 'number' ? config.port : 3000;

    return {
      vaultPath: resolveVaultPath(envVaultPath || config.vaultPath || '../../mock-vault'),
      port: resolvePort(envPort, fallbackPort),
    };
  } catch {
    return {
      vaultPath: resolveVaultPath(envVaultPath || '../../mock-vault'),
      port: resolvePort(envPort, 3000),
    };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function validateVaultPath(vaultPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(vaultPath);
    if (!stat.isDirectory()) return false;

    const entries = await fs.readdir(vaultPath);
    // Check root level
    if (entries.some(f => f.endsWith('.md'))) return true;
    // Check one level of subdirectories
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const sub = path.join(vaultPath, entry);
      try {
        const subStat = await fs.stat(sub);
        if (!subStat.isDirectory()) continue;
        const subFiles = await fs.readdir(sub);
        if (subFiles.some(f => f.endsWith('.md'))) return true;
      } catch { continue; }
    }
    return false;
  } catch (e) {
    return false;
  }
}
