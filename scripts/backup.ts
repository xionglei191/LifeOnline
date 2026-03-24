#!/usr/bin/env tsx
/**
 * LifeOS Database Backup Script
 *
 * Usage:  tsx scripts/backup.ts
 *
 * 1. Creates a timestamped SQLite backup via better-sqlite3 .backup()
 * 2. Uploads the backup to R2 under the `backups/` prefix
 * 3. Cleans up the local temporary file
 */
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// ── Config ────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || path.resolve(import.meta.dirname, '../LifeOS/packages/server/data/lifeos.db');
const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp';
const today = new Date().toISOString().slice(0, 10);
const backupFileName = `lifeos_${today}.db`;
const backupPath = path.join(BACKUP_DIR, backupFileName);

// ── Step 1: SQLite Backup ─────────────────────────────────

console.log(`📦 Starting backup...`);
console.log(`   Source DB:   ${DB_PATH}`);
console.log(`   Backup path: ${backupPath}`);

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database file not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
db.backup(backupPath)
  .then(async () => {
    const stats = fs.statSync(backupPath);
    console.log(`✅ SQLite backup complete (${(stats.size / 1024).toFixed(1)} KB)`);

    // ── Step 2: Upload to R2 ──────────────────────────────────
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const r2BucketName = process.env.R2_BUCKET_NAME;

    if (r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2BucketName) {
      console.log(`☁️  Uploading to R2 bucket [${r2BucketName}]...`);
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
      });

      const body = fs.readFileSync(backupPath);
      await s3.send(new PutObjectCommand({
        Bucket: r2BucketName,
        Key: `backups/${backupFileName}`,
        Body: body,
        ContentType: 'application/x-sqlite3',
      }));
      console.log(`✅ Uploaded to R2  backups/${backupFileName}`);
    } else {
      console.log('⚠️  R2 not configured — skipping cloud upload');
    }

    // ── Step 3: Cleanup local backup (optional) ───────────────
    // Keep the last local backup for quick restore; cleanup is manual.
    console.log(`📍 Local backup retained at: ${backupPath}`);
    console.log(`🎉 Backup complete!`);
  })
  .catch((err) => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
