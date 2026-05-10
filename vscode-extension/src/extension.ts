import * as vscode from 'vscode';
import { downloadFromCode } from './commands/downloadFromCode';
import { shareFolder } from './commands/shareFolder';
import { showQrPanel } from './ui/qrPanel';

/**
 * Extension activation point.
 * Called by VS Code when the extension is first activated
 * on the folderdrop.shareFolder command.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[FolderDrop] Extension activated');

  const shareCommand = vscode.commands.registerCommand(
    'folderdrop.shareFolder',
    async (uri: vscode.Uri | undefined) => {
      if (!uri) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage(
            'FolderDrop: No workspace folder is open. Open a folder first.'
          );
          return;
        }

        if (workspaceFolders.length === 1) {
          uri = workspaceFolders[0].uri;
        } else {
          const picked = await vscode.window.showWorkspaceFolderPick({
            placeHolder: 'Select a workspace folder to share',
          });
          if (!picked) {
            return;
          }
          uri = picked.uri;
        }
      }

      await shareFolder(uri);
    }
  );

  const downloadCommand = vscode.commands.registerCommand(
    'folderdrop.downloadFromCode',
    async (input?: string) => {
      await downloadFromCode(input);
    }
  );

  const qrCommand = vscode.commands.registerCommand(
    'folderdrop.showQrCode',
    async (otp?: string, decryptionKey?: string) => {
      await showQrPanel(context, otp, decryptionKey);
    }
  );

  context.subscriptions.push(shareCommand, downloadCommand, qrCommand);
}

export function deactivate(): void {
  console.log('[FolderDrop] Extension deactivated');
}
