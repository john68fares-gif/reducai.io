// lib/crypto.ts
import { Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
const subtle = webcrypto.subtle;

// Convert base64 to ArrayBuffer
export function base64ToBuf(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, 'base64');
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}

// AES-GCM decrypt of concatenated IV(12B) + ciphertext (input is base64)
export async function decryptAesGcmConcat(rawKey: ArrayBuffer, b64Joined: string): Promise<string> {
  const joined = new Uint8Array(base64ToBuf(b64Joined));
  const iv = joined.slice(0, 12);
  const cipher = joined.slice(12);

  const key = await subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const dec = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(dec);
}
