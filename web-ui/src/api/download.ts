import { decryptBlob } from './crypto';

export async function downloadAndDecrypt(otp: string): Promise<void> {
  const redeemRes = await fetch(`/api/download/${encodeURIComponent(otp)}/encrypted`);
  if (!redeemRes.ok) {
    throw new Error(await readError(redeemRes));
  }

  const key = redeemRes.headers.get('X-FolderDrop-Key');
  if (!key) {
    throw new Error('This code was created before code-only downloads were enabled. Ask the sender to share it again.');
  }

  const encrypted = await redeemRes.blob();
  const decrypted = await decryptBlob(encrypted, key);
  const blobUrl = URL.createObjectURL(decrypted);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = `folderdrop-${otp}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

export function isValidOtp(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? `Download failed with HTTP ${response.status}.`;
  } catch {
    return `Download failed with HTTP ${response.status}.`;
  }
}
