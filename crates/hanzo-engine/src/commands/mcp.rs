// commands/mcp.rs — Tauri IPC commands for MCP server management (Phase E)

use crate::commands::state::EngineState;
use crate::engine::mcp::resolve_hanzo_mcp_binary;
use crate::engine::mcp::types::{McpServerConfig, McpServerStatus, McpServerToolInfo};
use crate::engine::vault::{decrypt_credential, encrypt_credential, get_vault_key};
use tauri::Manager;
use tauri::State;

// ── Config key for persisting the server list ──────────────────────────

const CONFIG_KEY: &str = "mcp_servers";

// ── Local config persistence (was crate::engine::channels in Hanzo AI) ──
// Channels was deleted in Hanzo phase 1; the load/save helpers were just
// thin wrappers around EngineState's SQLite config table, so we inline the
// equivalent here.

fn load_mcp_servers(app_handle: &tauri::AppHandle) -> Result<Vec<McpServerConfig>, String> {
    let state = app_handle
        .try_state::<EngineState>()
        .ok_or_else(|| "Engine not initialized".to_string())?;
    match state.store.get_config(CONFIG_KEY) {
        Ok(Some(json)) => serde_json::from_str(&json)
            .map_err(|e| format!("Parse {} config: {}", CONFIG_KEY, e)),
        _ => Ok(Vec::new()),
    }
}

fn save_mcp_servers(
    app_handle: &tauri::AppHandle,
    servers: &[McpServerConfig],
) -> Result<(), String> {
    let state = app_handle
        .try_state::<EngineState>()
        .ok_or_else(|| "Engine not initialized".to_string())?;
    let json = serde_json::to_string(servers)
        .map_err(|e| format!("Serialize {} config: {}", CONFIG_KEY, e))?;
    state
        .store
        .set_config(CONFIG_KEY, &json)
        .map_err(|e| e.to_string())
}

/// §Security: Encrypt all env values in an MCP config before persisting to DB.
/// Idempotent — values already encrypted (prefixed "aes:") are left untouched.
fn encrypt_config_env(config: &mut McpServerConfig) -> Result<(), String> {
    let vault_key = get_vault_key().map_err(|e| e.to_string())?;
    for val in config.env.values_mut() {
        if !val.starts_with("aes:") && !val.is_empty() {
            *val = encrypt_credential(val, &vault_key).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// §Security: Decrypt all env values in an MCP config after loading from DB.
/// Idempotent — values not prefixed "aes:" are returned as-is (legacy plaintext).
fn decrypt_config_env(config: &mut McpServerConfig) -> Result<(), String> {
    let vault_key = get_vault_key().map_err(|e| e.to_string())?;
    for val in config.env.values_mut() {
        if val.starts_with("aes:") {
            *val = decrypt_credential(val, &vault_key).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Load all configs from DB and decrypt env values.
fn load_and_decrypt(app_handle: &tauri::AppHandle) -> Result<Vec<McpServerConfig>, String> {
    let mut servers = load_mcp_servers(app_handle).unwrap_or_default();
    for s in &mut servers {
        decrypt_config_env(s)?;
    }
    Ok(servers)
}

// ── Read all configured servers ────────────────────────────────────────

#[tauri::command]
pub fn engine_mcp_list_servers(
    app_handle: tauri::AppHandle,
) -> Result<Vec<McpServerConfig>, String> {
    load_and_decrypt(&app_handle)
}

// ── Add or update a server config ──────────────────────────────────────

#[tauri::command]
pub fn engine_mcp_save_server(
    app_handle: tauri::AppHandle,
    mut server: McpServerConfig,
) -> Result<(), String> {
    // §Security: Encrypt env values before persisting to DB
    encrypt_config_env(&mut server)?;

    let mut servers = load_mcp_servers(&app_handle).unwrap_or_default();

    // Replace existing or append new
    if let Some(pos) = servers.iter().position(|s| s.id == server.id) {
        servers[pos] = server;
    } else {
        servers.push(server);
    }

    save_mcp_servers(&app_handle, &servers)
}

// ── Remove a server config ─────────────────────────────────────────────

#[tauri::command]
pub async fn engine_mcp_remove_server(
    app_handle: tauri::AppHandle,
    state: State<'_, EngineState>,
    id: String,
) -> Result<(), String> {
    // Disconnect if running
    {
        let mut reg = state.mcp_registry.lock().await;
        reg.disconnect(&id).await;
    }

    // Remove from persisted config
    let mut servers = load_mcp_servers(&app_handle).unwrap_or_default();
    servers.retain(|s| s.id != id);
    save_mcp_servers(&app_handle, &servers)
}

// ── Connect to a server ────────────────────────────────────────────────

#[tauri::command]
pub async fn engine_mcp_connect(
    app_handle: tauri::AppHandle,
    state: State<'_, EngineState>,
    id: String,
) -> Result<(), String> {
    use crate::engine::mcp::client::McpClient;
    use crate::engine::mcp::registry::McpRegistry;

    let servers = load_and_decrypt(&app_handle)?;
    let config = match servers.into_iter().find(|s| s.id == id) {
        Some(cfg) => {
            if !cfg.enabled {
                return Err(format!("Server '{}' is disabled", id));
            }
            cfg
        }
        None if id == "hanzo" => {
            let ws = state.store.get_config("user_workspace_path").ok().flatten();
            McpRegistry::build_hanzo_config(ws.as_deref())
        }
        None => return Err(format!("Server '{}' not found", id)),
    };

    let client = McpClient::connect(config).await?;
    let mut reg = state.mcp_registry.lock().await;
    reg.insert_connected(client).await;
    Ok(())
}

// ── Disconnect a server ────────────────────────────────────────────────

#[tauri::command]
pub async fn engine_mcp_disconnect(
    state: State<'_, EngineState>,
    id: String,
) -> Result<(), String> {
    let mut reg = state.mcp_registry.lock().await;
    reg.disconnect(&id).await;
    Ok(())
}

// ── Get status of all connected servers ────────────────────────────────

#[tauri::command]
pub async fn engine_mcp_status(
    state: State<'_, EngineState>,
) -> Result<Vec<McpServerStatus>, String> {
    let reg = state.mcp_registry.lock().await;
    Ok(reg.status_list().await)
}

// ── List live tools across all connected MCP servers ───────────────────

#[tauri::command]
pub async fn engine_mcp_list_tools(
    state: State<'_, EngineState>,
) -> Result<Vec<McpServerToolInfo>, String> {
    let reg = state.mcp_registry.lock().await;
    Ok(reg.list_server_tools())
}

// ── Detect installed `hanzo-mcp` (HIP-0300) binary on host ─────────────

#[tauri::command]
pub fn engine_mcp_detect_binary() -> Option<String> {
    resolve_hanzo_mcp_binary()
}

// ── Refresh tool list for a server ─────────────────────────────────────

#[tauri::command]
pub async fn engine_mcp_refresh_tools(
    state: State<'_, EngineState>,
    id: String,
) -> Result<(), String> {
    let mut reg = state.mcp_registry.lock().await;
    reg.refresh_tools(&id).await
}

// ── Connect all enabled servers (called on app startup) ────────────────

pub async fn auto_connect_startup_servers(app_handle: &tauri::AppHandle) -> Result<(), String> {
    use crate::engine::mcp::client::McpClient;
    use crate::engine::mcp::registry::McpRegistry;

    let state = app_handle
        .try_state::<EngineState>()
        .ok_or_else(|| "Engine not initialized".to_string())?;
    let servers = load_and_decrypt(app_handle).unwrap_or_default();
    let workspace = state.store.get_config("user_workspace_path").ok().flatten();

    // 1. Connect Hanzo MCP (HIP-0300) first WITHOUT holding `mcp_registry` lock during handshake
    let hanzo_cfg = McpRegistry::build_hanzo_config(workspace.as_deref());
    match McpClient::connect(hanzo_cfg).await {
        Ok(client) => {
            let count = client.tools.len();
            let mut reg = state.mcp_registry.lock().await;
            reg.insert_connected(client).await;
            log::info!("[mcp] Hanzo HIP-0300 tool server connected ({} tools)", count);
        }
        Err(e) => {
            log::warn!("[mcp] Hanzo tool server unavailable: {}", e);
        }
    }

    // 2. Connect user-configured MCP servers without blocking status queries
    let mut errors = Vec::new();
    for server in servers {
        if !server.enabled || server.id == "hanzo" {
            continue;
        }
        let name = server.name.clone();
        match tokio::time::timeout(std::time::Duration::from_secs(6), McpClient::connect(server)).await {
            Ok(Ok(client)) => {
                let mut reg = state.mcp_registry.lock().await;
                reg.insert_connected(client).await;
            }
            Ok(Err(e)) => {
                log::warn!("[mcp] Failed to connect '{}': {}", name, e);
                errors.push(format!("{}: {}", name, e));
            }
            Err(_) => {
                log::warn!("[mcp] Timed out connecting '{}'", name);
                errors.push(format!("{}: startup connect timeout", name));
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Some MCP servers failed to connect: {}",
            errors.join("; ")
        ))
    }
}

#[tauri::command]
pub async fn engine_mcp_connect_all(
    app_handle: tauri::AppHandle,
    _state: State<'_, EngineState>,
) -> Result<(), String> {
    auto_connect_startup_servers(&app_handle).await
}

// ── Execute a specific MCP tool directly (used by extension adapters) ─────

#[tauri::command]
pub async fn engine_mcp_execute_tool(
    state: State<'_, EngineState>,
    server_id: String,
    tool_name: String,
    arguments: String,
) -> Result<String, String> {
    let args: serde_json::Value =
        serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments JSON: {e}"))?;

    let reg = state.mcp_registry.lock().await;

    // Build the prefixed tool name the registry expects: mcp_{server_id}_{tool_name}
    let prefixed = format!("mcp_{}_{}", server_id, tool_name);
    log::info!("[mcp-exec] Executing tool: {} (prefixed: {})", tool_name, prefixed);

    match reg.execute_tool(&prefixed, &args).await {
        Some(Ok(result)) => {
            log::info!("[mcp-exec] Success: {} bytes", result.len());
            Ok(result)
        }
        Some(Err(e)) => {
            log::warn!("[mcp-exec] Error: {}", e);
            Err(e)
        }
        None => {
            log::warn!("[mcp-exec] Tool not found: {} — available clients: {:?}",
                prefixed, reg.connected_ids());
            Err(format!(
                "Tool not found: {} (server: {})",
                tool_name, server_id
            ))
        }
    }
}
