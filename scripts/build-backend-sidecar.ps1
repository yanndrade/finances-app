$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $repoRoot "packages\backend"
$desktopBinPath = Join-Path $repoRoot "packages\desktop\src-tauri\bin"
$backendDistPath = Join-Path $backendPath "dist"
$backendExecutable = Join-Path $backendDistPath "backend.exe"
$targetSidecarPath = Join-Path $desktopBinPath "backend.exe"
$pyInstallerExecutable = Join-Path $backendPath ".venv\Scripts\pyinstaller.exe"

if (-not (Test-Path $backendPath)) {
    throw "Backend package not found at $backendPath"
}

New-Item -Path $desktopBinPath -ItemType Directory -Force | Out-Null

Write-Host "Building backend sidecar with PyInstaller..."
Set-Location $backendPath

if (Test-Path $pyInstallerExecutable) {
    & $pyInstallerExecutable `
        --noconfirm `
        --clean `
        --onefile `
        --noconsole `
        --name backend `
        --specpath build `
        --paths src `
        src/finance_app/cli.py
}
else {
    Write-Host "PyInstaller not found in backend virtual environment. Using uvx fallback..."
    uvx pyinstaller `
        --noconfirm `
        --clean `
        --onefile `
        --noconsole `
        --name backend `
        --specpath build `
        --paths src `
        src/finance_app/cli.py
}

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $backendExecutable)) {
    throw "PyInstaller build did not produce $backendExecutable"
}

Copy-Item -Path $backendExecutable -Destination $targetSidecarPath -Force
Write-Host "Backend sidecar ready at $targetSidecarPath"
