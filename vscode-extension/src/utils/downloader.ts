import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export async function downloadOtpFile(
  serverUrl: string,
  otp: string,
  destinationPath: string
): Promise<void> {
  const downloadUrl = new URL(`/api/download/${encodeURIComponent(otp)}`, serverUrl).toString();
  await downloadToFile(downloadUrl, destinationPath, 0);
}

function downloadToFile(url: string, destinationPath: string, redirects: number): Promise<void> {
  if (redirects > 5) {
    return Promise.reject(new Error('Too many redirects while downloading the file.'));
  }

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const request = transport.get(
      parsedUrl,
      {
        headers: {
          'User-Agent': 'FolderDrop-VSCode-Extension/1.0',
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          const redirectUrl = new URL(location, parsedUrl).toString();
          downloadToFile(redirectUrl, destinationPath, redirects + 1).then(resolve, reject);
          return;
        }

        if (statusCode !== 200) {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            reject(new Error(readServerError(Buffer.concat(chunks).toString('utf8'), statusCode)));
          });
          response.on('error', reject);
          return;
        }

        const file = fs.createWriteStream(destinationPath);
        response.pipe(file);

        file.on('finish', () => {
          file.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });

        file.on('error', (err) => {
          fs.rm(destinationPath, { force: true }, () => reject(err));
        });
        response.on('error', reject);
      }
    );

    request.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        reject(new Error('FolderDrop server is unreachable.'));
      } else {
        reject(err);
      }
    });

    request.setTimeout(60_000, () => {
      request.destroy(new Error('Download timed out.'));
    });
  });
}

function readServerError(raw: string, statusCode: number): string {
  try {
    const body = JSON.parse(raw) as { error?: string };
    if (body.error) {
      return body.error;
    }
  } catch {
    // Fall back to a generic message below.
  }

  if (statusCode === 404) {
    return 'Invalid or expired code.';
  }
  if (statusCode === 429) {
    return 'Too many download attempts. Please wait before trying again.';
  }
  return `Download failed with HTTP ${statusCode}.`;
}
