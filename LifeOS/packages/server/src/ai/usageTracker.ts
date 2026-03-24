import { getDb } from '../db/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('usageTracker');

export interface AiUsageRecord {
  date: string; // YYYY-MM-DD
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Logs AI token usage to the database.
 * If a record for the current date and endpoint already exists, it increments the tokens.
 * Otherwise, it creates a new record.
 */
export function logAiUsage(endpoint: string, inputTokens: number, outputTokens: number): void {
  try {
    const db = getDb();
    const date = new Date().toISOString().split('T')[0]; // Current UTC date

    // Try to update existing record for today and this endpoint
    const result = db.prepare(`
      UPDATE ai_usage 
      SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?
      WHERE date = ? AND endpoint = ?
    `).run(inputTokens, outputTokens, date, endpoint);

    // If no rows were updated, it means no record exists yet, so insert one
    if (result.changes === 0) {
      db.prepare(`
        INSERT INTO ai_usage (date, endpoint, input_tokens, output_tokens)
        VALUES (?, ?, ?, ?)
      `).run(date, endpoint, inputTokens, outputTokens);
    }
  } catch (error) {
    logger.error('Failed to log AI usage (non-fatal):', error);
  }
}

/**
 * Retrieves aggregated AI usage reports for the past N days.
 */
export function getAiUsageReport(days: number = 7): AiUsageRecord[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT date, endpoint, input_tokens, output_tokens
      FROM ai_usage
      WHERE date >= date('now', ?)
      ORDER BY date ASC
    `).all(`-${days} days`) as any[];

    return rows.map(r => ({
      date: r.date,
      endpoint: r.endpoint,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
    }));
  } catch (error) {
    logger.error('Failed to get AI usage report:', error);
    return [];
  }
}

/**
 * Gets the total tokens (input + output) used today.
 */
export function getTodayTotalTokens(): number {
  try {
    const db = getDb();
    const date = new Date().toISOString().split('T')[0];
    const row = db.prepare(`
      SELECT SUM(input_tokens + output_tokens) as total
      FROM ai_usage
      WHERE date = ?
    `).get(date) as { total: number | null };
    return row?.total || 0;
  } catch (error) {
    logger.error('Failed to get today total tokens:', error);
    return 0;
  }
}
