import * as vscode from 'vscode';
import * as path from 'path';
import { zipFolder, getFolderSizeBytes } from '../utils/zipper';
import { uploadZip } from '../utils/uploader';
import { encryptBuffer } from '../utils/crypto';
import { showOtpMessage, showErrorMessage } from '../ui/otpPanel';

/**
 * Core share logic for the folderdrop.shareFolder command.
 */
export async function shareFolder(folderUri: vscode.Uri): Promise<void> {
  const config = vscode.workspace.getConfiguration('folderdrop');
  const serverUrl = config.get<string>('serverUrl', 'https://your-folderdrop-app.onrender.com');
  const maxSizeMB = config.get<number>('maxFolderSizeMB', 50);

  const folderPath = folderUri.fsPath;
  const folderName = path.basename(folderPath);

  const maxBytes = maxSizeMB * 1024 * 1024;
  let folderSizeBytes: number;

  try {
    folderSizeBytes = getFolderSizeBytes(folderPath);
  } catch {
    await showErrorMessage(`FolderDrop: Could not read folder "${folderName}". Check permissions.`);
    return;
  }

  if (folderSizeBytes > maxBytes) {
    await showErrorMessage(
      `Folder too large. Max size is ${maxSizeMB} MB. "${folderName}" is ${(folderSizeBytes / 1024 / 1024).toFixed(1)} MB.`
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'FolderDrop',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: `Zipping "${folderName}"...`, increment: 0 });

      let zipBuffer: Buffer;
      try {
        zipBuffer = await zipFolder(folderPath);
      } catch (err) {
        await showErrorMessage(
          `FolderDrop: Failed to zip "${folderName}". ${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }

      progress.report({ message: 'Encrypting...', increment: 35 });

      const { encrypted, key } = encryptBuffer(zipBuffer);

      progress.report({ message: 'Uploading encrypted archive...', increment: 15 });

      const doUpload = async (): Promise<void> => {
        try {
          const result = await uploadZip(serverUrl, encrypted, folderName);
          progress.report({ message: 'Done!', increment: 50 });

          await new Promise((resolve) => setTimeout(resolve, 400));
          await showOtpMessage(result.otp, result.expiresIn, key);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          if (message === 'FOLDER_TOO_LARGE') {
            await showErrorMessage(`Folder too large. Max size is ${maxSizeMB} MB.`);
          } else if (message === 'SERVER_UNREACHABLE') {
            await showErrorMessage(
              `FolderDrop server is unreachable. Check your serverUrl setting (currently: ${serverUrl}).`,
              doUpload
            );
          } else if (message === 'RATE_LIMITED') {
            await showErrorMessage('Too many uploads. Please wait a minute before trying again.');
          } else {
            await showErrorMessage(`FolderDrop upload failed: ${message}`, doUpload);
          }
        }
      };

      await doUpload();
    }
  );
}
