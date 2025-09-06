// lib/crypto.ts
// AES-GCM decrypt of concatenated IV(12 bytes) + ciphertext (base64 input)

export function base64ToBuf(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, 'base64');
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}

export async function decryptAesGcmConcat(rawKey: ArrayBuffer, b64Joined: string): Promise<string> {
  const joined = new Uint8Array(base64ToBuf(b64Joined));
  const iv = joined.slice(0, 12);
  const cipher = joined.slice(12);

  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(dec);
}
