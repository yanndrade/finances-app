$requiredPaths = @(
    "README.md",
    "LICENSE",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    "docs",
    "docs/prd.md",
    "docs/frontend-guidelines.md",
    "docs/README.md",
    "docs/architecture.md",
    "docs/adr",
    "docs/adr/README.md",
    "scripts",
    "scripts/README.md",
    "infra",
    "infra/README.md",
    "infra/installers",
    "infra/installers/README.md",
    "infra/icons",
    "infra/icons/README.md",
    "packages",
    "packages/README.md",
    "packages/shared",
    "packages/shared/README.md",
    "packages/shared/schemas",
    "packages/shared/schemas/.gitkeep",
    "packages/shared/types",
    "packages/shared/types/.gitkeep",
    "packages/backend",
    "packages/backend/README.md",
    "packages/backend/src",
    "packages/backend/src/finance_app",
    "packages/backend/src/finance_app/domain",
    "packages/backend/src/finance_app/domain/.gitkeep",
    "packages/backend/src/finance_app/application",
    "packages/backend/src/finance_app/application/.gitkeep",
    "packages/backend/src/finance_app/infrastructure",
    "packages/backend/src/finance_app/infrastructure/.gitkeep",
    "packages/backend/src/finance_app/interfaces",
    "packages/backend/src/finance_app/interfaces/.gitkeep",
    "packages/backend/tests",
    "packages/backend/tests/.gitkeep",
    "packages/frontend",
    "packages/frontend/README.md",
    "packages/frontend/src",
    "packages/frontend/src/pages",
    "packages/frontend/src/pages/.gitkeep",
    "packages/frontend/src/components",
    "packages/frontend/src/components/.gitkeep",
    "packages/frontend/src/features",
    "packages/frontend/src/features/.gitkeep",
    "packages/frontend/src/lib",
    "packages/frontend/src/lib/.gitkeep",
    "packages/frontend/public",
    "packages/frontend/public/.gitkeep",
    "packages/desktop",
    "packages/desktop/README.md",
    "packages/desktop/src-tauri",
    "packages/desktop/src-tauri/src",
    "packages/desktop/src-tauri/src/.gitkeep",
    "packages/desktop/icons",
    "packages/desktop/icons/.gitkeep"
)

$missing = @()

foreach ($path in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $path
    }
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing required scaffold paths:`n - " + ($missing -join "`n - "))
    exit 1
}

Write-Host "Monorepo scaffold matches the expected structure."
