# Scripts

Utility scripts for local development, verification, builds, and repository maintenance.

Available scripts:

- `dev.ps1`: start desktop development runtime (`tauri dev`).
- `build-backend-sidecar.ps1`: build `backend.exe` with PyInstaller and copy it to `packages/desktop/src-tauri/bin`.
- `build-release-windows.ps1`: produce a full Windows release bundle (`.msi`) by building frontend, backend sidecar, and Tauri app. If signing env vars are configured, it signs sidecar/executable/installer with `signtool`.
- `check-monorepo-structure.ps1`: validate the base scaffold introduced by issue `#8`.
- `make-sandbox.ps1`: copy the installed desktop app's `app.db`/`events.db` into `.sandbox/` (via SQLite's backup API, so the WAL is consolidated) to exercise migrations against real data safely. Calls `make_sandbox.py`.

## Running the desktop app against a sandbox

`MEUCOFRI_DATA_DIR` points the dev backend at a data directory other than the
repository one. Only the dev shell reads it — the installed app always uses its
own data directory, so a variable left over in the environment can never
redirect it. `dev.ps1` resolves a relative value against the repository root:

```powershell
pwsh -File scripts/make-sandbox.ps1
$env:MEUCOFRI_DATA_DIR = '.sandbox'
pwsh -File scripts/dev.ps1
```

The app then reads `.sandbox/app.db` and `.sandbox/events.db`, and writes its
certificates and `backend-startup.log` there too. This is the way to exercise
the Pluggy import against real data: the shell holds the DPAPI-protected
credentials, so a backend started by hand does not have them.

Clear the variable (`Remove-Item Env:MEUCOFRI_DATA_DIR`) to go back to the
installed database.
