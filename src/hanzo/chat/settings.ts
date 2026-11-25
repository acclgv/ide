/**
 * Hanzo Chat — Auto-Seeded Provider Discovery & Grouped Settings Routing
 *
 * Never replaces or wipes out the chat message list! On startup, probes local
 * OpenAI-compatible & Ollama endpoints (`hanzo-router` `:1235`, `hanzod` `:3690`,
 * `hanzo-engine` `:36900`, `Ollama` `:11434`) and seeds a ready default provider
 * when none is configured yet.
 */

import { invoke } from '@tauri-apps/api/core'
import { tauri } from '../tauri.ts'
import { S } from './state.ts'
import { HANZO_DEFAULT_MODEL, HANZO_OLLAMA_MODEL_PRESETS, HANZO_ZEN_MODEL_PRESETS } from '../theme.ts'

export const PROVIDER_DEFS = [
  { id: 'hanzo',      kind: 'openai',     label: 'Hanzo (Zen)', placeholder: 'hk-...',     url: 'https://api.hanzo.ai/v1',                          models: [...HANZO_ZEN_MODEL_PRESETS] },
  { id: 'anthropic',  kind: 'anthropic',  label: 'Anthropic',   placeholder: 'sk-ant-...', url: 'https://api.anthropic.com',                        models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  { id: 'openai',     kind: 'openai',     label: 'OpenAI',      placeholder: 'sk-...',     url: 'https://api.openai.com/v1',                        models: ['gpt-5.4', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'] },
  { id: 'google',     kind: 'google',     label: 'Google',      placeholder: 'AIza...',    url: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'] },
  { id: 'openrouter', kind: 'openrouter', label: 'OpenRouter',  placeholder: 'sk-or-...',  url: 'https://openrouter.ai/api/v1',                     models: ['anthropic/claude-opus-4', 'google/gemini-2.5-pro', 'qwen/qwen3-235b-a22b', 'deepseek/deepseek-r1'] },
  { id: 'deepseek',   kind: 'deepseek',   label: 'DeepSeek',    placeholder: 'sk-...',     url: 'https://api.deepseek.com',                         models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'ollama',     kind: 'ollama',     label: 'Ollama',      placeholder: '(local)',    url: 'http://localhost:11434',                           models: [...HANZO_OLLAMA_MODEL_PRESETS] },
  { id: 'claudecode', kind: 'claudecode', label: 'Claude Code', placeholder: '(CLI)',      url: '',                                                 models: ['sonnet', 'opus', 'haiku'] },
  { id: 'custom',     kind: 'custom',     label: 'Custom',      placeholder: 'sk-...',     url: '',                                                 models: [] },
]

interface ProbeCandidate {
  id: string
  name: string
  kind: 'openai' | 'ollama'
  baseUrl: string
  probeUrl: string
  fallbackModel: string
}

const LOCAL_PROBES: readonly ProbeCandidate[] = [
  {
    id: 'hanzo-router-local',
    name: 'Hanzo Router (Local)',
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:1235/v1',
    probeUrl: 'http://127.0.0.1:1235/v1/models',
    fallbackModel: HANZO_DEFAULT_MODEL,
  },
  {
    id: 'hanzod-local',
    name: 'Hanzo Node (hanzod)',
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:3690/v1',
    probeUrl: 'http://127.0.0.1:3690/v1/models',
    fallbackModel: HANZO_DEFAULT_MODEL,
  },
  {
    id: 'hanzo-engine-local',
    name: 'Hanzo Engine (Local)',
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:36900/v1',
    probeUrl: 'http://127.0.0.1:36900/v1/models',
    fallbackModel: HANZO_DEFAULT_MODEL,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    kind: 'ollama',
    baseUrl: 'http://localhost:11434',
    probeUrl: 'http://localhost:11434/api/tags',
    fallbackModel: 'qwen3-coder:30b',
  },
] as const

async function probeEndpoint(c: ProbeCandidate): Promise<string[] | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 700)
  try {
    const res = await fetch(c.probeUrl, { signal: ctrl.signal })
    if (!res.ok) return null
    const json = await res.json()
    if (c.kind === 'ollama') {
      const names = Array.isArray(json?.models)
        ? json.models.map((m: any) => String(m?.name || '')).filter(Boolean)
        : []
      return names.length ? names : [c.fallbackModel]
    }
    const ids = Array.isArray(json?.data)
      ? json.data.map((m: any) => String(m?.id || '')).filter(Boolean)
      : []
    return ids.length ? ids : [c.fallbackModel]
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function probeAndAutoSeedProviders(force = false): Promise<void> {
  if (!tauri()) {
    S.needsProviderSetup = false
    return
  }
  try {
    const config = await invoke<any>('engine_get_config')
    const existingProviders: any[] = config?.providers ?? []
    if (!force && existingProviders.length > 0) {
      const hasUsable = existingProviders.some(
        (p: any) => Boolean(p?.api_key) || p?.kind === 'ollama' || p?.kind === 'claudecode' || String(p?.base_url || '').includes('127.0.0.1') || String(p?.base_url || '').includes('localhost'),
      )
      S.needsProviderSetup = !hasUsable
      return
    }

    // Probe local inference daemons in parallel (`:1235`, `:3690`, `:36900`, `:11434`).
    const probed = await Promise.all(
      LOCAL_PROBES.map(async (c) => ({ candidate: c, models: await probeEndpoint(c) })),
    )
    const hit = probed.find((p) => p.models !== null)
    if (hit && hit.models) {
      const defaultModel = hit.models[0] || hit.candidate.fallbackModel
      await invoke('engine_upsert_provider', {
        provider: {
          id: hit.candidate.id,
          name: hit.candidate.name,
          kind: hit.candidate.kind,
          api_key: '',
          base_url: hit.candidate.baseUrl,
          default_model: defaultModel,
          enabled_models: hit.models,
        },
      })
      const latest = await invoke<any>('engine_get_config')
      await invoke('engine_set_config', {
        config: { ...latest, default_provider: hit.candidate.id, default_model: defaultModel },
      })
      S.selectedModel = defaultModel
      S.needsProviderSetup = false
      return
    }

    // Seed Enso + Zen presets so the Model picker always defaults to `enso` out of the box.
    if (existingProviders.length === 0) {
      await invoke('engine_upsert_provider', {
        provider: {
          id: 'hanzo',
          name: 'Hanzo (Zen)',
          kind: 'openai',
          api_key: '',
          base_url: 'https://api.hanzo.ai/v1',
          default_model: HANZO_DEFAULT_MODEL,
          enabled_models: [...HANZO_ZEN_MODEL_PRESETS],
        },
      }).catch(() => {})
      const latest = await invoke<any>('engine_get_config').catch(() => null)
      if (latest && (!latest.default_model || latest.default_model === 'zen6-coder')) {
        await invoke('engine_set_config', {
          config: { ...latest, default_provider: 'hanzo', default_model: HANZO_DEFAULT_MODEL },
        }).catch(() => {})
      }
      S.selectedModel ??= HANZO_DEFAULT_MODEL
    }
    S.needsProviderSetup = true
  } catch {
    S.needsProviderSetup = false
  }
}

export async function checkProviders(): Promise<void> {
  await probeAndAutoSeedProviders(false)
}

/** Opens the unified Hanzo Dev-style grouped Settings modal on Models & Providers. */
export function renderProviderSetup(): void {
  void import('../settings-modal.ts').then(({ openHanzoSettingsModal }) => {
    openHanzoSettingsModal('models')
  })
}
