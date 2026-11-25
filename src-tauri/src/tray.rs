// System Tray & Background `hanzod` Supervisor for Hanzo IDE.
//
// Provides:
//   - Open Hanzo IDE (focuses/restores main window; left-click on tray icon also opens)
//   - Live `hanzod` status (`127.0.0.1:3690`)
//   - Start hanzod (spawns silently with `CREATE_NO_WINDOW = 0x0800_0000` on Windows)
//   - Stop hanzod (stops managed child or local `hanzod` silently with `CREATE_NO_WINDOW`)
//   - Monitor hanzod & Local AI… (opens IDE Settings -> Local AI & Node)
//   - Quit Hanzo IDE

use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_HANZOD_ADDR: &str = "127.0.0.1:3690";

pub struct HanzodTrayState {
    child: Mutex<Option<Child>>,
    status_item: Mutex<Option<MenuItem<tauri::Wry>>>,
}

impl HanzodTrayState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            status_item: Mutex::new(None),
        }
    }
}

impl Default for HanzodTrayState {
    fn default() -> Self {
        Self::new()
    }
}

fn hanzod_addr() -> String {
    std::env::var("HANZOD_HTTP_ADDR")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_HANZOD_ADDR.to_string())
}

pub fn is_hanzod_running() -> bool {
    let addr = hanzod_addr();
    let Ok(mut addrs) = addr.to_socket_addrs() else {
        return false;
    };
    let Some(sock) = addrs.next() else {
        return false;
    };
    TcpStream::connect_timeout(&sock, Duration::from_millis(180)).is_ok()
}

fn discover_hanzod_binary() -> Option<PathBuf> {
    let bin_name = if cfg!(windows) { "hanzod.exe" } else { "hanzod" };
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(explicit) = std::env::var("HANZOD_BIN") {
        let t = explicit.trim();
        if !t.is_empty() {
            candidates.push(PathBuf::from(t));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(bin_name));
            candidates.push(dir.join("binaries").join(bin_name));
        }
    }
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        let home = Path::new(&home);
        candidates.push(home.join(".hanzo").join("bin").join(bin_name));
        candidates.push(home.join(".local").join("bin").join(bin_name));
    }
    if !cfg!(windows) {
        candidates.push(PathBuf::from("/usr/local/bin").join(bin_name));
        candidates.push(PathBuf::from("/opt/homebrew/bin").join(bin_name));
    }
    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            candidates.push(dir.join(bin_name));
        }
    }

    candidates.into_iter().find(|p| p.is_file())
}

fn refresh_tray_status(app: &AppHandle) {
    let addr = hanzod_addr();
    let running = is_hanzod_running();
    let label = if running {
        format!("hanzod: Running ({addr})")
    } else {
        "hanzod: Stopped".to_string()
    };
    if let Some(state) = app.try_state::<HanzodTrayState>() {
        if let Ok(guard) = state.status_item.lock() {
            if let Some(ref item) = *guard {
                let _ = item.set_text(label);
            }
        }
    }
}

pub fn start_hanzod(app: &AppHandle) -> Result<(), String> {
    if is_hanzod_running() {
        refresh_tray_status(app);
        return Ok(());
    }
    let Some(bin) = discover_hanzod_binary() else {
        refresh_tray_status(app);
        return Err("hanzod binary not found in ~/.hanzo/bin or PATH".to_string());
    };

    let mut cmd = Command::new(&bin);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn hanzod ({}): {e}", bin.display()))?;

    if let Some(state) = app.try_state::<HanzodTrayState>() {
        if let Ok(mut guard) = state.child.lock() {
            *guard = Some(child);
        }
    }

    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(80));
        if is_hanzod_running() {
            break;
        }
    }
    refresh_tray_status(app);
    Ok(())
}

pub fn stop_hanzod(app: &AppHandle) {
    if let Some(state) = app.try_state::<HanzodTrayState>() {
        if let Ok(mut guard) = state.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    if is_hanzod_running() {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let mut c = Command::new("taskkill");
            c.args(["/F", "/IM", "hanzod.exe"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .creation_flags(0x0800_0000); // CREATE_NO_WINDOW
            let _ = c.status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("pkill")
                .args(["-x", "hanzod"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        std::thread::sleep(Duration::from_millis(120));
    }

    refresh_tray_status(app);
}

fn reveal_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

pub fn init_system_tray(app: &AppHandle) -> tauri::Result<()> {
    let addr = hanzod_addr();
    let initial_status = if is_hanzod_running() {
        format!("hanzod: Running ({addr})")
    } else {
        "hanzod: Stopped".to_string()
    };

    let open_item = MenuItem::with_id(app, "tray.open", "Open Hanzo IDE", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let status_item = MenuItem::with_id(app, "tray.hanzod.status", initial_status, false, None::<&str>)?;
    let start_item = MenuItem::with_id(app, "tray.hanzod.start", "Start hanzod", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "tray.hanzod.stop", "Stop hanzod", true, None::<&str>)?;
    let monitor_item = MenuItem::with_id(
        app,
        "tray.hanzod.monitor",
        "Monitor hanzod & Local AI…",
        true,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "tray.quit", "Quit Hanzo IDE", true, None::<&str>)?;

    if let Some(state) = app.try_state::<HanzodTrayState>() {
        if let Ok(mut guard) = state.status_item.lock() {
            *guard = Some(status_item.clone());
        }
    }

    let menu = Menu::with_items(
        app,
        &[
            &open_item,
            &sep1,
            &status_item,
            &start_item,
            &stop_item,
            &monitor_item,
            &sep2,
            &quit_item,
        ],
    )?;

    let mut tray_builder = TrayIconBuilder::with_id("hanzo-ide-tray")
        .tooltip("Hanzo IDE")
        .menu(&menu)
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray.open" => {
                refresh_tray_status(app);
                reveal_main_window(app);
            }
            "tray.hanzod.start" => {
                let handle = app.clone();
                std::thread::spawn(move || {
                    if let Err(e) = start_hanzod(&handle) {
                        log::warn!("[hanzo-tray] start_hanzod failed: {e}");
                    }
                });
            }
            "tray.hanzod.stop" => {
                let handle = app.clone();
                std::thread::spawn(move || {
                    stop_hanzod(&handle);
                });
            }
            "tray.hanzod.monitor" => {
                refresh_tray_status(app);
                reveal_main_window(app);
                let _ = app.emit("open-hanzo-settings", "local-node");
            }
            "tray.quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            refresh_tray_status(tray.app_handle());
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if !cfg!(target_os = "macos") {
                    reveal_main_window(tray.app_handle());
                }
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }

    let _ = tray_builder.build(app)?;
    Ok(())
}
