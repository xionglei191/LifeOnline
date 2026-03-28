/**
 * Vault Asset Handler — serve image files from the Vault directory.
 *
 * Only whitelisted image extensions are served.  The handler performs a
 * recursive search through the configured vault path so that Obsidian-style
 * `![[filename.jpg]]` references (which carry no directory information) can
 * be resolved regardless of which sub-folder the asset lives in.
 */
import { Request, Response } from 'express';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { loadConfig } from '../../config/configManager.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('vaultAsset');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']);

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
};

/**
 * Recursively search `dir` for a file whose basename matches `targetName`.
 * Returns the absolute path on first match, or null.
 */
async function findFileRecursive(dir: string, targetName: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === targetName) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = await findFileRecursive(fullPath, targetName);
        if (found) return found;
      }
    }
  } catch {
    // Directory not readable – skip silently
  }
  return null;
}

// Simple in-memory LRU cache for resolved file paths (avoids repeated FS scans)
const pathCache = new Map<string, { path: string; ts: number }>();
const PATH_CACHE_MAX = 200;
const PATH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPath(filename: string): string | null {
  const entry = pathCache.get(filename);
  if (!entry) return null;
  if (Date.now() - entry.ts > PATH_CACHE_TTL_MS) {
    pathCache.delete(filename);
    return null;
  }
  return entry.path;
}

function setCachedPath(filename: string, filePath: string) {
  // Evict oldest if over limit
  if (pathCache.size >= PATH_CACHE_MAX) {
    const oldest = pathCache.keys().next().value;
    if (oldest) pathCache.delete(oldest);
  }
  pathCache.set(filename, { path: filePath, ts: Date.now() });
}

export async function vaultAssetHandler(req: Request, res: Response): Promise<void> {
  const { filename } = req.params;

  if (!filename) {
    res.status(400).json({ error: 'filename is required' });
    return;
  }

  // Security: reject path traversal attempts
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    res.status(400).json({ error: 'invalid filename' });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    res.status(403).json({ error: 'file type not allowed' });
    return;
  }

  // Try cache first
  let filePath = getCachedPath(filename);

  if (!filePath) {
    const config = await loadConfig();
    filePath = await findFileRecursive(config.vaultPath, filename);
    if (!filePath) {
      res.status(404).json({ error: 'file not found' });
      return;
    }
    setCachedPath(filename, filePath);
  }

  // Verify file still exists (cache might be stale)
  try {
    await fs.access(filePath);
  } catch {
    pathCache.delete(filename);
    res.status(404).json({ error: 'file not found' });
    return;
  }

  const mime = MIME_MAP[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');

  const stream = createReadStream(filePath);
  stream.on('error', (err) => {
    logger.error(`Failed to stream vault asset ${filename}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal error' });
    }
  });
  stream.pipe(res);
}
