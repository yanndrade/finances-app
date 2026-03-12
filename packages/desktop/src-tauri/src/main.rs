#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::ManagerExt;

const MAIN_WINDOW_LABEL: &str = "main";
const BACKEND_BIND_HOST: &str = "0.0.0.0";
const BACKEND_HEALTH_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 8000;
const BACKEND_BOOTSTRAP_TIMEOUT: Duration = Duration::from_secs(15);
const TRAY_EVENT_QUICK_ADD: &str = "desktop://quick-add";
const TRAY_EVENT_LOCK: &str = "desktop://lock";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TrayAction {
    Open,
    QuickAdd,
    Lock,
    Quit,
    Unknown,
}

impl TrayAction {
    fn from_menu_id(menu_id: &str) -> Self {
        match menu_id {
            "open" => Self::Open,
            "quick_add" => Self::QuickAdd,
            "lock" => Self::Lock,
            "quit" => Self::Quit,
            _ => Self::Unknown,
        }
    }
}

struct RuntimeState {
    backend_child: Mutex<Option<Child>>,
    is_quitting: AtomicBool,
}

impl RuntimeState {
    fn new(backend_child: Child) -> Self {
        Self {
            backend_child: Mutex::new(Some(backend_child)),
            is_quitting: AtomicBool::new(false),
        }
    }

    fn new_empty() -> Self {
        Self {
            backend_child: Mutex::new(None),
            is_quitting: AtomicBool::new(false),
        }
    }

    fn mark_quitting(&self) {
        self.is_quitting.store(true, Ordering::SeqCst);
    }

    fn is_quitting(&self) -> bool {
        self.is_quitting.load(Ordering::SeqCst)
    }

    fn stop_backend(&self) {
        let mut guard = match self.backend_child.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };

        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[tauri::command]
fn get_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|error| error.to_string())?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_autostart_enabled,
            set_autostart_enabled
        ])
        .setup(|app| {
            let mut backend_child = spawn_backend_process(&app.handle())?;
            if let Err(error) = wait_for_backend_ready() {
                let _ = backend_child.kill();
                let _ = backend_child.wait();
                return Err(error);
            }
            app.manage(RuntimeState::new(backend_child));
            configure_tray(app)?;
            show_main_window(&app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app_handle = window.app_handle();
                let should_quit = app_handle
                    .try_state::<RuntimeState>()
                    .is_some_and(|state| state.is_quitting());

                if !should_quit {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build finances desktop shell");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            if let Some(state) = app_handle.try_state::<RuntimeState>() {
                state.mark_quitting();
                state.stop_backend();
            }
        }
    });
}

fn configure_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItemBuilder::with_id("open", "Open").build(app)?;
    let quick_add_item = MenuItemBuilder::with_id("quick_add", "Quick Add").build(app)?;
    let lock_item = MenuItemBuilder::with_id("lock", "Lock").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&open_item, &quick_add_item, &lock_item, &quit_item])
        .build()?;

    let tray_builder = TrayIconBuilder::with_id("finance-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_tray_action(app, TrayAction::from_menu_id(event.id().as_ref()));
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                handle_tray_action(&tray.app_handle(), TrayAction::Open);
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder.icon(icon.clone()).build(app)?;
    } else {
        tray_builder.build(app)?;
    }

    Ok(())
}

fn handle_tray_action(app: &AppHandle, action: TrayAction) {
    match action {
        TrayAction::Open => {
            let _ = show_main_window(app);
        }
        TrayAction::QuickAdd => {
            let _ = show_main_window(app);
            let _ = emit_to_main_window(app, TRAY_EVENT_QUICK_ADD);
        }
        TrayAction::Lock => {
            let _ = show_main_window(app);
            let _ = emit_to_main_window(app, TRAY_EVENT_LOCK);
        }
        TrayAction::Quit => {
            if let Some(state) = app.try_state::<RuntimeState>() {
                state.mark_quitting();
                state.stop_backend();
            }
            app.exit(0);
        }
        TrayAction::Unknown => {}
    }
}

fn emit_to_main_window(
    app: &AppHandle,
    event_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or("main window is missing")?;
    main_window.emit(event_name, ())?;
    Ok(())
}

fn show_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or("main window is missing")?;
    main_window.show()?;
    main_window.unminimize()?;
    main_window.set_focus()?;
    Ok(())
}

fn spawn_backend_process(app: &AppHandle) -> Result<Child, Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        let backend_dir = resolve_dev_backend_dir()?;
        let child = Command::new("uv")
            .arg("run")
            .arg("backend")
            .arg("--host")
            .arg(BACKEND_BIND_HOST)
            .arg("--port")
            .arg(BACKEND_PORT.to_string())
            .current_dir(backend_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        return Ok(child);
    }

    let backend_path = resolve_release_backend_path(app)?;
    let working_dir = backend_path
        .parent()
        .ok_or("backend executable directory is missing")?
        .to_path_buf();

    let child = Command::new(&backend_path)
        .arg("--host")
        .arg(BACKEND_BIND_HOST)
        .arg("--port")
        .arg(BACKEND_PORT.to_string())
        .current_dir(working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    Ok(child)
}

fn resolve_dev_backend_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let backend_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("backend")
        .canonicalize()?;
    Ok(backend_dir)
}

fn resolve_release_backend_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let binary_name = if cfg!(target_os = "windows") {
        "backend.exe"
    } else {
        "backend"
    };

    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join(binary_name);
        if bundled.exists() {
            return Ok(bundled);
        }
    }

    let current_executable = std::env::current_exe()?;
    if let Some(parent) = current_executable.parent() {
        let local_binary = parent.join(binary_name);
        if local_binary.exists() {
            return Ok(local_binary);
        }
    }

    Err(format!("unable to locate `{binary_name}` sidecar for desktop runtime").into())
}

fn wait_for_backend_ready() -> Result<(), Box<dyn std::error::Error>> {
    let socket_address: SocketAddr = format!("{BACKEND_HEALTH_HOST}:{BACKEND_PORT}").parse()?;
    let started_at = Instant::now();

    while started_at.elapsed() < BACKEND_BOOTSTRAP_TIMEOUT {
        if backend_healthcheck(&socket_address) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(250));
    }

    Err("backend failed to become ready within timeout".into())
}

fn backend_healthcheck(address: &SocketAddr) -> bool {
    let mut stream = match TcpStream::connect_timeout(address, Duration::from_millis(500)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };

    let request = format!(
        "GET /health HTTP/1.1\r\nHost: {BACKEND_HEALTH_HOST}:{BACKEND_PORT}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

#[cfg(test)]
mod tests {
    use super::{RuntimeState, TrayAction};

    #[test]
    fn tray_action_mapping_works_for_known_ids() {
        assert_eq!(TrayAction::from_menu_id("open"), TrayAction::Open);
        assert_eq!(TrayAction::from_menu_id("quick_add"), TrayAction::QuickAdd);
        assert_eq!(TrayAction::from_menu_id("lock"), TrayAction::Lock);
        assert_eq!(TrayAction::from_menu_id("quit"), TrayAction::Quit);
        assert_eq!(TrayAction::from_menu_id("other"), TrayAction::Unknown);
    }

    #[test]
    fn runtime_state_marks_quitting() {
        let state = RuntimeState::new_empty();
        assert!(!state.is_quitting());
        state.mark_quitting();
        assert!(state.is_quitting());
    }
}
