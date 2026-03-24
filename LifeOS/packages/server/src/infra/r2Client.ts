/**
 * R2 Client — Cloudflare R2 (S3-compatible) cold storage bridge
 *
 * Environment variables:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API access key ID
 *   R2_SECRET_ACCESS_KEY — R2 API secret access key
 *   R2_BUCKET_NAME      — Target bucket name
 */
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Logger } from '../utils/logger.js';

const logger = new Logger('r2Client');

// ── Configuration Check ────────────────────────────────

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

// ── S3 Client ──────────────────────────────────────────

let s3Client: S3Client | null = null;

function getS3Client(config: R2Config): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
}

// ── Upload ─────────────────────────────────────────────

export async function uploadToR2(key: string, body: string | Buffer): Promise<void> {
  const config = getR2Config();
  if (!config) {
    throw new Error('R2 未配置。请设置环境变量: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  }

  const client = getS3Client(config);
  await client.send(new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: typeof body === 'string' ? Buffer.from(body, 'utf-8') : body,
    ContentType: key.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'application/octet-stream',
  }));

  logger.info(`Uploaded: ${key} → ${config.bucketName}`);
}
export async function listR2Objects(prefix?: string): Promise<string[]> {
  const config = getR2Config();
  if (!config) throw new Error('R2 未配置。');

  const client = getS3Client(config);
  const response = await client.send(new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: prefix,
  }));

  return (response.Contents?.map(obj => obj.Key).filter((k): k is string => !!k)) || [];
}

export async function getR2Object(key: string): Promise<string> {
  const config = getR2Config();
  if (!config) throw new Error('R2 未配置。');

  const client = getS3Client(config);
  const response = await client.send(new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  }));

  if (!response.Body) {
    throw new Error(`R2 object empty or not found: ${key}`);
  }

  return response.Body.transformToString('utf-8');
}

export async function deleteR2Object(key: string): Promise<void> {
  const config = getR2Config();
  if (!config) throw new Error('R2 未配置。');

  const client = getS3Client(config);
  await client.send(new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  }));

  logger.info(`Deleted: ${key} from ${config.bucketName}`);
}
