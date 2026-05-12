import { decryptBlob } from './crypto';

export interface DownloadProgress {
  phase: 'fetching' | 'decrypting';
  percent: number;
}

export async function downloadAndDecrypt(
  otp: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  onProgress?.({ phase: 'fetching', percent: 0 });

  // Fetch encrypted file — backend streams from Supabase, returns key in header
  const response = await fetch(`/api/download/${encodeURIComponent(otp)}/encrypted`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const key = response.headers.get('X-FolderDrop-Key');
  if (!key) {
    throw new Error('Missing decryption key. Ask the sender to reshare the file.');
  }

  // Stream response body with progress
  let encrypted: Blob;
  const contentLength = response.headers.get('Content-Length');
  if (contentLength && response.body) {
    const total = parseInt(contentLength, 10);
    const reader = response.body.getReader();
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
    encrypted = await response.blob();
    onProgress?.({ phase: 'fetching', percent: 100 });
  }

  // Decrypt in browser
  onProgress?.({ phase: 'decrypting', percent: 0 });
  const decrypted = await decryptBlob(encrypted, key);
  onProgress?.({ phase: 'decrypting', percent: 100 });

  // Trigger download
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
