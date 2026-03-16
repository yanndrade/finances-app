param(
    [switch]$SkipInstall,
    [string]$ReleaseVersion = "",
    [string]$SignCertPath = "",
    [string]$SignCertPassword = "",
    [string]$SignTimestampUrl = ""
)

$ErrorActionPreference = "Stop"

function Resolve-SignToolPath {
    $candidate = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($candidate) {
        return $candidate.Source
    }

    $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (-not (Test-Path $kitsRoot)) {
        throw "signtool.exe was not found in PATH and Windows SDK was not found at $kitsRoot"
    }

    $fromSdk = Get-ChildItem -Path $kitsRoot -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue `
        | Where-Object { $_.FullName -match "\\x64\\" } `
        | Sort-Object FullName -Descending `
        | Select-Object -First 1

    if (-not $fromSdk) {
        throw "signtool.exe was not found in Windows SDK folders."
    }

    return $fromSdk.FullName
}

function Resolve-TauriBinaryName {
    param(
        [string]$CargoTomlPath
    )

    if (-not (Test-Path $CargoTomlPath)) {
        throw "Tauri Cargo.toml not found at $CargoTomlPath"
    }

    $cargoTomlContent = Get-Content -Path $CargoTomlPath -Raw
    $packageBlockMatch = [regex]::Match(
        $cargoTomlContent,
        '(?ms)^\[package\]\s*(?<body>.*?)(?:^\[|\z)'
    )

    if (-not $packageBlockMatch.Success) {
        throw "Unable to locate [package] section in $CargoTomlPath"
    }

    $nameMatch = [regex]::Match(
        $packageBlockMatch.Groups["body"].Value,
        '(?m)^\s*name\s*=\s*"(?<name>[^"]+)"'
    )

    if (-not $nameMatch.Success) {
        throw "Unable to resolve package.name from $CargoTomlPath"
    }

    return $nameMatch.Groups["name"].Value
}

function Invoke-CodeSign {
    param(
        [string]$SignToolPath,
        [string]$CertificatePath,
        [string]$CertificatePassword,
        [string]$TimestampUrl,
        [string]$ArtifactPath
    )

    if (-not (Test-Path $ArtifactPath)) {
        throw "Cannot sign missing artifact: $ArtifactPath"
    }

    Write-Host "Signing artifact: $ArtifactPath"
    & $SignToolPath sign `
        /fd SHA256 `
        /f $CertificatePath `
        /p $CertificatePassword `
        /tr $TimestampUrl `
        /td SHA256 `
        $ArtifactPath

    if ($LASTEXITCODE -ne 0) {
        throw "signtool sign failed for $ArtifactPath (exit code $LASTEXITCODE)"
    }

    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
        $CertificatePath,
        $CertificatePassword,
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::DefaultKeySet
    )
    $isSelfSigned = $certificate.Subject -eq $certificate.Issuer

    & $SignToolPath verify /pa $ArtifactPath
    if ($LASTEXITCODE -ne 0) {
        if ($isSelfSigned) {
            Write-Warning "signtool verify failed for $ArtifactPath because the certificate is self-signed and not trusted on the runner. Signature creation succeeded; skipping trust verification for test certificates."
            $global:LASTEXITCODE = 0
        }
        else {
            throw "signtool verify failed for $ArtifactPath (exit code $LASTEXITCODE)"
        }
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendPath = Join-Path $repoRoot "packages\frontend"
$backendPath = Join-Path $repoRoot "packages\backend"
$desktopPath = Join-Path $repoRoot "packages\desktop"
$desktopCargoTomlPath = Join-Path $repoRoot "packages\desktop\src-tauri\Cargo.toml"
$buildSidecarScript = Join-Path $PSScriptRoot "build-backend-sidecar.ps1"
$setDesktopVersionScript = Join-Path $PSScriptRoot "set-desktop-version.ps1"
$desktopSidecarPath = Join-Path $repoRoot "packages\desktop\src-tauri\bin\backend.exe"
$desktopBinaryName = Resolve-TauriBinaryName -CargoTomlPath $desktopCargoTomlPath
$desktopReleaseExePath = Join-Path $repoRoot "packages\desktop\src-tauri\target\release\$desktopBinaryName.exe"
$msiOutputDirectory = Join-Path $repoRoot "packages\desktop\src-tauri\target\release\bundle\msi"

if (-not (Test-Path $frontendPath)) {
    throw "Frontend package not found at $frontendPath"
}

if (-not (Test-Path $backendPath)) {
    throw "Backend package not found at $backendPath"
}

if (-not (Test-Path $desktopPath)) {
    throw "Desktop package not found at $desktopPath"
}

if (-not (Test-Path $buildSidecarScript)) {
    throw "Sidecar build script not found at $buildSidecarScript"
}

if (-not (Test-Path $setDesktopVersionScript)) {
    throw "Desktop version sync script not found at $setDesktopVersionScript"
}

if ([string]::IsNullOrWhiteSpace($ReleaseVersion)) {
    $ReleaseVersion = $env:RELEASE_VERSION
}

if (-not [string]::IsNullOrWhiteSpace($ReleaseVersion)) {
    Write-Host "Applying desktop release version $ReleaseVersion..."
    try {
        & $setDesktopVersionScript -Version $ReleaseVersion
    }
    catch {
        throw "Desktop version sync failed: $($_.Exception.Message)"
    }
}

if ([string]::IsNullOrWhiteSpace($SignCertPath)) {
    $SignCertPath = $env:WINDOWS_SIGN_CERT_PATH
}
if ([string]::IsNullOrWhiteSpace($SignCertPassword)) {
    $SignCertPassword = $env:WINDOWS_SIGN_CERT_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($SignTimestampUrl)) {
    $SignTimestampUrl = $env:WINDOWS_SIGN_TIMESTAMP_URL
}
if ([string]::IsNullOrWhiteSpace($SignTimestampUrl)) {
    $SignTimestampUrl = "http://timestamp.digicert.com"
}

$hasSignCert = -not [string]::IsNullOrWhiteSpace($SignCertPath)
$hasSignPassword = -not [string]::IsNullOrWhiteSpace($SignCertPassword)

if ($hasSignCert -xor $hasSignPassword) {
    throw "Code signing configuration is incomplete. Provide both certificate path and certificate password."
}

$shouldSign = $hasSignCert -and $hasSignPassword
$signToolPath = $null

if ($shouldSign) {
    if (-not (Test-Path $SignCertPath)) {
        throw "Code signing certificate was not found at $SignCertPath"
    }
    $signToolPath = Resolve-SignToolPath
    Write-Host "Code signing is enabled."
    Write-Host "Using signtool at: $signToolPath"
}
else {
    Write-Host "Code signing is disabled for this build."
}

if (-not $SkipInstall) {
    Write-Host "Installing frontend dependencies..."
    Set-Location $frontendPath
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed for frontend (exit code $LASTEXITCODE)"
    }

    Write-Host "Installing backend dependencies..."
    Set-Location $backendPath
    uv sync
    if ($LASTEXITCODE -ne 0) {
        throw "uv sync failed for backend (exit code $LASTEXITCODE)"
    }

    Write-Host "Installing desktop dependencies..."
    Set-Location $desktopPath
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed for desktop (exit code $LASTEXITCODE)"
    }
}

Write-Host "Building frontend production assets..."
Set-Location $frontendPath
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed for frontend (exit code $LASTEXITCODE)"
}

Write-Host "Building backend sidecar..."
Set-Location $repoRoot
& $buildSidecarScript

if ($shouldSign) {
    Invoke-CodeSign `
        -SignToolPath $signToolPath `
        -CertificatePath $SignCertPath `
        -CertificatePassword $SignCertPassword `
        -TimestampUrl $SignTimestampUrl `
        -ArtifactPath $desktopSidecarPath
}

Write-Host "Building desktop MSI bundle..."
Set-Location $desktopPath
npm run tauri -- build
if ($LASTEXITCODE -ne 0) {
    throw "tauri build failed (exit code $LASTEXITCODE)"
}

if (-not (Test-Path $desktopReleaseExePath)) {
    throw "Desktop executable not found after build: $desktopReleaseExePath"
}

$msiArtifacts = Get-ChildItem -Path $msiOutputDirectory -Filter *.msi -File -ErrorAction SilentlyContinue
if (-not $msiArtifacts) {
    throw "MSI output was not found in $msiOutputDirectory"
}

if ($shouldSign) {
    Invoke-CodeSign `
        -SignToolPath $signToolPath `
        -CertificatePath $SignCertPath `
        -CertificatePassword $SignCertPassword `
        -TimestampUrl $SignTimestampUrl `
        -ArtifactPath $desktopReleaseExePath

    foreach ($msi in $msiArtifacts) {
        Invoke-CodeSign `
            -SignToolPath $signToolPath `
            -CertificatePath $SignCertPath `
            -CertificatePassword $SignCertPassword `
            -TimestampUrl $SignTimestampUrl `
            -ArtifactPath $msi.FullName
    }
}

Write-Host "Windows release build completed."
$global:LASTEXITCODE = 0
