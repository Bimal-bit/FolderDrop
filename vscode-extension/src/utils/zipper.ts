import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

/**
 * Zips a folder at the given path into an in-memory Buffer.
 *
 * Uses archiver with zip compression. The folder contents are added
 * at the root of the ZIP (not nested under the folder name).
 *
 * @param folderPath Absolute path to the folder to zip
 * @returns Promise resolving to a Buffer containing the ZIP data
 */
export async function zipFolder(folderPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);

    const archive = archiver.default('zip', {
      zlib: { level: 6 }, // balanced compression (0=none, 9=max)
    });

    archive.on('error', reject);
    archive.on('warning', (err: archiver.ArchiverError) => {
      if (err.code === 'ENOENT') {
        // Warn about missing files but continue
        console.warn('[FolderDrop] Zipper warning:', err.message);
      } else {
        reject(err);
      }
    });

    archive.pipe(passThrough);

    // Add folder contents — the second arg is the path prefix inside the ZIP
    // Using the folder name as the root directory inside the ZIP
    const folderName = path.basename(folderPath);
    archive.directory(folderPath, folderName);

    archive.finalize();
  });
}

/**
 * Calculates the total size of a folder recursively (in bytes).
 * Used to enforce the size limit before zipping.
 *
 * @param folderPath Absolute path to the folder
 * @returns Total size in bytes
 */
export function getFolderSizeBytes(folderPath: string): number {
  let total = 0;

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          total += stat.size;
        } catch {
          // Skip files we can't stat (e.g., broken symlinks)
        }
      }
    }
  }

  walk(folderPath);
  return total;
}
