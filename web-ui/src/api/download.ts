import { decryptBlob } from './crypto';

export async function downloadAndDecrypt(otp: string, key: string): Promise<void> {
  const response = await fetch(`/api/download/${encodeURIComponent(otp)}/encrypted`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const encrypted = await response.blob();
  const decrypted = await decryptBlob(encrypted, key);
  const url = URL.createObjectURL(decrypted);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `folderdrop-${otp}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
