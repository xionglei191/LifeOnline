/**
 * vectorStore.test.ts — sqlite-vec kNN search validation
 *
 * Stores 5 known vectors, performs kNN search, and verifies result order.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv } from './helpers/testEnv.js';
import { initDatabase, getDb } from '../src/db/client.js';
import {
  initVectorStore,
  upsertEmbedding,
  searchSimilar,
  getEmbeddingCount,
  deleteEmbedding,
  resetVectorStoreState,
} from '../src/db/vectorStore.js';

// Small dimension for testing
const DIM = 4;

function vec(values: number[]): number[] {
  assert.equal(values.length, DIM);
  return values;
}

test('vectorStore: insert and kNN search returns correct ordering', async () => {
  const env = await createTestEnv('lifeos-vec-knn-');
  try {
    initDatabase();
    const db = getDb();
    resetVectorStoreState();
    initVectorStore(db, DIM, true);

    // Insert 5 vectors
    upsertEmbedding(db, 'a', vec([1, 0, 0, 0]));
    upsertEmbedding(db, 'b', vec([0, 1, 0, 0]));
    upsertEmbedding(db, 'c', vec([0, 0, 1, 0]));
    upsertEmbedding(db, 'd', vec([0, 0, 0, 1]));
    upsertEmbedding(db, 'e', vec([1, 1, 0, 0])); // closest to query [1, 0, 0, 0]

    assert.equal(getEmbeddingCount(db), 5);

    // Query: find vectors closest to [1, 0, 0, 0]
    const results = searchSimilar(db, vec([1, 0, 0, 0]), 3);

    assert.equal(results.length, 3);
    // 'a' should be the closest (exact match, distance 0)
    assert.equal(results[0].id, 'a');
    assert.equal(results[0].distance, 0);
    // 'e' should be second closest (L2 distance = 1)
    assert.equal(results[1].id, 'e');

    console.log('✅ kNN search results:', results);
  } finally {
    await env.cleanup();
  }
});

test('vectorStore: upsert replaces existing embedding', async () => {
  const env = await createTestEnv('lifeos-vec-upsert-');
  try {
    initDatabase();
    const db = getDb();
    resetVectorStoreState();
    initVectorStore(db, DIM, true);

    upsertEmbedding(db, 'x', vec([1, 0, 0, 0]));
    assert.equal(getEmbeddingCount(db), 1);

    // Replace with a different vector
    upsertEmbedding(db, 'x', vec([0, 0, 0, 1]));
    assert.equal(getEmbeddingCount(db), 1);

    // Search should now find the updated vector
    const results = searchSimilar(db, vec([0, 0, 0, 1]), 1);
    assert.equal(results[0].id, 'x');
    assert.equal(results[0].distance, 0);

    console.log('✅ Upsert replacement works');
  } finally {
    await env.cleanup();
  }
});

test('vectorStore: delete removes embedding', async () => {
  const env = await createTestEnv('lifeos-vec-delete-');
  try {
    initDatabase();
    const db = getDb();
    resetVectorStoreState();
    initVectorStore(db, DIM, true);

    upsertEmbedding(db, 'del-1', vec([1, 0, 0, 0]));
    upsertEmbedding(db, 'del-2', vec([0, 1, 0, 0]));
    assert.equal(getEmbeddingCount(db), 2);

    deleteEmbedding(db, 'del-1');
    assert.equal(getEmbeddingCount(db), 1);

    const results = searchSimilar(db, vec([1, 0, 0, 0]), 5);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'del-2');

    console.log('✅ Delete works correctly');
  } finally {
    await env.cleanup();
  }
});
