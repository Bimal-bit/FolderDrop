export interface UploadResult {
  otp: string;
  expiresIn: number;
  maxDownloads: number;
}

export interface UploadProgress {
  phase: 'zipping' | 'uploading';
  percent: number;
}

export interface UploadOptions {
  maxDownloads?: number;
}

/**
 * Pings the backend health endpoint to wake a cold Render instance.
 * Waits up to 60 s for a 200 response before giving up silently.
 */
export async function pingBackend(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    await fetch('/actuator/health', { signal: controller.signal });
  } catch {
    // ignore — best-effort wake-up
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadZip(
  encryptedBlob: Blob,
  fileName: string,
  onProgress: (p: UploadProgress) => void,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', encryptedBlob, fileName.replace(/\.zip$/i, '') + '.fdenc');
    if (options.maxDownloads && options.maxDownloads > 1) {
      formData.append('maxDownloads', String(options.maxDownloads));
    }

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress({ phase: 'uploading', percent: Math.round((e.loaded / e.total) * 100) });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new Error('Invalid response from server.'));
        }
      } else if (xhr.status === 413) {
        reject(new Error('FOLDER_TOO_LARGE'));
      } else if (xhr.status === 429) {
        reject(new Error('RATE_LIMITED'));
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(body.error ?? `Server error: ${xhr.status}`));
        } catch {
          reject(new Error(`Server error: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('SERVER_UNREACHABLE')));
    xhr.addEventListener('timeout', () => reject(new Error('SERVER_UNREACHABLE')));

    xhr.timeout = 300_000;
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}
