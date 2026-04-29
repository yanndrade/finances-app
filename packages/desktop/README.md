# Desktop

Desktop shell for MeuCofri (Tauri v2).

- `src-tauri/`: Rust host runtime, tray behavior, backend lifecycle, and autostart commands
- `icons/`: desktop packaging icon assets

## Development

Run desktop development from this package:

```powershell
npm run tauri -- dev
```

The desktop runtime starts the backend automatically using:

```powershell
uv run backend --host 127.0.0.1 --port 48200
```

## Release Packaging (Windows)

The desktop release expects a bundled backend sidecar at:

- `src-tauri/bin/backend.exe`

From the repository root, use:

```powershell
./scripts/build-release-windows.ps1
```

Optional signing env vars used by the release script:

- `WINDOWS_SIGN_CERT_PATH`
- `WINDOWS_SIGN_CERT_PASSWORD`
- `WINDOWS_SIGN_TIMESTAMP_URL`

Generated installer files (`.msi`) are written to:

- `src-tauri/target/release/bundle/msi`
