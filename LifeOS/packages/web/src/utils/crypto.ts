// Decrypt sensitive content using Web Crypto API
export async function decryptContent(encryptedData: string, keyHex: string): Promise<string> {
  try {
    const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = hexToBuffer(ivHex);
    const authTag = hexToBuffer(authTagHex);
    const encrypted = hexToBuffer(encryptedHex);

    // Combine encrypted data and auth tag for GCM
    const combined = new Uint8Array(encrypted.length + authTag.length);
    combined.set(encrypted);
    combined.set(authTag, encrypted.length);

    const key = await crypto.subtle.importKey(
      'raw',
      hexToBuffer(keyHex).buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer, tagLength: 128 },
      key,
      combined.buffer as ArrayBuffer
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('解密失败');
  }
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Get encryption key from environment or generate
export function getEncryptionKey(): string {
  // In production, this should be securely stored
  const stored = localStorage.getItem('lifeos_encryption_key');
  if (stored) return stored;

  // For now, use a fixed key matching backend
  // In production, derive from PIN using PBKDF2
  const key = '0'.repeat(64); // 32 bytes hex
  localStorage.setItem('lifeos_encryption_key', key);
  return key;
}
