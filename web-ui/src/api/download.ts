import { decryptBlob } from './crypto';

export async function downloadAndDecrypt(otp: string, key: string): Promise<void> {
  // Step 1: redeem the OTP — backend validates, decrements, returns a signed Supabase URL
  const redeemRes = await fetch(`/api/download/${encodeURIComponent(otp)}/encrypted`);
  if (!redeemRes.ok) {
    throw new Error(await readError(redeemRes));
  }

  const { url: signedUrl } = await redeemRes.json() as { url: string };

  // Step 2: fetch the encrypted file directly from Supabase using the signed URL
  // This avoids routing large files through the backend
  const fileRes = await fetch(signedUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to fetch file from storage (HTTP ${fileRes.status}).`);
  }

  // Step 3: decrypt in the browser and trigger download
  const encrypted = await fileRes.blob();
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
