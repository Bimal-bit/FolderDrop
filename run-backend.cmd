@echo off
REM ─────────────────────────────────────────────────────────────────
REM  FolderDrop — Start backend locally
REM  Run this from the project root: run-backend.cmd
REM ─────────────────────────────────────────────────────────────────

REM Load .env file — reads KEY=VALUE lines, skips comments and blanks
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /v "^#" .env ^| findstr /v "^$"`) do (
    set "%%A=%%B"
)

echo.
echo Starting FolderDrop backend...
echo   Upstash URL : %UPSTASH_REDIS_REST_URL%
echo   Supabase    : %SUPABASE_URL%
echo   Bucket      : %SUPABASE_BUCKET%
echo.

cd backend
call mvnw.cmd spring-boot:run
