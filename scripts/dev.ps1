$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$desktopPath = Join-Path $repoRoot "packages\desktop"

if (-not (Test-Path $desktopPath)) {
    throw "Desktop package not found at $desktopPath"
}

Write-Host "Starting desktop runtime with Tauri dev (frontend + backend lifecycle managed by desktop shell)."
Set-Location $desktopPath
npm run tauri -- dev
