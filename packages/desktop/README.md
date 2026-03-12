# Desktop

Desktop shell for the finances app (Tauri v2).

- `src-tauri/`: Rust host runtime, tray behavior, backend lifecycle, and autostart commands
- `icons/`: desktop packaging icon assets

## Development

Run desktop development from this package:

```powershell
npm run tauri -- dev
```

The desktop runtime starts the backend automatically using:

```powershell
uv run backend --host 127.0.0.1 --port 8000
```
