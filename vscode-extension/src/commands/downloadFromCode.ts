import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { downloadOtpFile } from '../utils/downloader';
import { decryptBuffer, parseFolderDropInput } from '../utils/crypto';

const OTP_PATTERN = /^\d{6}$/;

export async function downloadFromCode(initialOtp?: string): Promise<void> {
  const parsedInitial = initialOtp ? parseFolderDropInput(initialOtp) : {};
  const otp = await getOtp(parsedInitial.otp);
  if (!otp) {
    return;
  }
  const key = await getKey(parsedInitial.key);
  if (!key) {
    return;
  }

  const config = vscode.workspace.getConfiguration('folderdrop');
  const serverUrl = config.get<string>('serverUrl', 'https://your-folderdrop-app.onrender.com');

  const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: defaultFolder
      ? vscode.Uri.joinPath(defaultFolder, `folderdrop-${otp}.zip`)
      : vscode.Uri.file(path.join(process.cwd(), `folderdrop-${otp}.zip`)),
    filters: {
      'ZIP archives': ['zip'],
      'All files': ['*'],
    },
    saveLabel: 'Download',
    title: 'Save FolderDrop download',
  });

  if (!saveUri) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'FolderDrop',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: `Downloading code ${otp}...` });

      try {
        const encryptedPath = `${saveUri.fsPath}.fdenc`;
        await downloadOtpFile(serverUrl, otp, encryptedPath);
        progress.report({ message: 'Decrypting...' });
        const encrypted = await fs.readFile(encryptedPath);
        const decrypted = decryptBuffer(encrypted, key);
        await fs.writeFile(saveUri.fsPath, decrypted);
        await fs.rm(encryptedPath, { force: true });

        const reveal = 'Reveal File';
        const open = 'Open';
        const selection = await vscode.window.showInformationMessage(
          `Downloaded FolderDrop file to ${saveUri.fsPath}`,
          reveal,
          open
        );

        if (selection === reveal) {
          await vscode.commands.executeCommand('revealFileInOS', saveUri);
        } else if (selection === open) {
          await vscode.commands.executeCommand('vscode.open', saveUri);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await vscode.window.showErrorMessage(`FolderDrop download failed: ${message}`);
      }
    }
  );
}

async function getOtp(initialOtp?: string): Promise<string | undefined> {
  const clipboard = await readClipboard();
  const parsedClipboard = clipboard ? parseFolderDropInput(clipboard) : {};
  const value = initialOtp && OTP_PATTERN.test(initialOtp)
    ? initialOtp
    : parsedClipboard.otp;

  const otp = await vscode.window.showInputBox({
    title: 'Download from FolderDrop Code',
    prompt: 'Enter the 6-digit FolderDrop code.',
    value,
    validateInput: (input) => {
      const normalized = input.replace(/\D/g, '');
      return OTP_PATTERN.test(normalized) ? undefined : 'Enter exactly 6 digits.';
    },
  });

  return otp?.replace(/\D/g, '');
}

async function getKey(initialKey?: string): Promise<string | undefined> {
  const clipboard = await readClipboard();
  const parsedClipboard = clipboard ? parseFolderDropInput(clipboard) : {};
  const value = initialKey ?? parsedClipboard.key;

  const key = await vscode.window.showInputBox({
    title: 'FolderDrop Decryption Key',
    prompt: 'Paste the decryption key. Secure FolderDrop links fill this automatically from the clipboard.',
    value,
    password: true,
    validateInput: (input) => input.trim() ? undefined : 'Enter the decryption key.',
  });

  return key?.trim();
}

async function readClipboard(): Promise<string | undefined> {
  try {
    return await vscode.env.clipboard.readText();
  } catch {
    return undefined;
  }
}
