// Hanzo CLI interop.
//
// The IDE and the `hanzo` CLI share one home at `~/.hanzo`, so signing in
// once with `hanzo auth login` is what makes the IDE ready — there is no
// separate key to paste here.

use std::path::PathBuf;

/// Provider id for the unified Hanzo endpoint.
pub const PROVIDER_ID: &str = "hanzo";

/// The unified Hanzo endpoint. OpenAI-compatible.
pub const BASE_URL: &str = "https://api.hanzo.ai/v1";

/// Default Zen 6 model for coding and agentic work.
pub const DEFAULT_MODEL: &str = "zen6-coder";

/// Embeddings run through the same account, so memory search works from the
/// first launch rather than after a trip to Settings.
pub const EMBEDDING_MODEL: &str = "text-embedding-3-small";
pub const EMBEDDING_DIMS: usize = 1536;

fn config_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".hanzo").join("config.json"))
}

/// The API key `hanzo auth login` wrote, if the CLI is signed in.
pub fn api_key() -> Option<String> {
    let raw = std::fs::read_to_string(config_path()?).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("apiKey")?
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// The default organization `hanzo auth login` wrote, if present.
pub fn org() -> Option<String> {
    let raw = std::fs::read_to_string(config_path()?).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("org")
        .or_else(|| v.get("defaultOrg"))
        .and_then(|o| o.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Whether the CLI is signed in.
pub fn is_signed_in() -> bool {
    api_key().is_some()
}

/// Configure the signed-in Hanzo account as the provider, if there is one and
/// nothing is configured yet.
///
/// This runs at startup rather than behind a command: the window is not
/// involved in knowing which account the machine is signed in to, and a chat
/// with no provider is the same as an IDE that does not work.
///
/// Returns whether it added anything.
pub fn adopt_account(state: &crate::engine::state::EngineState) -> Result<bool, String> {
    let Some(key) = api_key() else {
        log::info!("[cli] not signed in — run `hanzo auth login` to set up the provider");
        return Ok(false);
    };
    let mut changed = false;

    // The chat provider and the embedding provider are configured
    // independently: adopting an account on an install that already had a
    // chat provider still has to leave memory search working.
    let needs_provider = state.config.lock().providers.is_empty();
    if needs_provider {
        let mut cfg = state.config.lock();
        cfg.providers.push(crate::atoms::types::ProviderConfig {
            id: PROVIDER_ID.to_string(),
            kind: crate::atoms::types::ProviderKind::OpenAI,
            api_key: key,
            base_url: Some(BASE_URL.to_string()),
            default_model: Some(DEFAULT_MODEL.to_string()),
            enabled_models: None,
        });
        cfg.default_provider = Some(PROVIDER_ID.to_string());
        cfg.default_model = Some(DEFAULT_MODEL.to_string());
        let json =
            serde_json::to_string(&*cfg).map_err(|e| format!("serialise engine config: {e}"))?;
        state.store.set_config("engine_config", &json)?;
        log::info!("[cli] adopted the signed-in Hanzo account ({PROVIDER_ID}/{DEFAULT_MODEL})");
        changed = true;
    }

    // Memory search needs embeddings, and the account that answers chat
    // answers those too — Provider mode reads the chat provider's endpoint and
    // key rather than asking for a second set.
    //
    // The signal is whether memory settings have ever been saved, not what
    // they hold: the defaults point at a local Ollama that is usually not
    // running, so "already has a model" says nothing about whether embeddings
    // work. Someone who has chosen their own backend has a stored config and
    // is left alone.
    let untouched = state
        .store
        .get_config("memory_config")
        .ok()
        .flatten()
        .is_none();
    if untouched {
        let mut mem = state.memory_config.lock();
        mem.embedding_provider = crate::atoms::types::EmbeddingProvider::Provider;
        mem.embedding_model = EMBEDDING_MODEL.to_string();
        mem.embedding_dims = EMBEDDING_DIMS;
        let json =
            serde_json::to_string(&*mem).map_err(|e| format!("serialise memory config: {e}"))?;
        state.store.set_config("memory_config", &json)?;
        log::info!("[cli] embeddings on {EMBEDDING_MODEL} through the same account");
        changed = true;
    }

    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atoms::types::{ProviderConfig, ProviderKind};
    use crate::engine::state::resolve_provider_for_model;

    #[test]
    fn default_model_is_zen6_and_never_qwen2_or_legacy_zen() {
        assert_eq!(PROVIDER_ID, "hanzo");
        assert_eq!(BASE_URL, "https://api.hanzo.ai/v1");
        assert_eq!(DEFAULT_MODEL, "zen6-coder");
        assert!(!DEFAULT_MODEL.contains("qwen2"));
        assert!(!DEFAULT_MODEL.starts_with("zen4") && !DEFAULT_MODEL.starts_with("zen5"));
    }

    #[test]
    fn zen_models_route_to_hanzo_provider() {
        let providers = vec![ProviderConfig {
            id: PROVIDER_ID.to_string(),
            kind: ProviderKind::OpenAI,
            api_key: "hk-test".to_string(),
            base_url: Some(BASE_URL.to_string()),
            default_model: Some(DEFAULT_MODEL.to_string()),
            enabled_models: None,
        }];
        for sku in ["zen6", "zen6-coder", "zen6-flash", "zen6-max", "zen6-free", "zen-vl", "zen"] {
            let resolved = resolve_provider_for_model(sku, &providers);
            assert_eq!(resolved.as_ref().map(|p| p.id.as_str()), Some("hanzo"), "sku {sku}");
        }
    }
}
