$requiredPaths = @(
    "packages/shared",
    "packages/shared/README.md",
    "packages/shared/version.txt",
    "packages/shared/schemas",
    "packages/shared/schemas/README.md",
    "packages/shared/types",
    "packages/shared/types/README.md",
    "packages/shared/contracts",
    "packages/shared/contracts/README.md"
)

$missing = @()

foreach ($path in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $path
    }
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing required shared contract paths:`n - " + ($missing -join "`n - "))
    exit 1
}

$version = (Get-Content -Raw "packages/shared/version.txt").Trim()

if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Error "packages/shared/version.txt must contain a non-empty contract version."
    exit 1
}

Write-Host ("Shared contract package is defined with contract version " + $version + ".")
