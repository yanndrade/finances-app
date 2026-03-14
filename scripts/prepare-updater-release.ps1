param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseVersion,
    [Parameter(Mandatory = $true)]
    [string]$ReleaseTag,
    [Parameter(Mandatory = $true)]
    [string]$Repository
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$desktopPath = Join-Path $repoRoot "packages\desktop"
$msiOutputDirectory = Join-Path $repoRoot "packages\desktop\src-tauri\target\release\bundle\msi"

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
    throw "Missing TAURI_SIGNING_PRIVATE_KEY. Updater artifacts cannot be signed."
}

$msiArtifact = Get-ChildItem -Path $msiOutputDirectory -Filter *.msi -File -ErrorAction Stop `
    | Sort-Object LastWriteTimeUtc -Descending `
    | Select-Object -First 1

if (-not $msiArtifact) {
    throw "No MSI artifact found in $msiOutputDirectory"
}

Set-Location $desktopPath
npm run tauri -- signer sign -- $msiArtifact.FullName
if ($LASTEXITCODE -ne 0) {
    throw "tauri signer sign failed for $($msiArtifact.FullName) (exit code $LASTEXITCODE)"
}

$signaturePath = "$($msiArtifact.FullName).sig"
if (-not (Test-Path $signaturePath)) {
    throw "Updater signature was not generated at $signaturePath"
}

$signature = (Get-Content $signaturePath -Raw).Trim()
$downloadUrl = "https://github.com/$Repository/releases/download/$ReleaseTag/$($msiArtifact.Name)"
$manifest = [ordered]@{
    version = $ReleaseVersion
    pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = $signature
            url = $downloadUrl
        }
    }
}

$latestJsonPath = Join-Path $msiOutputDirectory "latest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $latestJsonPath

Write-Host "Prepared updater artifacts:"
Write-Host " - MSI: $($msiArtifact.FullName)"
Write-Host " - Signature: $signaturePath"
Write-Host " - Static manifest: $latestJsonPath"
