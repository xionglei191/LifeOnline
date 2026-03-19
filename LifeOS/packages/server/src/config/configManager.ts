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

function resolveVaultPath(vaultPath: string): string {
  if (vaultPath.startsWith('~')) {
    return path.join(process.env.HOME || '', vaultPath.slice(1));
  }
  if (path.isAbsolute(vaultPath)) return vaultPath;
  return path.resolve(SERVER_ROOT, vaultPath);
}

export async function loadConfig(): Promise<Config> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content);
    config.vaultPath = resolveVaultPath(config.vaultPath);
    return config;
  } catch (e) {
    const raw = process.env.VAULT_PATH || '../../mock-vault';
    return {
      vaultPath: resolveVaultPath(raw),
      port: 3000,
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
