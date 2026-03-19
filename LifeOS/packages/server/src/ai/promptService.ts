import type { PromptKey, PromptRecord } from '@lifeos/shared';
import { getDb } from '../db/client.js';
import { PROMPT_KEYS, getPromptRegistryItem } from './prompts.js';

interface PromptOverrideRow {
  key: PromptKey;
  content: string;
  enabled: number;
  updated_at: string;
  notes: string | null;
}

function getPromptOverride(key: PromptKey): PromptOverrideRow | undefined {
  const db = getDb();
  return db.prepare('SELECT key, content, enabled, updated_at, notes FROM ai_prompts WHERE key = ?').get(key) as PromptOverrideRow | undefined;
}

export function isValidPromptKey(key: string): key is PromptKey {
  return PROMPT_KEYS.includes(key as PromptKey);
}

export function validatePromptContent(key: PromptKey, content: string): void {
  const registryItem = getPromptRegistryItem(key);
  const normalized = content.trim();
  if (!normalized) {
    throw new Error('Prompt content cannot be empty');
  }

  for (const placeholder of registryItem.requiredPlaceholders) {
    if (!normalized.includes(placeholder)) {
      throw new Error(`Prompt must include placeholder: ${placeholder}`);
    }
  }
}

function toPromptRecord(key: PromptKey, override?: PromptOverrideRow): PromptRecord {
  const registryItem = getPromptRegistryItem(key);
  const isEnabled = !!override?.enabled;
  const effectiveContent = override && isEnabled ? override.content : registryItem.defaultContent;

  return {
    key,
    label: registryItem.label,
    description: registryItem.description,
    requiredPlaceholders: registryItem.requiredPlaceholders,
    defaultContent: registryItem.defaultContent,
    overrideContent: override?.content ?? null,
    effectiveContent,
    enabled: override ? isEnabled : true,
    updatedAt: override?.updated_at ?? null,
    notes: override?.notes ?? null,
    isOverridden: !!override,
  };
}

export function listPromptRecords(): PromptRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT key, content, enabled, updated_at, notes FROM ai_prompts').all() as PromptOverrideRow[];
  const overrideMap = new Map(rows.map(row => [row.key, row]));
  return PROMPT_KEYS.map(key => toPromptRecord(key, overrideMap.get(key)));
}

export function getEffectivePrompt(key: PromptKey): string {
  return toPromptRecord(key, getPromptOverride(key)).effectiveContent;
}

export function upsertPromptOverride(key: PromptKey, content: string, enabled = true, notes?: string | null): PromptRecord {
  validatePromptContent(key, content);

  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(`
    INSERT INTO ai_prompts (key, content, enabled, updated_at, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      content = excluded.content,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at,
      notes = excluded.notes
  `).run(key, content.trim(), enabled ? 1 : 0, now, notes ?? null);

  return toPromptRecord(key, getPromptOverride(key));
}

export function resetPromptOverride(key: PromptKey): void {
  const db = getDb();
  db.prepare('DELETE FROM ai_prompts WHERE key = ?').run(key);
}
