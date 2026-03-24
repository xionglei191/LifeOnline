/**
 * Hybrid Search — combines FTS5 keyword search with sqlite-vec vector semantic search.
 * Results are merged using Reciprocal Rank Fusion (RRF).
 */
import { getDb } from './client.js';
import { isVectorStoreReady, searchSimilar } from './vectorStore.js';
import { getEmbedding } from '../ai/embedding.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('hybridSearch');

const RRF_K = 60; // Standard RRF constant

export interface HybridSearchResult {
  noteId: string;
  title: string;
  content: string;
  dimension: string;
  date: string;
  ftsRank: number | null;
  vectorRank: number | null;
  rrfScore: number;
}

// ---------------------------------------------------------------------------
// FTS5 Keyword Search
// ---------------------------------------------------------------------------

interface FtsRow {
  note_id: string;
  rank: number;
}

export function ftsSearch(query: string, limit: number = 20): FtsRow[] {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT note_id, rank
      FROM notes_fts
      WHERE notes_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as FtsRow[];
  } catch (error) {
    logger.warn('FTS search failed (table may not exist yet):', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// FTS Sync (called during indexing)
// ---------------------------------------------------------------------------

export function syncNoteFts(noteId: string, title: string, content: string, tags: string): void {
  const db = getDb();
  try {
    // Delete old entry, then insert fresh
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId);
    db.prepare('INSERT INTO notes_fts(note_id, title, content, tags) VALUES (?, ?, ?, ?)').run(
      noteId, title || '', content || '', tags || ''
    );
  } catch (error) {
    logger.warn('FTS sync failed (non-fatal):', error);
  }
}

export function deleteNoteFts(noteId: string): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId);
  } catch (error) {
    logger.warn('FTS delete failed (non-fatal):', error);
  }
}

// ---------------------------------------------------------------------------
// Hybrid Search (FTS + Vector → RRF merge)
// ---------------------------------------------------------------------------

export async function hybridSearch(query: string, topK: number = 10): Promise<HybridSearchResult[]> {
  const db = getDb();
  const ftsLimit = topK * 3;
  const vecLimit = topK * 3;

  // Channel 1: FTS5 keyword search
  const ftsResults = ftsSearch(query, ftsLimit);

  // Channel 2: Vector semantic search (if available)
  let vectorResults: { id: string; distance: number }[] = [];
  if (isVectorStoreReady()) {
    try {
      const queryEmbedding = await getEmbedding(query.slice(0, 1000));
      vectorResults = searchSimilar(db, queryEmbedding, vecLimit);
    } catch (err) {
      logger.warn('Vector search channel failed, using FTS only:', err);
    }
  }

  // Build rank maps
  const ftsRankMap = new Map<string, number>();
  ftsResults.forEach((r, i) => ftsRankMap.set(r.note_id, i + 1));

  // Vector IDs are prefixed (e.g., "bs:brainstorm:note-uuid").
  // We extract the note ID from brainstorm sessions for matching.
  const vecRankMap = new Map<string, number>();
  vectorResults.forEach((r, i) => {
    // Try to resolve note ID from brainstorm session prefix
    if (r.id.startsWith('bs:brainstorm:')) {
      const noteId = r.id.replace('bs:brainstorm:', '');
      vecRankMap.set(noteId, i + 1);
    }
  });

  // Merge all candidate note IDs
  const allNoteIds = new Set([...ftsRankMap.keys(), ...vecRankMap.keys()]);

  // Compute RRF scores
  const scored: { noteId: string; ftsRank: number | null; vectorRank: number | null; rrfScore: number }[] = [];
  for (const noteId of allNoteIds) {
    const fRank = ftsRankMap.get(noteId) ?? null;
    const vRank = vecRankMap.get(noteId) ?? null;
    let rrfScore = 0;
    if (fRank !== null) rrfScore += 1 / (RRF_K + fRank);
    if (vRank !== null) rrfScore += 1 / (RRF_K + vRank);
    scored.push({ noteId, ftsRank: fRank, vectorRank: vRank, rrfScore });
  }

  // Sort by RRF score descending, take topK
  scored.sort((a, b) => b.rrfScore - a.rrfScore);
  const topResults = scored.slice(0, topK);

  // Hydrate with note data
  const noteStmt = db.prepare('SELECT id, title, content, dimension, date FROM notes WHERE id = ?');
  const results: HybridSearchResult[] = [];
  for (const item of topResults) {
    const note = noteStmt.get(item.noteId) as any;
    if (note) {
      results.push({
        noteId: note.id,
        title: note.title || note.id,
        content: (note.content || '').slice(0, 200),
        dimension: note.dimension,
        date: note.date,
        ftsRank: item.ftsRank,
        vectorRank: item.vectorRank,
        rrfScore: item.rrfScore,
      });
    }
  }

  logger.info(`Hybrid search for "${query.slice(0, 30)}": ${ftsResults.length} FTS + ${vectorResults.length} vector → ${results.length} merged`);
  return results;
}
