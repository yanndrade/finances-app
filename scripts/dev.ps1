$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendPath = Join-Path $repoRoot "packages\frontend"
$desktopPath = Join-Path $repoRoot "packages\desktop"
$frontendPort = 43173
$backendExecutablePath = Join-Path $repoRoot "packages\backend\.venv\Scripts\backend.exe"

if (-not (Test-Path $frontendPath)) {
    throw "Frontend package not found at $frontendPath"
}

if (-not (Test-Path $desktopPath)) {
    throw "Desktop package not found at $desktopPath"
}

function Test-TcpPortReady {
    param(
        [string]$HostName,
        [int]$Port
    )

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
        $connected = $asyncResult.AsyncWaitHandle.WaitOne(500)

        if (-not $connected) {
            $client.Close()
            return $false
        }

        $client.EndConnect($asyncResult)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Stop-ProcessTree {
    param(
        [int]$ProcessId
    )

    if ($ProcessId -le 0) {
        return
    }

    try {
        & taskkill /PID $ProcessId /T /F | Out-Null
    } catch {
        # Ignore if process already exited.
    }
}

function Stop-StaleDevProcesses {
    $staleProcesses = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -in @("meucofri-desktop.exe", "meucofri_desktop.exe", "cargo.exe", "rustc.exe") -or
        $_.ExecutablePath -eq $backendExecutablePath -or
        ($_.CommandLine -and $_.CommandLine -like "*$repoRoot*packages\\desktop\\src-tauri*") -or
        ($_.CommandLine -and $_.CommandLine -like "*$repoRoot*packages\\frontend*vite*--port $frontendPort*")
    }

    foreach ($process in $staleProcesses) {
        Write-Host "Stopping stale process: $($process.Name) (PID $($process.ProcessId))"
        Stop-ProcessTree -ProcessId $process.ProcessId
    }
}

Stop-StaleDevProcesses

Write-Host "Starting frontend dev server on port $frontendPort..."
$frontendProcess = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "$frontendPort" `
    -WorkingDirectory $frontendPath `
    -PassThru

try {
    $maxAttempts = 60
    $attempt = 0

    while (-not (Test-TcpPortReady -HostName "127.0.0.1" -Port $frontendPort)) {
        if ($frontendProcess.HasExited) {
            throw "Frontend dev server exited early with code $($frontendProcess.ExitCode)."
        }

        $attempt++
        if ($attempt -ge $maxAttempts) {
            throw "Timed out waiting for frontend dev server on http://127.0.0.1:$frontendPort."
        }

        Start-Sleep -Milliseconds 500
    }

    Write-Host "Frontend ready. Starting Tauri desktop runtime..."
    Set-Location $desktopPath
    npm run tauri -- dev
}
finally {
    if ($null -ne $frontendProcess -and -not $frontendProcess.HasExited) {
        Write-Host "Stopping frontend dev server..."
        Stop-ProcessTree -ProcessId $frontendProcess.Id
    }
}
