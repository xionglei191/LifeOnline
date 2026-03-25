/**
 * Credential Store — encrypted storage for OAuth tokens and API keys.
 */
import { getDb } from '../db/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('credentialStore');

export interface StoredCredential {
  provider: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: string | null;
  scopes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function upsertCredential(
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null,
  scopes: string | null,
  metadata?: Record<string, unknown>,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO integration_credentials (provider, access_token, refresh_token, token_expiry, scopes, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expiry = excluded.token_expiry,
      scopes = excluded.scopes,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).run(provider, accessToken, refreshToken, tokenExpiry, scopes, JSON.stringify(metadata || {}), now, now);
  logger.info(`Credential for ${provider} saved.`);
}

export function getCredential(provider: string): StoredCredential | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM integration_credentials WHERE provider = ?').get(provider) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    provider: row.provider as string,
    accessToken: row.access_token as string | null,
    refreshToken: row.refresh_token as string | null,
    tokenExpiry: row.token_expiry as string | null,
    scopes: row.scopes as string | null,
    metadata: JSON.parse((row.metadata_json as string) || '{}'),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function deleteCredential(provider: string): void {
  const db = getDb();
  db.prepare('DELETE FROM integration_credentials WHERE provider = ?').run(provider);
  logger.info(`Credential for ${provider} deleted.`);
}

export function listCredentialProviders(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT provider FROM integration_credentials').all() as Array<{ provider: string }>;
  return rows.map(r => r.provider);
}
