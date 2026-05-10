# ─────────────────────────────────────────────────────────────────
#  FolderDrop — Start backend locally (PowerShell)
#  Run from project root:  .\run-backend.ps1
# ─────────────────────────────────────────────────────────────────

# Add local Maven to PATH
$env:PATH = "$PSScriptRoot\tools\apache-maven-3.9.6\bin;" + $env:PATH

# Load .env file into environment variables
Get-Content "$PSScriptRoot\.env" | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $key   = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    if ($key -and $value) {
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

Write-Host ""
Write-Host "Starting FolderDrop backend..." -ForegroundColor Cyan
Write-Host "  Upstash URL : $env:UPSTASH_REDIS_REST_URL"
Write-Host "  Supabase    : $env:SUPABASE_URL"
Write-Host "  Bucket      : $env:SUPABASE_BUCKET"
Write-Host ""
Write-Host "First run downloads dependencies (~2 min). Subsequent runs are fast." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PSScriptRoot\backend"
mvn spring-boot:run
