import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const MAGIC = Buffer.from('FDE1', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface EncryptionResult {
  encrypted: Buffer;
  key: string;
}

export function encryptBuffer(input: Buffer): EncryptionResult {
  const keyBytes = randomBytes(KEY_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyBytes, iv);
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: Buffer.concat([MAGIC, iv, tag, ciphertext]),
    key: base64UrlEncode(keyBytes),
  };
}

export function decryptBuffer(input: Buffer, key: string): Buffer {
  if (input.length < MAGIC.length + IV_BYTES + TAG_BYTES || !input.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('This file is not a FolderDrop encrypted archive.');
  }

  const keyBytes = base64UrlDecode(key);
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error('Invalid decryption key.');
  }

  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_BYTES;
  const ciphertextStart = tagStart + TAG_BYTES;
  const iv = input.subarray(ivStart, tagStart);
  const tag = input.subarray(tagStart, ciphertextStart);
  const ciphertext = input.subarray(ciphertextStart);

  const decipher = createDecipheriv('aes-256-gcm', keyBytes, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function buildSecureRedeemUrl(serverUrl: string, otp: string, key: string): string {
  return `${serverUrl.replace(/\/$/, '')}/redeem?code=${encodeURIComponent(otp)}#key=${encodeURIComponent(key)}`;
}

export function parseFolderDropInput(input: string): { otp?: string; key?: string } {
  const trimmed = input.trim();
  const otp = trimmed.match(/\b\d{6}\b/)?.[0];
  let key: string | undefined;

  try {
    const url = new URL(trimmed);
    key = new URLSearchParams(url.hash.replace(/^#/, '')).get('key') ?? undefined;
  } catch {
    const keyMatch = trimmed.match(/key=([A-Za-z0-9_-]+)/);
    key = keyMatch?.[1];
  }

  return { otp, key };
}

function base64UrlEncode(value: Buffer): string {
  return value.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64');
}
