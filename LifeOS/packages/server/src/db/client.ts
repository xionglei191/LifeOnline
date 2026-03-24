import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { runMigrations } from './migrations.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';

const logger = new Logger('db');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../..');

function getDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }

  return path.join(SERVER_ROOT, 'data/lifeos.db');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
  }
  return db;
}

export function initDatabase(): void {
  const database = getDb();

  // Apply the central schema template (CREATE TABLE IF NOT EXISTS)
  database.exec(SCHEMA);

  // Run all migrations (additive columns, constraint updates, safe rebuilds)
  runMigrations(database);

  logger.info('Database initialized successfully');
  logger.info(`Database path: ${getDbPath()}`);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
