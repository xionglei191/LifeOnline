import { uploadToR2, listR2Objects, getR2Object, deleteR2Object } from '../LifeOS/packages/server/src/infra/r2Client.js';
import * as crypto from 'crypto';

async function verifyR2Lifecycle() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testKey = `test/lifecycle-verify-${timestamp}.json`;
  const randHash = crypto.randomUUID();
  const testContent = JSON.stringify({
    message: 'Hello from LifeOS R2 Verification Script',
    hash: randHash,
    timestamp
  });

  console.log('--- LifeOS R2 Cold Storage Integration Test ---');
  console.log(`[1] Uploading test object: ${testKey}`);
  
  try {
    await uploadToR2(testKey, testContent);
    console.log('✅ Upload successful\n');

    console.log(`[2] Listing objects with prefix 'test/'...`);
    const objects = await listR2Objects('test/');
    console.log(`   Found ${objects.length} objects.`);
    if (!objects.includes(testKey)) {
      throw new Error('Test key not found in list response.');
    }
    console.log('✅ List successful\n');

    console.log(`[3] Reading test object: ${testKey}`);
    const content = await getR2Object(testKey);
    const parsed = JSON.parse(content);
    console.log(`   Received hash: ${parsed.hash}`);
    if (parsed.hash !== randHash) {
      throw new Error('Content hash mismatch!');
    }
    console.log('✅ Read successful\n');

    console.log(`[4] Analyzing stray test objects...`);
    const oldKeys = objects.filter(k => k.startsWith('test/') && k !== testKey);
    for (const oldKey of oldKeys) {
      console.log(`   Cleaning up stray test object: ${oldKey}`);
      await deleteR2Object(oldKey);
    }
    
    console.log(`[5] Deleting test object: ${testKey}`);
    await deleteR2Object(testKey);
    
    const finalObjects = await listR2Objects('test/');
    if (finalObjects.includes(testKey)) {
      throw new Error('Test key still exists after deletion!');
    }
    console.log('✅ Delete successful\n');

    console.log('🎉 R2 Cold Storage Lifecycle Verification Passed!');

  } catch (err: any) {
    console.error('❌ R2 Verification Failed:', err.message);
    process.exit(1);
  }
}

// Load process env directly from service file for local validation mapping
verifyR2Lifecycle();
