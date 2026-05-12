import { decryptBlob } from './crypto';

export interface DownloadProgress {
  phase: 'fetching' | 'decrypting';
  percent: number;
}

export async function downloadAndDecrypt(
  otp: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  // Step 1: redeem OTP — get signed Supabase URL + decryption key (~100ms, no file bytes)
  const redeemRes = await fetch(`/api/download/${encodeURIComponent(otp)}/encrypted`);
  if (!redeemRes.ok) {
    throw new Error(await readError(redeemRes));
  }

  const { url: signedUrl, key } = await redeemRes.json() as { url: string; key: string | null };

  if (!key) {
    throw new Error('Missing decryption key. Use the secure FolderDrop link or ask the sender for the key.');
  }

  // Step 2: fetch encrypted file directly from Supabase CDN with progress tracking
  onProgress?.({ phase: 'fetching', percent: 0 });

  const fileRes = await fetch(signedUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to fetch file from storage (HTTP ${fileRes.status}).`);
  }

  // Stream with progress if Content-Length is available
  let encrypted: Blob;
  const contentLength = fileRes.headers.get('Content-Length');
  if (contentLength && fileRes.body) {
    const total = parseInt(contentLength, 10);
    const reader = fileRes.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress?.({ phase: 'fetching', percent: Math.round((received / total) * 100) });
    }

    const all = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
    encrypted = new Blob([all], { type: 'application/octet-stream' });
  } else {
    encrypted = await fileRes.blob();
    onProgress?.({ phase: 'fetching', percent: 100 });
  }

  // Step 3: decrypt in browser
  onProgress?.({ phase: 'decrypting', percent: 0 });
  const decrypted = await decryptBlob(encrypted, key);
  onProgress?.({ phase: 'decrypting', percent: 100 });

  // Step 4: trigger download
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
