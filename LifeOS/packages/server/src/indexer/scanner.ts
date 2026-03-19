import fs from 'fs/promises';
import path from 'path';

export interface FileInfo {
  filePath: string;
  fileName: string;
  mtime: Date;
}

const IGNORED_DIRS = new Set(['.trash', '.obsidian', '.git', 'node_modules']);

export async function scanVault(vaultPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  async function scan(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stats = await fs.stat(fullPath);
        files.push({
          filePath: fullPath,
          fileName: entry.name,
          mtime: stats.mtime
        });
      }
    }
  }

  await scan(vaultPath);
  return files;
}
