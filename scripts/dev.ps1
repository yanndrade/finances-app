$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $repoRoot "packages\backend"
$frontendPath = Join-Path $repoRoot "packages\frontend"

function Stop-ListeningProcesses([int[]] $Ports) {
    $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in $Ports }

    if ($null -eq $connections) {
        return
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

        if ($null -eq $process) {
            continue
        }

        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Write-Host ("Stopped PID {0} ({1}) using dev port." -f $processId, $process.ProcessName)
    }
}

Stop-ListeningProcesses -Ports @(8000, 5173, 5174, 5175)

$backendCommand = "Set-Location '$backendPath'; uv run uvicorn finance_app.interfaces.http.app:create_app --factory --reload --host 127.0.0.1 --port 8000"
$frontendCommand = "npm run dev -- --host 127.0.0.1 --port 5174"

Start-Process powershell.exe -WorkingDirectory $backendPath -ArgumentList @(
    "-NoExit",
    "-Command",
    $backendCommand
)

Start-Process cmd.exe -WorkingDirectory $frontendPath -ArgumentList @(
    "/k",
    $frontendCommand
)

Write-Host "Backend iniciado em nova janela: http://127.0.0.1:8000"
Write-Host "Frontend iniciado em nova janela: normalmente em http://127.0.0.1:5174"
Write-Host "Para encerrar, feche as duas janelas abertas."
