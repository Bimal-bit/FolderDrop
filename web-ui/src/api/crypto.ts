const MAGIC = new TextEncoder().encode('FDE1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface EncryptionResult {
  encrypted: Blob;
  key: string;
}

export async function encryptBlob(input: Blob): Promise<EncryptionResult> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const plaintext = await input.arrayBuffer();
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const ciphertext = encrypted.slice(0, encrypted.length - TAG_BYTES);
  const tag = encrypted.slice(encrypted.length - TAG_BYTES);

  return {
    encrypted: new Blob([concat(MAGIC, iv, tag, ciphertext)], { type: 'application/octet-stream' }),
    key: base64UrlEncode(keyBytes),
  };
}

export async function decryptBlob(input: Blob, encodedKey: string): Promise<Blob> {
  const bytes = new Uint8Array(await input.arrayBuffer());
  if (bytes.length < MAGIC.length + IV_BYTES + TAG_BYTES || !startsWith(bytes, MAGIC)) {
    throw new Error('This file is not a FolderDrop encrypted archive.');
  }

  const keyBytes = base64UrlDecode(encodedKey);
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error('Invalid decryption key.');
  }

  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_BYTES;
  const ciphertextStart = tagStart + TAG_BYTES;
  const iv = bytes.slice(ivStart, tagStart);
  const tag = bytes.slice(tagStart, ciphertextStart);
  const ciphertext = bytes.slice(ciphertextStart);
  const encrypted = concat(ciphertext, tag);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

  return new Blob([plaintext], { type: 'application/zip' });
}

export function buildSecureRedeemUrl(origin: string, otp: string, key: string): string {
  return `${origin.replace(/\/$/, '')}/redeem?code=${encodeURIComponent(otp)}#key=${encodeURIComponent(key)}`;
}

export function getKeyFromHash(): string {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('key') ?? '';
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function startsWith(value: Uint8Array, prefix: Uint8Array): boolean {
  return prefix.every((byte, index) => value[index] === byte);
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}
