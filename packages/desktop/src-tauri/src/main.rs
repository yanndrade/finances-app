#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsStr;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::mem::{size_of, zeroed};
use std::net::{SocketAddr, TcpStream};
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle, RawHandle};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::HANDLE,
    System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    },
    UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK},
};

const MAIN_WINDOW_LABEL: &str = "main";
const BACKEND_BIND_HOST: &str = "0.0.0.0";
const BACKEND_HEALTH_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 27654;
const BACKEND_BOOTSTRAP_TIMEOUT: Duration = Duration::from_secs(15);
const TRAY_EVENT_QUICK_ADD: &str = "desktop://quick-add";
const TRAY_EVENT_LOCK: &str = "desktop://lock";
const AUTOSTART_ENTRY_NAME: &str = "MeuCofri";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
    backend_process: Mutex<Option<BackendProcess>>,
    is_quitting: AtomicBool,
}

impl RuntimeState {
    fn new(backend_process: BackendProcess) -> Self {
        Self {
            backend_process: Mutex::new(Some(backend_process)),
            is_quitting: AtomicBool::new(false),
        }
    }

    fn new_empty() -> Self {
        Self {
            backend_process: Mutex::new(None),
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
        let mut guard = match self.backend_process.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };

        if let Some(backend_process) = guard.take() {
            backend_process.terminate();
        }
    }
}

struct BackendProcess {
    child: Child,
    startup_log_path: PathBuf,
    #[cfg(target_os = "windows")]
    job: Option<OwnedHandle>,
}

impl BackendProcess {
    fn new(child: Child, startup_log_path: PathBuf) -> Self {
        #[cfg(target_os = "windows")]
        let job = attach_backend_job(&child).ok();

        Self {
            child,
            startup_log_path,
            #[cfg(target_os = "windows")]
            job,
        }
    }

    fn startup_log_path(&self) -> &Path {
        &self.startup_log_path
    }

    fn try_wait(&mut self) -> Result<Option<std::process::ExitStatus>, std::io::Error> {
        self.child.try_wait()
    }

    fn terminate(mut self) {
        #[cfg(target_os = "windows")]
        {
            if let Some(job) = self.job.take() {
                if terminate_job_object(&job).is_ok() {
                    let _ = self.child.wait();
                    return;
                }
            }

            if terminate_process_tree(self.child.id()).is_err() {
                let _ = self.child.kill();
            }
            let _ = self.child.wait();
            return;
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = self.child.kill();
            let _ = self.child.wait();
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
    let app = match tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_main_window(&app);
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name(AUTOSTART_ENTRY_NAME)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_autostart_enabled,
            set_autostart_enabled
        ])
        .setup(|app| {
            if is_backend_ready()? {
                app.manage(RuntimeState::new_empty());
                configure_tray(app)?;
                return Ok(());
            }

            let mut backend_process = spawn_backend_process(&app.handle())?;
            if let Err(error) = wait_for_backend_ready(&mut backend_process) {
                if is_backend_ready()? {
                    backend_process.terminate();
                    app.manage(RuntimeState::new_empty());
                    configure_tray(app)?;
                    return Ok(());
                }
                backend_process.terminate();
                return Err(error);
            }
            app.manage(RuntimeState::new(backend_process));
            configure_tray(app)?;
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
    {
        Ok(app) => app,
        Err(error) => {
            let message = format!("Failed to start MeuCofri desktop shell: {error}");
            show_startup_error_dialog(&message);
            eprintln!("{message}");
            return;
        }
    };

    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Ready) {
            let _ = show_main_window(app_handle);
        }

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

fn spawn_backend_process(app: &AppHandle) -> Result<BackendProcess, Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        let backend_dir = resolve_dev_backend_dir()?;
        let startup_log_path = resolve_backend_startup_log_path(None);
        let startup_log_file = open_startup_log_file(&startup_log_path)?;
        let stdout_log_file = startup_log_file.try_clone()?;
        let mut command = Command::new("uv");
        command
            .arg("run")
            .arg("backend")
            .arg("--host")
            .arg(BACKEND_BIND_HOST)
            .arg("--port")
            .arg(BACKEND_PORT.to_string())
            .current_dir(backend_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::from(stdout_log_file))
            .stderr(Stdio::from(startup_log_file));
        apply_backend_spawn_options(&mut command);
        let child = command.spawn()?;
        return Ok(BackendProcess::new(child, startup_log_path));
    }

    let backend_path = resolve_release_backend_path(app)?;
    let working_dir = backend_path
        .parent()
        .ok_or("backend executable directory is missing")?
        .to_path_buf();
    let backend_data_dir = resolve_release_data_dir(app, &working_dir);
    let startup_log_path = resolve_backend_startup_log_path(Some(&backend_data_dir));
    let startup_log_file = open_startup_log_file(&startup_log_path)?;
    let stdout_log_file = startup_log_file.try_clone()?;
    let certificate_dir = backend_data_dir.join("certs");
    std::fs::create_dir_all(&certificate_dir)?;
    let projection_database_path = backend_data_dir.join("app.db");
    let event_database_path = backend_data_dir.join("events.db");

    let mut command = Command::new(&backend_path);
    command
        .arg("--host")
        .arg(BACKEND_BIND_HOST)
        .arg("--port")
        .arg(BACKEND_PORT.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_log_file))
        .stderr(Stdio::from(startup_log_file))
        .env(
            "FINANCE_APP_DATABASE_PATH",
            projection_database_path.as_os_str(),
        )
        .env(
            "FINANCE_APP_EVENT_DATABASE_PATH",
            event_database_path.as_os_str(),
        )
        .env("FINANCE_APP_CERT_DIR", certificate_dir.as_os_str())
        .current_dir(working_dir);
    apply_backend_spawn_options(&mut command);
    let child = command.spawn()?;
    Ok(BackendProcess::new(child, startup_log_path))
}

fn apply_backend_spawn_options(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

#[cfg(target_os = "windows")]
fn attach_backend_job(child: &Child) -> Result<OwnedHandle, Box<dyn std::error::Error>> {
    unsafe {
        let job_handle = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
        if job_handle.is_null() {
            return Err(std::io::Error::last_os_error().into());
        }

        let job = OwnedHandle::from_raw_handle(job_handle as RawHandle);
        let mut limit_information: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
        limit_information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        let set_result = SetInformationJobObject(
            job.as_raw_handle() as HANDLE,
            JobObjectExtendedLimitInformation,
            (&mut limit_information as *mut JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if set_result == 0 {
            return Err(std::io::Error::last_os_error().into());
        }

        let assign_result = AssignProcessToJobObject(
            job.as_raw_handle() as HANDLE,
            child.as_raw_handle() as HANDLE,
        );
        if assign_result == 0 {
            return Err(std::io::Error::last_os_error().into());
        }

        Ok(job)
    }
}

#[cfg(target_os = "windows")]
fn terminate_job_object(job: &OwnedHandle) -> std::io::Result<()> {
    let result = unsafe { TerminateJobObject(job.as_raw_handle() as HANDLE, 1) };
    if result == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn terminate_process_tree(pid: u32) -> std::io::Result<()> {
    let mut command = Command::new("taskkill");
    command
        .arg("/PID")
        .arg(pid.to_string())
        .arg("/T")
        .arg("/F")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW);

    let status = command.status()?;
    if !status.success() {
        return Err(std::io::Error::other(format!(
            "taskkill failed for pid {pid} with status {status}"
        )));
    }

    Ok(())
}

fn resolve_dev_backend_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let backend_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("backend")
        .canonicalize()?;
    Ok(backend_dir)
}

fn resolve_release_data_dir(app: &AppHandle, working_dir: &Path) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .unwrap_or_else(|_| working_dir.join("finances-data"))
}

fn resolve_release_backend_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let binary_name = if cfg!(target_os = "windows") {
        "backend.exe"
    } else {
        "backend"
    };

    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_candidates = [
            resource_dir.join(binary_name),
            resource_dir.join("bin").join(binary_name),
        ];
        for candidate in bundled_candidates {
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    let current_executable = std::env::current_exe()?;
    if let Some(parent) = current_executable.parent() {
        let local_candidates = [
            parent.join(binary_name),
            parent.join("bin").join(binary_name),
        ];
        for candidate in local_candidates {
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    Err(format!("unable to locate `{binary_name}` sidecar for desktop runtime").into())
}

fn wait_for_backend_ready(
    backend_process: &mut BackendProcess,
) -> Result<(), Box<dyn std::error::Error>> {
    let socket_address = backend_socket_address()?;
    let started_at = Instant::now();

    while started_at.elapsed() < BACKEND_BOOTSTRAP_TIMEOUT {
        if backend_healthcheck(&socket_address) {
            return Ok(());
        }
        if let Some(exit_status) = backend_process.try_wait()? {
            return Err(format!(
                "backend exited before becoming ready (status: {exit_status:?}). Log file: {}",
                backend_process.startup_log_path().display()
            )
            .into());
        }
        thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "backend failed to become ready within timeout. Log file: {}",
        backend_process.startup_log_path().display()
    )
    .into())
}

fn is_backend_ready() -> Result<bool, Box<dyn std::error::Error>> {
    Ok(backend_healthcheck(&backend_socket_address()?))
}

fn backend_socket_address() -> Result<SocketAddr, std::net::AddrParseError> {
    format!("{BACKEND_HEALTH_HOST}:{BACKEND_PORT}").parse()
}

fn resolve_backend_startup_log_path(data_dir: Option<&Path>) -> PathBuf {
    match data_dir {
        Some(path) => path.join("backend-startup.log"),
        None => std::env::temp_dir().join("meucofri-backend-startup.log"),
    }
}

fn open_startup_log_file(path: &Path) -> Result<std::fs::File, std::io::Error> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
}

#[cfg(target_os = "windows")]
fn show_startup_error_dialog(message: &str) {
    let title = "MeuCofri";
    let message_wide: Vec<u16> = OsStr::new(message)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let title_wide: Vec<u16> = OsStr::new(title)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message_wide.as_ptr(),
            title_wide.as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(not(target_os = "windows"))]
fn show_startup_error_dialog(_message: &str) {}

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

    is_backend_health_response_ok(&response)
}

fn is_backend_health_response_ok(response: &str) -> bool {
    (response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200"))
        && (response.contains("\"source\":\"application\"")
            || response.contains("\"source\": \"application\""))
}

#[cfg(test)]
mod tests {
    use super::{is_backend_health_response_ok, RuntimeState, TrayAction};

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

    #[test]
    fn backend_health_response_requires_application_marker() {
        assert!(is_backend_health_response_ok(
            "HTTP/1.1 200 OK\r\n\r\n{\"status\":\"ok\",\"source\":\"application\"}"
        ));
        assert!(!is_backend_health_response_ok(
            "HTTP/1.1 200 OK\r\n\r\n{\"status\":\"ok\"}"
        ));
    }
}
