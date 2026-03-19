import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { closeDb } from '../../src/db/client.js';
import { stopServer } from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '../..');
const MOCK_VAULT_PATH = path.join(REPO_ROOT, 'mock-vault');

export interface TestEnv {
  rootDir: string;
  vaultPath: string;
  dbPath: string;
  port: number;
  cleanup: () => Promise<void>;
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

function nextPort(): number {
  const seed = Number.parseInt(process.pid.toString().slice(-3), 10) || 0;
  return 4100 + seed;
}

export async function createTestEnv(prefix = 'lifeos-test-'): Promise<TestEnv> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const vaultPath = path.join(rootDir, 'vault');
  const dbPath = path.join(rootDir, 'lifeos.db');
  const port = nextPort() + Math.floor(Math.random() * 100);

  await copyDirectory(MOCK_VAULT_PATH, vaultPath);

  process.env.VAULT_PATH = vaultPath;
  process.env.DB_PATH = dbPath;
  process.env.PORT = String(port);

  return {
    rootDir,
    vaultPath,
    dbPath,
    port,
    cleanup: async () => {
      await stopServer().catch(() => {});
      closeDb();
      delete process.env.VAULT_PATH;
      delete process.env.DB_PATH;
      delete process.env.PORT;
      await fs.rm(rootDir, { recursive: true, force: true });
    },
  };
}
