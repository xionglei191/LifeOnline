/**
 * VectorStore — sqlite-vec powered vector storage and kNN search
 *
 * Uses the sqlite-vec extension for better-sqlite3 to create a virtual
 * table that stores float32 embeddings and supports L2-distance kNN queries.
 */
import type Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { Logger } from '../utils/logger.js';

const logger = new Logger('vectorStore');

// Default dimension — matches common embedding models (e.g. text-embedding-3-small = 1536)
// Will be configured based on actual embedding model in use
const DEFAULT_DIMENSION = 1536;

/**
 * Convert a number[] to a Buffer containing float32 values.
 * sqlite-vec expects raw binary data via better-sqlite3 Buffer binding.
 */
function toFloat32Buffer(vec: number[]): Buffer {
  const f32 = new Float32Array(vec);
  return Buffer.from(f32.buffer);
}

let vectorStoreReady = false;

/**
 * Initialize the sqlite-vec extension and create the vector virtual table.
 * Must be called after the database is opened and before any vector operations.
 * @param force — if true, drops and recreates the virtual table (useful for testing with different dimensions)
 */
export function initVectorStore(db: Database.Database, dimension = DEFAULT_DIMENSION, force = false): void {
  if (vectorStoreReady && !force) return;

  try {
    sqliteVec.load(db);
    logger.info('sqlite-vec extension loaded');

    if (force) {
      db.exec('DROP TABLE IF EXISTS vec_embeddings');
    }

    // Create the virtual table for embeddings
    // vec0 is the sqlite-vec virtual table module
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[${dimension}]
      )
    `);

    vectorStoreReady = true;
    logger.info(`Vector store initialized (dimension=${dimension})`);
  } catch (error) {
    logger.error('Failed to initialize vector store:', error);
    throw error;
  }
}

/**
 * Check if the vector store is initialized and ready for use.
 */
export function isVectorStoreReady(): boolean {
  return vectorStoreReady;
}

/**
 * Insert or replace an embedding vector for the given ID.
 */
export function upsertEmbedding(db: Database.Database, id: string, embedding: number[]): void {
  // vec0 virtual tables do not support ON CONFLICT / OR REPLACE,
  // so we delete first then insert.
  db.prepare('DELETE FROM vec_embeddings WHERE id = ?').run(id);
  db.prepare('INSERT INTO vec_embeddings(id, embedding) VALUES (?, ?)').run(id, toFloat32Buffer(embedding));
}

/**
 * Delete an embedding by ID.
 */
export function deleteEmbedding(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM vec_embeddings WHERE id = ?').run(id);
}

export interface VectorSearchResult {
  id: string;
  distance: number;
}

/**
 * Perform a kNN similarity search.
 * Returns the top-K most similar vectors sorted by L2 distance (ascending).
 */
export function searchSimilar(
  db: Database.Database,
  queryEmbedding: number[],
  topK = 5,
): VectorSearchResult[] {
  const rows = db.prepare(`
    SELECT id, distance
    FROM vec_embeddings
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `).all(toFloat32Buffer(queryEmbedding), topK) as VectorSearchResult[];

  return rows;
}

/**
 * Get the count of stored embeddings.
 */
export function getEmbeddingCount(db: Database.Database): number {
  const row = db.prepare('SELECT count(*) as cnt FROM vec_embeddings').get() as { cnt: number };
  return row.cnt;
}

/**
 * Reset the vector store state (for testing only).
 */
export function resetVectorStoreState(): void {
  vectorStoreReady = false;
}
