# FolderDrop

FolderDrop lets you share a folder from VS Code with a short redeem code. The extension zips a selected folder, encrypts it locally, uploads only encrypted bytes to your backend, and gives the receiver a secure redeem link. The web app redeems the code, downloads the encrypted archive, and decrypts it locally.

No account is required for senders or receivers.

## Architecture

```text
VS Code Extension
      |
      | POST /api/upload (ZIP, multipart)
      v
Spring Boot Backend (Render Web Service)
      |                    |
      v                    v
Supabase Storage      Upstash Redis
(encrypted archive)   (OTP -> UUID, TTL 600s)
      ^
      |
      | 302 redirect to signed URL
      |
React Web UI (/redeem)
```

## Tech Stack

| Layer | Technology |
|---|---|
| VS Code Extension | TypeScript + VS Code API |
| Backend | Spring Boot 3.x, Java 21 |
| OTP Store | Upstash Redis REST API |
| File Storage | Supabase Storage REST API |
| Web UI | React + Vite, served by Spring Boot |
| Hosting | Render Docker Web Service |

## Quick Start

### Prerequisites

- Java 21+
- Node.js 20+
- Supabase project with a Storage bucket
- Upstash Redis database

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Upstash and Supabase credentials. Never commit `.env`.

### 2. Build the web UI

```bash
cd web-ui
npm install
npm run build
```

### 3. Run the backend

```bash
cd backend
./mvnw spring-boot:run
```

On Windows:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Visit:

```text
http://localhost:8080/redeem
```

### 4. Run the VS Code extension locally

```bash
cd vscode-extension
npm install
npm run compile
```

Then press `F5` in VS Code to launch an Extension Development Host.

For local testing, set this VS Code setting:

```json
"folderdrop.serverUrl": "http://localhost:8080"
```

## Download Flow

The website and extension both redeem codes through:

```text
GET /api/download/{otp}
```

The sender encrypts the ZIP using AES-256-GCM before upload. The backend validates the OTP, decrements the remaining download count, and serves only encrypted bytes. Browsers and the VS Code extension decrypt locally using the key from the secure link.

Secure QR codes point to:

```text
/redeem?code=123456#key=ENCRYPTION_KEY
```

The `#key=...` fragment is not sent to the backend. Supabase and Render never receive the decryption key.

## Deploy Backend and Website on Render

This repo includes a root-level `render.yaml` Blueprint. Render will build `backend/Dockerfile`, which builds the React web UI, copies it into Spring Boot static resources, and serves the website and API from one Render Web Service.

### Option A: Render Blueprint

1. Push this repo to GitHub.
2. Open Render: https://dashboard.render.com
3. Click `New +` -> `Blueprint`.
4. Connect your GitHub repo.
5. Select the branch, usually `main`.
6. Render will detect `render.yaml`.
7. Fill the secret values when Render prompts you:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_BUCKET`
8. Let Render generate `INTERNAL_CLEANUP_TOKEN`.
9. Click `Deploy Blueprint`.

Your app URL will look like:

```text
https://folderdrop.onrender.com
```

### Option B: Manual Render Web Service

Use this if you do not want to use Blueprints.

1. Push this repo to GitHub.
2. In Render, click `New +` -> `Web Service`.
3. Connect your GitHub repo.
4. Set `Language` / `Runtime` to `Docker`.
5. Set Dockerfile path:

```text
./backend/Dockerfile
```

6. Set Docker build context:

```text
.
```

7. Set health check path:

```text
/actuator/health
```

8. Add environment variables:

```text
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=folderdrop-files
INTERNAL_CLEANUP_TOKEN=any-long-random-secret
```

9. Deploy.

Render provides `PORT` automatically for Web Services. The backend uses `server.port=${PORT:8080}`, so it runs on `8080` locally and Render's port in production.

## Configure the VS Code Extension for Render

After Render deploys, copy your public Render URL, for example:

```text
https://folderdrop.onrender.com
```

Then update `vscode-extension/package.json`:

- Set `publisher` to your Marketplace publisher ID.
- Set `folderdrop.serverUrl.default` to your Render URL.
- Set `repository.url` to your GitHub repository URL.

Then package:

```powershell
cd vscode-extension
npm.cmd run package
```

Install locally:

```powershell
code --install-extension vscode-folder-drop-1.0.0.vsix
```

Publish to Marketplace:

```powershell
npx.cmd vsce login <publisher-id>
npx.cmd vsce publish --packagePath vscode-folder-drop-1.0.0.vsix
```

## Verify the Render Deployment

Open these URLs after deploy:

```text
https://folderdrop.onrender.com/
https://folderdrop.onrender.com/redeem
https://folderdrop.onrender.com/actuator/health
```

Expected health response:

```json
{ "status": "UP" }
```

Then test the full flow:

1. Install the VSIX locally.
2. Set `folderdrop.serverUrl` to your Render URL.
3. Right-click a folder in VS Code and run `Share via FolderDrop`.
4. Copy the secure link, which looks like `https://folderdrop.onrender.com/redeem?code=YOUR_CODE#key=...`.
5. Open the secure link and click `Download & Decrypt`.

## GitHub Upload

Do not commit `.env`, `node_modules`, `target`, `dist`, `out`, `.vsix`, or local tool downloads. The included `.gitignore` excludes those.

```powershell
cd "d:\vs code file drop"
git init
git add .
git status
git commit -m "Initial FolderDrop release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/folderdrop.git
git push -u origin main
```

## API Reference

### `POST /api/upload`

Uploads a ZIP file and returns a code.

Request:

```text
multipart/form-data
field: file
optional field: maxDownloads
```

Response:

```json
{ "otp": "482910", "expiresIn": 600, "maxDownloads": 1 }
```

### `GET /api/info/{otp}`

Returns metadata without consuming a download.

```json
{ "maxDownloads": 1, "remaining": 1 }
```

### `GET /api/download/{otp}`

Redeems a code and downloads the file.

Response:

```text
302 redirect to a short-lived Supabase signed URL
```

### `DELETE /api/file/{uuid}`

Internal cleanup endpoint. Requires the `X-Internal-Token` header.

## Security Model

| Threat | Mitigation |
|---|---|
| OTP brute force | Rate limits on upload and download endpoints |
| Replay | Download counter is decremented when a code is redeemed |
| Expired transfers | Redis TTL removes stale OTP entries |
| Large upload abuse | 50 MB max enforced by extension and backend |
| Direct storage exposure | Stored files are encrypted before upload |
| Backend compromise | Decryption keys stay in the secure link fragment and are not sent to the backend |
