# Copy the installed desktop app's databases into .sandbox/ so migrations and
# other destructive changes can be exercised against real data without risking
# it.
#
# The copy goes through SQLite's backup API on purpose: events.db keeps most of
# its recent events in the -wal file, so copying the .db alone would produce a
# stale event store.

param(
    [string]$SourceDir = (Join-Path $env:LOCALAPPDATA "com.yannb.meucofri")
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sandboxDir = Join-Path $repoRoot ".sandbox"
$python = Join-Path $repoRoot "packages\backend\.venv\Scripts\python.exe"

if (-not (Test-Path $SourceDir)) {
    throw "Source data directory not found at $SourceDir"
}

if (-not (Test-Path $python)) {
    throw "Backend virtualenv not found at $python. Run 'uv sync' in packages/backend first."
}

New-Item -ItemType Directory -Force -Path $sandboxDir | Out-Null

$helper = Join-Path $PSScriptRoot "make_sandbox.py"

& $python $helper $SourceDir $sandboxDir

Write-Host ""
Write-Host "Sandbox ready at $sandboxDir" -ForegroundColor Green
Write-Host "Run the backend against it with:"
Write-Host "  `$env:FINANCE_APP_DATABASE_PATH = '$sandboxDir\app.db'"
Write-Host "  `$env:FINANCE_APP_EVENT_DATABASE_PATH = '$sandboxDir\events.db'"
Write-Host "  uv run backend --host 127.0.0.1 --port 27654"
