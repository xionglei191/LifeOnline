/**
 * Chaos Test: SQLite Database Corruption Detection
 *
 * Verifies that the system correctly detects and reports database corruption
 * instead of silently failing. Simulates file-level corruption by truncating
 * the database file.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

describe('Chaos: DB Corruption Detection', () => {
  const tmpDir = '/tmp/lifeos-chaos-db';
  const dbPath = path.join(tmpDir, 'test-corrupt.db');

  it('detects truncated database file', () => {
    // Setup: create a valid database with some data
    fs.mkdirSync(tmpDir, { recursive: true });
    const db = new Database(dbPath);
    db.exec('CREATE TABLE test_data (id INTEGER PRIMARY KEY, value TEXT)');
    for (let i = 0; i < 100; i++) {
      db.prepare('INSERT INTO test_data (value) VALUES (?)').run(`row-${i}`);
    }
    db.close();

    // Act: corrupt the file by truncating the last 1KB
    const stats = fs.statSync(dbPath);
    const fd = fs.openSync(dbPath, 'r+');
    fs.ftruncateSync(fd, Math.max(0, stats.size - 1024));
    fs.closeSync(fd);

    // Assert: opening damaged DB and querying should throw
    let threw = false;
    try {
      const corruptDb = new Database(dbPath);
      // This should fail or the integrity check should detect corruption
      const result = corruptDb.pragma('integrity_check') as any[];
      if (result[0]?.integrity_check !== 'ok') {
        threw = true;
      }
      corruptDb.close();
    } catch {
      threw = true;
    }

    assert.ok(threw, 'Corrupted database should be detected via integrity_check or throw on open');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('healthy database passes integrity check', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const db = new Database(dbPath);
    db.exec('CREATE TABLE healthy (id INTEGER PRIMARY KEY, data TEXT)');
    db.prepare('INSERT INTO healthy (data) VALUES (?)').run('test');

    const result = db.pragma('integrity_check') as any[];
    assert.equal(result[0]?.integrity_check, 'ok', 'Healthy DB should pass integrity check');

    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
