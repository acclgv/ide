#[derive(serde::Serialize)]
pub struct WslStatus {
    pub available: bool,
    pub distros: Vec<String>,
    pub active_distro: Option<String>,
}

#[tauri::command]
pub fn get_wsl_status() -> WslStatus {
    let active_distro = std::env::var("HANZO_WSL_DISTRO")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut c = std::process::Command::new("wsl.exe");
        c.args(["-l", "-q"]).creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        if let Ok(out) = c.output() {
            if out.status.success() {
                let text = if out.stdout.chunks_exact(2).any(|c| c[1] == 0) {
                    let u16s: Vec<u16> = out
                        .stdout
                        .chunks_exact(2)
                        .map(|c| u16::from_le_bytes([c[0], c[1]]))
                        .collect();
                    String::from_utf16_lossy(&u16s)
                } else {
                    String::from_utf8_lossy(&out.stdout).into_owned()
                };
                let distros: Vec<String> = text
                    .lines()
                    .map(|l| l.trim_matches(|c: char| c.is_whitespace() || c == '\0').to_string())
                    .filter(|l| !l.is_empty() && !l.starts_with("docker-desktop"))
                    .collect();
                return WslStatus {
                    available: !distros.is_empty(),
                    distros,
                    active_distro,
                };
            }
        }
    }

    WslStatus {
        available: false,
        distros: Vec::new(),
        active_distro,
    }
}

#[tauri::command]
pub fn set_wsl_mode(distro: Option<String>) -> Result<Option<String>, String> {
    let cleaned = distro
        .map(|d| d.trim().to_string())
        .filter(|d| !d.is_empty());
    match &cleaned {
        Some(d) => std::env::set_var("HANZO_WSL_DISTRO", d),
        None => std::env::remove_var("HANZO_WSL_DISTRO"),
    }
    Ok(cleaned)
}
