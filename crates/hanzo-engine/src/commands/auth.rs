// Sign-in.
//
// Hanzo IAM is the identity provider and the `hanzo` CLI already speaks its
// OIDC flow, so the IDE drives the CLI rather than carrying an auth
// implementation of its own. One account, one login, one credential on disk.

use crate::engine::cli;
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct Account {
    /// `org/user` as IAM knows it, absent when nobody is signed in.
    pub identity: Option<String>,
    /// Billing org.
    pub org: Option<String>,
    pub signed_in: bool,
}

/// Parse `hanzo auth show`, which prints `identity:` and `org:` lines.
fn parse(out: &str) -> Account {
    let field = |key: &str| {
        out.lines()
            .find_map(|l| l.trim().strip_prefix(key))
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
    };
    let identity = field("identity:");
    // `org: hanzo (billed here)` — the parenthetical is a note, not the name.
    let org = field("org:").map(|o| {
        o.split(" (").next().unwrap_or(&o).trim().to_string()
    });
    Account {
        signed_in: identity.is_some(),
        identity,
        org,
    }
}

fn hanzo(args: &[&str]) -> Result<std::process::Output, String> {
    let mut c = Command::new("hanzo");
    c.args(args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c.output()
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => {
                "the hanzo CLI is not installed — see https://hanzo.sh".to_string()
            }
            _ => format!("could not run the hanzo CLI: {e}"),
        })
}

#[tauri::command]
pub fn auth_status() -> Result<Account, String> {
    let out = hanzo(&["auth", "show"])?;
    // A signed-out CLI exits non-zero but still prints what it knows, so the
    // stdout is worth parsing either way.
    let text = String::from_utf8_lossy(&out.stdout);
    let mut acct = parse(&text);
    // An expired session prints an identity but cannot reach userinfo.
    if !out.status.success() && cli::api_key().is_none() {
        acct.signed_in = false;
    }
    Ok(acct)
}

fn open_url_with_wsl_fallback(url: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut c = Command::new("cmd");
        c.args(["/C", "start", "", url]);
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        let _ = c.spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let is_wsl = std::env::var_os("WSL_DISTRO_NAME").is_some()
            || std::env::var_os("WSL_INTEROP").is_some();
        if is_wsl {
            if Command::new("wslview").arg(url).spawn().is_ok() {
                return;
            }
            if Command::new("cmd.exe")
                .args(["/C", "start", "", url])
                .spawn()
                .is_ok()
            {
                return;
            }
        }
        let _ = Command::new("xdg-open").arg(url).spawn();
    }
}

/// Start the IAM sign-in. The CLI opens the browser and writes the credential
/// to `~/.hanzo` when the user finishes; poll `auth_status` for the result.
/// In WSLg / minimal WSL2 where `xdg-open` may be absent, any printed OAuth URL
/// is forwarded to the Windows host browser via `wslview` / `cmd.exe /c start`.
#[tauri::command]
pub fn auth_login() -> Result<(), String> {
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    let mut cmd = Command::new("hanzo");
    cmd.args(["auth", "login", "--brand", "hanzo"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    #[cfg(target_os = "linux")]
    let is_wsl = std::env::var_os("WSL_DISTRO_NAME").is_some()
        || std::env::var_os("WSL_INTEROP").is_some();
    #[cfg(not(target_os = "linux"))]
    let is_wsl = false;

    match cmd.spawn() {
        Ok(mut child) => {
            if is_wsl {
                let stdout = child.stdout.take();
                let stderr = child.stderr.take();
                std::thread::spawn(move || {
                    let scan = |reader: Box<dyn BufRead + Send>| {
                        for line in reader.lines().map_while(Result::ok) {
                            for token in line.split_whitespace() {
                                if token.starts_with("https://") || token.starts_with("http://") {
                                    open_url_with_wsl_fallback(token);
                                    return;
                                }
                            }
                        }
                    };
                    if let Some(out) = stdout {
                        scan(Box::new(BufReader::new(out)));
                    } else if let Some(err) = stderr {
                        scan(Box::new(BufReader::new(err)));
                    }
                    let _ = child.wait();
                });
            }
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            open_url_with_wsl_fallback("https://hanzo.id/login");
            Err("the hanzo CLI is not installed — opened hanzo.id in browser (install CLI via https://hanzo.sh)".to_string())
        }
        Err(e) => Err(format!("could not start sign-in: {e}")),
    }
}

#[tauri::command]
pub fn auth_logout() -> Result<(), String> {
    let out = hanzo(&["auth", "logout"])?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_identity_and_org() {
        let a = parse("identity: hanzo/a\norg: hanzo (billed here)\n");
        assert_eq!(a.identity.as_deref(), Some("hanzo/a"));
        assert_eq!(a.org.as_deref(), Some("hanzo"));
        assert!(a.signed_in);
    }

    #[test]
    fn signed_out_has_no_identity() {
        let a = parse("Error: userinfo failed (401 Unauthorized)\n");
        assert!(a.identity.is_none());
        assert!(!a.signed_in);
    }

    #[test]
    fn tolerates_a_warning_line_first() {
        let a = parse("warning: could not refresh the hanzo credential\nidentity: hanzo/a\norg: hanzo\n");
        assert_eq!(a.identity.as_deref(), Some("hanzo/a"));
        assert_eq!(a.org.as_deref(), Some("hanzo"));
    }
}
