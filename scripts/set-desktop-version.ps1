param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must use semantic version format major.minor.patch (for example: 2.0.0)."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$desktopPackageJsonPath = Join-Path $repoRoot "packages\desktop\package.json"
$cargoTomlPath = Join-Path $repoRoot "packages\desktop\src-tauri\Cargo.toml"
$tauriConfigPath = Join-Path $repoRoot "packages\desktop\src-tauri\tauri.conf.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Set-CargoPackageVersion {
    param(
        [string]$Path,
        [string]$NextVersion
    )

    $content = Get-Content -Path $Path -Raw
    $pattern = '(?ms)(^\[package\]\s.*?^\s*version\s*=\s*")[^"]+(")'
    $match = [System.Text.RegularExpressions.Regex]::Match($content, $pattern)

    if (-not $match.Success) {
        throw "Unable to locate package version in $Path"
    }

    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        $pattern,
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($item)
            $item.Groups[1].Value + $NextVersion + $item.Groups[2].Value
        },
        1
    )

    Write-Utf8NoBom -Path $Path -Content $updated
}

function Set-JsonVersion {
    param(
        [string]$Path,
        [string]$NextVersion
    )

    $content = Get-Content -Path $Path -Raw
    $pattern = '("version"\s*:\s*")[^"]+(")'
    $match = [System.Text.RegularExpressions.Regex]::Match($content, $pattern)

    if (-not $match.Success) {
        throw "Unable to locate JSON version in $Path"
    }

    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        $pattern,
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($item)
            $item.Groups[1].Value + $NextVersion + $item.Groups[2].Value
        },
        1
    )

    Write-Utf8NoBom -Path $Path -Content $updated
}

Set-JsonVersion -Path $desktopPackageJsonPath -NextVersion $Version

Set-CargoPackageVersion -Path $cargoTomlPath -NextVersion $Version

Set-JsonVersion -Path $tauriConfigPath -NextVersion $Version

Write-Host "Desktop version synchronized to $Version"
