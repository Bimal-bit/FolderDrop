import * as vscode from 'vscode';
import * as QRCode from 'qrcode';
import { buildSecureRedeemUrl } from '../utils/crypto';

export async function showQrPanel(context: vscode.ExtensionContext, otp?: string, decryptionKey?: string): Promise<void> {
  const code = await getOtp(otp);
  if (!code) {
    return;
  }
  const key = await getKey(decryptionKey);
  if (!key) {
    return;
  }

  const config = vscode.workspace.getConfiguration('folderdrop');
  const serverUrl = config.get<string>('serverUrl', 'https://your-folderdrop-app.onrender.com');
  const redeemUrl = buildSecureRedeemUrl(serverUrl, code, key);
  const qrDataUrl = await QRCode.toDataURL(redeemUrl, {
    margin: 2,
    width: 280,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });

  const panel = vscode.window.createWebviewPanel(
    'folderdropQrCode',
    `FolderDrop QR ${code}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: false,
      localResourceRoots: [context.extensionUri],
    }
  );

  panel.webview.html = renderQrHtml(code, redeemUrl, qrDataUrl);
}

function renderQrHtml(otp: string, redeemUrl: string, qrDataUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FolderDrop QR</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }
    main {
      width: min(420px, calc(100vw - 48px));
      text-align: center;
    }
    img {
      width: 280px;
      height: 280px;
      padding: 16px;
      background: #fff;
      border-radius: 8px;
      box-sizing: border-box;
    }
    .code {
      margin: 18px 0 8px;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 6px;
    }
    .link {
      overflow-wrap: anywhere;
      color: var(--vscode-textLink-foreground);
      font-size: 13px;
    }
    p {
      margin: 12px 0 0;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <main>
    <img src="${qrDataUrl}" alt="QR code for FolderDrop redeem link">
    <div class="code">${escapeHtml(otp)}</div>
    <div class="link">${escapeHtml(redeemUrl)}</div>
    <p>Scan to open the redeem page with the code and decryption key.</p>
  </main>
</body>
</html>`;
}

async function getOtp(initialOtp?: string): Promise<string | undefined> {
  if (initialOtp && /^\d{6}$/.test(initialOtp)) {
    return initialOtp;
  }

  const input = await vscode.window.showInputBox({
    title: 'Show FolderDrop QR Code',
    prompt: 'Enter the 6-digit FolderDrop code to render as a QR redeem link.',
    validateInput: (value) => /^\d{6}$/.test(value.replace(/\D/g, ''))
      ? undefined
      : 'Enter exactly 6 digits.',
  });

  return input?.replace(/\D/g, '');
}

async function getKey(initialKey?: string): Promise<string | undefined> {
  if (initialKey) {
    return initialKey;
  }

  const input = await vscode.window.showInputBox({
    title: 'FolderDrop Decryption Key',
    prompt: 'Enter the decryption key for this FolderDrop code.',
    password: true,
    validateInput: (value) => value.trim() ? undefined : 'Enter a decryption key.',
  });

  return input?.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
