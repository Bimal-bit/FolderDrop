# How to Run and Deploy FolderDrop

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Java | 21+ | `java -version` |
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Docker | any recent version | `docker -v` |

You also need:

- Supabase project with a Storage bucket
- Upstash Redis database
- Render account for production hosting

## Local Setup

Copy the example environment file:

```powershell
copy .env.example .env
```

Fill in:

```env
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=folderdrop-files
INTERNAL_CLEANUP_TOKEN=any-random-string-here
```

## Run Locally

PowerShell:

```powershell
.\run-backend.ps1
```

Command Prompt:

```cmd
run-backend.cmd
```

Open:

```text
http://localhost:8080
http://localhost:8080/redeem
http://localhost:8080/actuator/health
```

## Frontend Development Mode

Terminal 1:

```powershell
.\run-backend.ps1
```

Terminal 2:

```powershell
cd web-ui
npm run dev
```

Open:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` calls to `http://localhost:8080`.

## Docker Local Test

```powershell
docker-compose up --build
```

Open:

```text
http://localhost:8080
```

Stop:

```powershell
docker-compose down
```

## Deploy to Render

### Recommended: Blueprint

1. Push the repo to GitHub.
2. Go to https://dashboard.render.com
3. Click `New +` -> `Blueprint`.
4. Connect your GitHub repo.
5. Render detects `render.yaml`.
6. Enter the prompted secrets:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_BUCKET`
7. Let Render generate `INTERNAL_CLEANUP_TOKEN`.
8. Deploy.

### Manual Web Service

Create a Render Web Service with:

| Setting | Value |
|---|---|
| Runtime | Docker |
| Dockerfile path | `./backend/Dockerfile` |
| Docker context | `.` |
| Health check path | `/actuator/health` |
| Branch | `main` |

Environment variables:

```text
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=folderdrop-files
INTERNAL_CLEANUP_TOKEN=your-random-secret
```

Render supplies `PORT` automatically. The app binds to `PORT` in production and `8080` locally.

## After Render Deploy

If your Render URL is:

```text
https://folderdrop.onrender.com
```

Set the VS Code extension setting:

```json
"folderdrop.serverUrl": "https://folderdrop.onrender.com"
```

Before Marketplace publishing, also update the default in `vscode-extension/package.json`.

## Encrypted Transfer Notes

FolderDrop encrypts files before upload and decrypts after download.

- The sender encrypts with AES-256-GCM.
- Render and Supabase store only encrypted bytes.
- The secure link contains the code and decryption key:

```text
https://your-app.onrender.com/redeem?code=123456#key=...
```

The `#key` part is a browser fragment and is not sent to the backend.
