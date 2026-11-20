use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub const CONFIG_FILE_NAME: &str = "dock-icon-mode.json";
pub const MENU_ID_BRANDED: &str = "app.dockIcon.branded";
pub const MENU_ID_MINIMAL: &str = "app.dockIcon.minimal";
pub const EVENT_MODE_CHANGED: &str = "dock-icon-mode-changed";

const ICON_BRANDED_PNG: &[u8] = include_bytes!("../icons/icon-macos.png");
const ICON_MINIMAL_PNG: &[u8] = include_bytes!("../icons/icon-macos-minimal.png");

/// macOS Dock icon presentation mode.
///
/// - `Branded`: Hanzo IDE icon with the subtle corner H badge (`icon-macos.png`).
/// - `Minimal`: Clean Hanzo IDE icon without the corner H badge (`icon-macos-minimal.png`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DockIconMode {
    #[default]
    Branded,
    Minimal,
}

impl DockIconMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Branded => "branded",
            Self::Minimal => "minimal",
        }
    }

    pub const fn icon_bytes(self) -> &'static [u8] {
        match self {
            Self::Branded => ICON_BRANDED_PNG,
            Self::Minimal => ICON_MINIMAL_PNG,
        }
    }
}

impl fmt::Display for DockIconMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for DockIconMode {
    type Err = String;

    fn from_str(raw: &str) -> Result<Self, Self::Err> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "branded" => Ok(Self::Branded),
            "minimal" => Ok(Self::Minimal),
            other => Err(format!(
                "Invalid dock icon mode '{other}'; expected 'branded' or 'minimal'"
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DockIconConfig {
    mode: DockIconMode,
}

/// Keeps handles to the macOS "Dock Icon" submenu check items so their
/// checkmarks stay synchronized when the mode is changed from either the
/// native menu bar or the Settings UI.
pub struct DockIconMenuState {
    items: Mutex<
        Option<(
            tauri::menu::CheckMenuItem<tauri::Wry>,
            tauri::menu::CheckMenuItem<tauri::Wry>,
        )>,
    >,
}

impl DockIconMenuState {
    pub fn new() -> Self {
        Self {
            items: Mutex::new(None),
        }
    }

    pub fn set_items(
        &self,
        branded: tauri::menu::CheckMenuItem<tauri::Wry>,
        minimal: tauri::menu::CheckMenuItem<tauri::Wry>,
    ) {
        if let Ok(mut guard) = self.items.lock() {
            *guard = Some((branded, minimal));
        }
    }

    pub fn sync_checked(&self, mode: DockIconMode) {
        if let Ok(guard) = self.items.lock() {
            if let Some((ref branded, ref minimal)) = *guard {
                let _ = branded.set_checked(mode == DockIconMode::Branded);
                let _ = minimal.set_checked(mode == DockIconMode::Minimal);
            }
        }
    }
}

impl Default for DockIconMenuState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn config_path(config_dir: &Path) -> PathBuf {
    config_dir.join(CONFIG_FILE_NAME)
}

pub fn load_mode_from_path(path: &Path) -> DockIconMode {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return DockIconMode::default();
    };
    if let Ok(cfg) = serde_json::from_str::<DockIconConfig>(&raw) {
        return cfg.mode;
    }
    if let Ok(mode) = serde_json::from_str::<DockIconMode>(&raw) {
        return mode;
    }
    DockIconMode::default()
}

pub fn save_mode_to_path(path: &Path, mode: DockIconMode) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory {}: {e}", parent.display()))?;
    }
    let payload = serde_json::to_string_pretty(&DockIconConfig { mode })
        .map_err(|e| format!("Failed to serialize dock icon config: {e}"))?;
    std::fs::write(path, payload)
        .map_err(|e| format!("Failed to write dock icon config {}: {e}", path.display()))
}

fn app_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| config_path(&dir))
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))
}

pub fn load_mode(app: &tauri::AppHandle) -> DockIconMode {
    match app_config_path(app) {
        Ok(path) => load_mode_from_path(&path),
        Err(e) => {
            log::warn!("[hanzo] could not resolve dock icon config path: {e}");
            DockIconMode::default()
        }
    }
}

pub fn save_mode(app: &tauri::AppHandle, mode: DockIconMode) -> Result<(), String> {
    let path = app_config_path(app)?;
    save_mode_to_path(&path, mode)
}

#[cfg(target_os = "macos")]
fn apply_icon_on_main_thread(
    mode: DockIconMode,
    mtm: objc2::MainThreadMarker,
) -> Result<(), String> {
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let data = NSData::with_bytes(mode.icon_bytes());
    let image = NSImage::initWithData(NSImage::alloc(), &data)
        .ok_or_else(|| format!("Failed to decode {} dock icon PNG", mode.as_str()))?;
    let app = NSApplication::sharedApplication(mtm);
    // SAFETY: Called on the main thread (enforced by MainThreadMarker) with a valid NSImage.
    unsafe {
        app.setApplicationIconImage(Some(&image));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn apply_dock_icon(app: &tauri::AppHandle, mode: DockIconMode) -> Result<(), String> {
    if let Some(mtm) = objc2::MainThreadMarker::new() {
        return apply_icon_on_main_thread(mode, mtm);
    }

    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = match objc2::MainThreadMarker::new() {
            Some(mtm) => apply_icon_on_main_thread(mode, mtm),
            None => Err("MainThreadMarker unavailable inside run_on_main_thread".to_string()),
        };
        let _ = tx.send(result);
    })
    .map_err(|e| format!("Failed to dispatch dock icon update to main thread: {e}"))?;

    rx.recv()
        .map_err(|e| format!("Dock icon main-thread update cancelled: {e}"))?
}

#[cfg(not(target_os = "macos"))]
pub fn apply_dock_icon(_app: &tauri::AppHandle, _mode: DockIconMode) -> Result<(), String> {
    Ok(())
}

pub fn apply_and_persist_mode(
    app: &tauri::AppHandle,
    mode: DockIconMode,
) -> Result<DockIconMode, String> {
    save_mode(app, mode)?;
    apply_dock_icon(app, mode)?;
    if let Some(menu_state) = app.try_state::<DockIconMenuState>() {
        menu_state.sync_checked(mode);
    }
    let _ = app.emit(EVENT_MODE_CHANGED, mode.as_str());
    log::info!("[hanzo] dock icon mode set to {}", mode.as_str());
    Ok(mode)
}

pub fn build_dock_icon_submenu(
    handle: &tauri::AppHandle,
) -> tauri::Result<tauri::menu::Submenu<tauri::Wry>> {
    use tauri::menu::{CheckMenuItem, Submenu};

    let current = load_mode(handle);
    let branded = CheckMenuItem::with_id(
        handle,
        MENU_ID_BRANDED,
        "Branded (H badge)",
        true,
        current == DockIconMode::Branded,
        None::<&str>,
    )?;
    let minimal = CheckMenuItem::with_id(
        handle,
        MENU_ID_MINIMAL,
        "Minimal (No badge)",
        true,
        current == DockIconMode::Minimal,
        None::<&str>,
    )?;

    if let Some(menu_state) = handle.try_state::<DockIconMenuState>() {
        menu_state.set_items(branded.clone(), minimal.clone());
    }

    Submenu::with_items(handle, "Dock Icon", true, &[&branded, &minimal])
}

/// Handle a native menu click if it belongs to the Dock Icon submenu.
/// Returns `true` when handled.
pub fn handle_menu_event(app: &tauri::AppHandle, id: &str) -> bool {
    let mode = match id {
        MENU_ID_BRANDED => DockIconMode::Branded,
        MENU_ID_MINIMAL => DockIconMode::Minimal,
        _ => return false,
    };

    if let Err(e) = apply_and_persist_mode(app, mode) {
        log::warn!("[hanzo] failed to switch dock icon mode to {}: {e}", mode.as_str());
    }
    true
}

#[tauri::command]
pub fn get_dock_icon_mode(app: tauri::AppHandle) -> String {
    load_mode(&app).as_str().to_string()
}

#[tauri::command]
pub fn set_dock_icon_mode(app: tauri::AppHandle, mode: String) -> Result<String, String> {
    let parsed: DockIconMode = mode.parse()?;
    apply_and_persist_mode(&app, parsed)?;
    Ok(parsed.as_str().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "hanzo-ide-dock-icon-test-{label}-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).expect("create temp test dir");
        dir
    }

    #[test]
    fn default_mode_is_branded() {
        assert_eq!(DockIconMode::default(), DockIconMode::Branded);
        assert_eq!(DockIconMode::Branded.as_str(), "branded");
        assert_eq!(DockIconMode::Minimal.as_str(), "minimal");
    }

    #[test]
    fn parse_mode_accepts_branded_and_minimal_case_insensitively() {
        assert_eq!("branded".parse::<DockIconMode>(), Ok(DockIconMode::Branded));
        assert_eq!("minimal".parse::<DockIconMode>(), Ok(DockIconMode::Minimal));
        assert_eq!(
            "  BRANDED \n".parse::<DockIconMode>(),
            Ok(DockIconMode::Branded)
        );
        assert_eq!(
            " Minimal ".parse::<DockIconMode>(),
            Ok(DockIconMode::Minimal)
        );
    }

    #[test]
    fn parse_mode_rejects_unknown_values() {
        assert!("".parse::<DockIconMode>().is_err());
        assert!("classic".parse::<DockIconMode>().is_err());
        assert!("dark".parse::<DockIconMode>().is_err());
    }

    #[test]
    fn embedded_png_assets_are_valid_and_distinct() {
        const PNG_MAGIC: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
        let branded = DockIconMode::Branded.icon_bytes();
        let minimal = DockIconMode::Minimal.icon_bytes();
        assert!(branded.len() > PNG_MAGIC.len());
        assert!(minimal.len() > PNG_MAGIC.len());
        assert_eq!(&branded[..8], PNG_MAGIC);
        assert_eq!(&minimal[..8], PNG_MAGIC);
        assert_ne!(branded, minimal);
    }

    #[test]
    fn persistence_round_trips_and_creates_parent_directories() {
        let root = unique_temp_dir("roundtrip");
        let nested_dir = root.join("nested").join("config");
        let path = config_path(&nested_dir);
        assert_eq!(
            path.file_name().and_then(|s| s.to_str()),
            Some("dock-icon-mode.json")
        );

        // Missing file falls back to default ("branded").
        assert_eq!(load_mode_from_path(&path), DockIconMode::Branded);

        // Save minimal and read back.
        save_mode_to_path(&path, DockIconMode::Minimal).expect("save minimal");
        assert_eq!(load_mode_from_path(&path), DockIconMode::Minimal);

        // Overwrite with branded and read back.
        save_mode_to_path(&path, DockIconMode::Branded).expect("save branded");
        assert_eq!(load_mode_from_path(&path), DockIconMode::Branded);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn persistence_handles_corrupt_or_legacy_json_gracefully() {
        let root = unique_temp_dir("corrupt");
        let path = config_path(&root);

        std::fs::write(&path, "not json at all").expect("write invalid json");
        assert_eq!(load_mode_from_path(&path), DockIconMode::Branded);

        std::fs::write(&path, r#"{"mode":"unknown"}"#).expect("write unknown mode");
        assert_eq!(load_mode_from_path(&path), DockIconMode::Branded);

        // Bare JSON string format is also tolerated.
        std::fs::write(&path, r#""minimal""#).expect("write bare minimal");
        assert_eq!(load_mode_from_path(&path), DockIconMode::Minimal);

        let _ = std::fs::remove_dir_all(&root);
    }
}
