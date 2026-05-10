import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as path from 'path';

export interface UploadResult {
  otp: string;
  expiresIn: number;
}

/**
 * Uploads a ZIP buffer to the FolderDrop backend via multipart/form-data POST.
 *
 * Uses Node's built-in https/http modules to avoid bundling issues in the
 * VS Code extension host environment. No external HTTP library required.
 *
 * @param serverUrl  Base URL of the FolderDrop backend
 * @param zipBuffer  ZIP file contents as a Buffer
 * @param folderName Original folder name (used as the filename in the upload)
 * @returns Promise resolving to { otp, expiresIn }
 */
export async function uploadZip(
  serverUrl: string,
  zipBuffer: Buffer,
  folderName: string
): Promise<UploadResult> {
  const uploadUrl = new URL('/api/upload', serverUrl);
  const filename = path.basename(folderName) + '.fdenc';

  // Build multipart/form-data body manually
  const boundary = '----FolderDropBoundary' + Date.now().toString(16);
  const CRLF = '\r\n';

  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/octet-stream',
    '',
    '',
  ].join(CRLF);

  const footer = `${CRLF}--${boundary}--${CRLF}`;

  const headerBuf = Buffer.from(header, 'utf8');
  const footerBuf = Buffer.from(footer, 'utf8');
  const body = Buffer.concat([headerBuf, zipBuffer, footerBuf]);

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: uploadUrl.hostname,
      port: uploadUrl.port || (uploadUrl.protocol === 'https:' ? 443 : 80),
      path: uploadUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'User-Agent': 'FolderDrop-VSCode-Extension/1.0',
      },
    };

    const transport = uploadUrl.protocol === 'https:' ? https : http;

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');

        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(raw) as UploadResult;
            resolve(json);
          } catch {
            reject(new Error('Invalid response from server: ' + raw));
          }
          return;
        }

        if (res.statusCode === 413) {
          reject(new Error('FOLDER_TOO_LARGE'));
          return;
        }

        if (res.statusCode === 429) {
          reject(new Error('RATE_LIMITED'));
          return;
        }

        // Try to parse error message from response body
        try {
          const errBody = JSON.parse(raw) as { error?: string };
          reject(new Error(errBody.error ?? `Server error: ${res.statusCode}`));
        } catch {
          reject(new Error(`Server error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        reject(new Error('SERVER_UNREACHABLE'));
      } else {
        reject(err);
      }
    });

    req.setTimeout(30_000, () => {
      req.destroy();
      reject(new Error('SERVER_UNREACHABLE'));
    });

    req.write(body);
    req.end();
  });
}
