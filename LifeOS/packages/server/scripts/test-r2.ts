import { uploadToR2, isR2Configured, getR2Config } from '../src/infra/r2Client.js';

process.env.R2_ACCOUNT_ID = '209d35d1b5923fb2d4420744901d9dbe';
process.env.R2_ACCESS_KEY_ID = 'afd70ec6e45b4f0292452acbfd8824fd';
process.env.R2_SECRET_ACCESS_KEY = '8ad927099ad2dc0c0fa9aea41c9964b8b537bfcfdc0f0d33fd09a92f52d7be1e';
process.env.R2_BUCKET_NAME = 'vault2026';

async function main() {
  console.log('R2 Configured?', isR2Configured());
  console.log('Config:', getR2Config());

  try {
    const key = `test-upload-${Date.now()}.md`;
    const content = '# Hello R2\nThis is a test upload from LifeOnline dev machine.';
    await uploadToR2(key, content);
    console.log(`Success! Uploaded ${key}`);
  } catch (e) {
    console.error('Failed to upload:', e);
  }
}

main();
