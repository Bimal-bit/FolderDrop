# FolderDrop for VS Code

Share a workspace folder through a FolderDrop backend and receive an encrypted redeem link.

## Features

- Adds a `Share via FolderDrop` command to the Explorer folder context menu.
- Adds a `Download from FolderDrop Code` command to redeem a code inside VS Code.
- Zips the selected folder in the VS Code extension host.
- Encrypts the ZIP locally with AES-256-GCM before upload.
- Uploads only encrypted bytes to the configured FolderDrop backend.
- Copies the secure redeem link to the clipboard and can show a QR redeem link.

## Configuration

Set these values in VS Code settings:

- `folderdrop.serverUrl`: Base URL of the deployed FolderDrop backend.
- `folderdrop.maxFolderSizeMB`: Maximum folder size allowed before upload.

For production builds, replace the default `folderdrop.serverUrl` in `package.json` with your deployed backend URL before packaging.

## Use

1. Right-click a folder in the VS Code Explorer and run `Share via FolderDrop`.
2. Share the copied secure link, open the redeem page, or show the QR code.
3. To receive a file in VS Code, run `FolderDrop: Download from FolderDrop Code` from the Command Palette and paste the secure link. The extension downloads and decrypts locally.

## Build

```powershell
npm install
npm run compile
npm run package
```

The package command creates a `.vsix` file that can be installed with:

```powershell
code --install-extension vscode-folder-drop-1.0.0.vsix
```

## Publish to the VS Code Marketplace

1. Deploy the FolderDrop backend first and copy its public HTTPS URL.
2. In `package.json`, change `folderdrop.serverUrl.default` from `https://your-folderdrop-app.onrender.com` to your real Render backend URL.
3. Replace `publisher` with your Marketplace publisher ID.
4. Create an Azure DevOps Personal Access Token with Marketplace publish permissions.
5. Login once:

```powershell
npx vsce login <publisher-id>
```

6. Package and publish:

```powershell
npm run package
npx vsce publish --packagePath vscode-folder-drop-1.0.0.vsix
```

You can also install the generated VSIX locally before publishing:

```powershell
code --install-extension vscode-folder-drop-1.0.0.vsix
```
