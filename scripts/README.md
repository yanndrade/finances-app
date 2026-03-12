# Scripts

Utility scripts for local development, verification, builds, and repository maintenance.

Available scripts:

- `dev.ps1`: start desktop development runtime (`tauri dev`).
- `build-backend-sidecar.ps1`: build `backend.exe` with PyInstaller and copy it to `packages/desktop/src-tauri/bin`.
- `build-release-windows.ps1`: produce a full Windows release bundle (`.msi`) by building frontend, backend sidecar, and Tauri app. If signing env vars are configured, it signs sidecar/executable/installer with `signtool`.
- `check-monorepo-structure.ps1`: validate the base scaffold introduced by issue `#8`.
