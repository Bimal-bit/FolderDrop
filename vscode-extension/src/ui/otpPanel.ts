import * as vscode from 'vscode';
import { buildSecureRedeemUrl } from '../utils/crypto';

/**
 * Displays the OTP to the user and copies it to the clipboard.
 */
export async function showOtpMessage(otp: string, expiresIn: number, decryptionKey: string): Promise<void> {
  const minutes = Math.round(expiresIn / 60);
  const config = vscode.workspace.getConfiguration('folderdrop');
  const serverUrl = config.get<string>('serverUrl', 'https://your-folderdrop-app.onrender.com');
  const redeemUrl = buildSecureRedeemUrl(serverUrl, otp, decryptionKey);

  try {
    await vscode.env.clipboard.writeText(redeemUrl);
  } catch {
    // Clipboard access can fail in restricted environments.
  }

  const message = `Your encrypted FolderDrop link is ready. Code: ${otp} (expires in ${minutes} min, secure link copied)`;
  const copyAction = 'Copy Secure Link';
  const copyKeyAction = 'Copy Key';
  const qrAction = 'Show QR';
  const openWebAction = 'Open Redeem Page';

  const selection = await vscode.window.showInformationMessage(
    message,
    copyAction,
    copyKeyAction,
    qrAction,
    openWebAction
  );

  if (selection === copyAction) {
    await vscode.env.clipboard.writeText(redeemUrl);
    vscode.window.showInformationMessage('Secure FolderDrop link copied to clipboard.');
  } else if (selection === copyKeyAction) {
    await vscode.env.clipboard.writeText(decryptionKey);
    vscode.window.showInformationMessage('FolderDrop decryption key copied to clipboard.');
  } else if (selection === qrAction) {
    await vscode.commands.executeCommand('folderdrop.showQrCode', otp, decryptionKey);
  } else if (selection === openWebAction) {
    await vscode.env.openExternal(vscode.Uri.parse(redeemUrl));
  }
}

export async function showErrorMessage(
  message: string,
  onRetry?: () => Promise<void>
): Promise<void> {
  const actions: string[] = onRetry ? ['Retry'] : [];
  const selection = await vscode.window.showErrorMessage(message, ...actions);

  if (selection === 'Retry' && onRetry) {
    await onRetry();
  }
}
