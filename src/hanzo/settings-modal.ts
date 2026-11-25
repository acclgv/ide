// Shared Hanzo Dev-Style Grouped Settings Modal (`openHanzoSettingsModal`).
//
// Sections:
//   - General
//   - Account & Billing (unified IAM + Balance + Monthly Spend + Token Usage + Hanzo Pay)
//   - Appearance
//   - Models & Providers
//   - Local AI & Node (`hanzo-engine`, `hanzo-router`, `hanzod`, `Ollama`)
//   - Blockchain Console (`hanzo-chain` HIP-1330 Mainnet/Testnet/Devnet/Local RPC)
//   - MCP & Connections
//   - Editor & Workbench ("Open JSON / VS Code Settings" for power users)
//   - Keybindings
//   - About

import './settings-modal.css'
import { invoke } from '@tauri-apps/api/core'
import { emit, tauri } from './tauri.ts'
import {
  HANZO_DEFAULT_KEYBINDINGS,
  detectDesktopPlatform,
  isMacDesktopPlatform,
  readStoredAppearance,
} from './theme.ts'
import { getDockIconMode, setDockIconMode, type DockIconMode } from './dock-icon.ts'
import { getWorkspace } from './ide-context.ts'
import { PROVIDER_DEFS, probeAndAutoSeedProviders } from './chat/settings.ts'
import { S } from './chat/state.ts'
import { loadPrefs, savePrefs } from './chat/prefs.ts'
import { renderAccountAndBillingSection } from './settings-billing.ts'
import { renderBlockchainConsoleSection, renderLocalNodeSection } from './settings-node.ts'

export type HanzoSettingsSectionId =
  | 'general'
  | 'account'
  | 'appearance'
  | 'models'
  | 'local-node'
  | 'blockchain'
  | 'mcp'
  | 'editor'
  | 'keybindings'
  | 'about'

const NAV_ITEMS: Array<{ id: HanzoSettingsSectionId; label: string; icon: string; keywords: string }> = [
  { id: 'general', label: 'General', icon: 'codicon-sliders', keywords: 'approval plan folder startup' },
  { id: 'account', label: 'Account & Billing', icon: 'codicon-account', keywords: 'iam login sign in org usage credits billing pay hanzo.id' },
  { id: 'appearance', label: 'Appearance', icon: 'codicon-color-mode', keywords: 'theme dark light dock icon font' },
  { id: 'models', label: 'Models & Providers', icon: 'codicon-sparkle', keywords: 'zen ollama openai anthropic api key' },
  { id: 'local-node', label: 'Local AI & Node', icon: 'codicon-server-process', keywords: 'local models node hanzod router engine private offline inference' },
  { id: 'blockchain', label: 'Blockchain Console', icon: 'codicon-globe', keywords: 'chain rpc hip-1330 mainnet testnet devnet block height peers explorer' },
  { id: 'mcp', label: 'MCP & Connections', icon: 'codicon-plug', keywords: 'mcp zap server tools local bus' },
  { id: 'editor', label: 'Editor & Workbench', icon: 'codicon-code', keywords: 'vscode json settings font tab minimap' },
  { id: 'keybindings', label: 'Keybindings', icon: 'codicon-keyboard', keywords: 'shortcuts command palette sidebar' },
  { id: 'about', label: 'About', icon: 'codicon-info', keywords: 'version platform engine docs' },
]

async function runVsCodeCommand(commandId: string): Promise<void> {
  try {
    const { StandaloneServices } = await import('@codingame/monaco-vscode-api/services')
    const { ICommandService } = await import(
      '@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands'
    )
    await (StandaloneServices.get(ICommandService) as any)?.executeCommand?.(commandId)
  } catch (e) {
    console.warn('[hanzo-settings] command failed:', commandId, e)
  }
}

function makeRow(titleText: string, descText: string, control?: HTMLElement): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'hz-settings-row'
  const meta = document.createElement('div')
  meta.className = 'hz-settings-meta'
  const t = document.createElement('div')
  t.className = 'hz-settings-title'
  t.textContent = titleText
  const d = document.createElement('div')
  d.className = 'hz-settings-desc'
  d.textContent = descText
  meta.append(t, d)
  row.appendChild(meta)
  if (control) row.appendChild(control)
  return row
}

export function openHanzoSettingsModal(initialSection: HanzoSettingsSectionId = 'general'): void {
  const existing = document.getElementById('hz-settings-backdrop')
  if (existing) existing.remove()

  let activeSection: HanzoSettingsSectionId = initialSection
  let filterQuery = ''

  const backdrop = document.createElement('div')
  backdrop.id = 'hz-settings-backdrop'
  backdrop.className = 'hz-settings-backdrop'

  const shell = document.createElement('div')
  shell.className = 'hz-settings-shell'
  shell.setAttribute('role', 'dialog')
  shell.setAttribute('aria-modal', 'true')
  shell.setAttribute('aria-label', 'Hanzo IDE Settings')

  const close = () => backdrop.remove()

  const sidebar = document.createElement('aside')
  sidebar.className = 'hz-settings-sidebar'

  const brand = document.createElement('div')
  brand.className = 'hz-settings-brand'
  brand.innerHTML = '<img src="/favicon.svg" alt="" /><span>Settings</span>'

  const searchInput = document.createElement('input')
  searchInput.type = 'search'
  searchInput.className = 'hz-settings-search'
  searchInput.placeholder = 'Search settings…'

  const nav = document.createElement('nav')
  nav.className = 'hz-settings-nav'

  const vscodeJsonBtn = document.createElement('button')
  vscodeJsonBtn.type = 'button'
  vscodeJsonBtn.className = 'hz-settings-footer-link'
  vscodeJsonBtn.innerHTML =
    '<span>Open JSON / VS Code Settings</span><span class="codicon codicon-link-external" style="font-size:12px"></span>'
  vscodeJsonBtn.addEventListener('click', () => {
    close()
    void runVsCodeCommand('workbench.action.openSettings2')
  })

  sidebar.append(brand, searchInput, nav, vscodeJsonBtn)

  const main = document.createElement('div')
  main.className = 'hz-settings-main'

  const header = document.createElement('div')
  header.className = 'hz-settings-header'
  const heading = document.createElement('h2')
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'hz-settings-close'
  closeBtn.title = 'Close (Esc)'
  closeBtn.setAttribute('aria-label', 'Close settings')
  closeBtn.innerHTML = '<span class="codicon codicon-close" style="font-size:14px"></span>'
  closeBtn.addEventListener('click', close)
  header.append(heading, closeBtn)

  const body = document.createElement('div')
  body.className = 'hz-settings-body'

  main.append(header, body)
  shell.append(sidebar, main)
  backdrop.appendChild(shell)

  const renderNav = () => {
    nav.innerHTML = ''
    const q = filterQuery.trim().toLowerCase()
    for (const item of NAV_ITEMS) {
      if (q && !`${item.label} ${item.keywords}`.toLowerCase().includes(q)) continue
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'hz-settings-nav-btn'
      btn.setAttribute('aria-selected', String(item.id === activeSection))
      btn.innerHTML = `<span class="codicon ${item.icon}" style="font-size:14px"></span><span>${item.label}</span>`
      btn.addEventListener('click', () => {
        activeSection = item.id
        renderNav()
        void renderBody()
      })
      nav.appendChild(btn)
    }
  }

  searchInput.addEventListener('input', () => {
    filterQuery = searchInput.value
    const q = filterQuery.trim().toLowerCase()
    const match = NAV_ITEMS.find((n) => `${n.label} ${n.keywords}`.toLowerCase().includes(q))
    if (q && match && match.id !== activeSection) {
      activeSection = match.id
    }
    renderNav()
    void renderBody()
  })

  async function renderBody(): Promise<void> {
    const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0]
    heading.textContent = currentNav.label
    body.innerHTML = ''

    if (activeSection === 'account') {
      await renderAccountAndBillingSection(body, close, () => void renderBody())
      return
    }
    if (activeSection === 'local-node') {
      await renderLocalNodeSection(body)
      return
    }
    if (activeSection === 'blockchain') {
      await renderBlockchainConsoleSection(body)
      return
    }

    if (activeSection === 'general') {
      const prefs = loadPrefs()
      const card = document.createElement('div')
      card.className = 'hz-settings-card'

      const approvalSeg = document.createElement('div')
      approvalSeg.className = 'hz-settings-seg'
      for (const m of ['ask', 'auto'] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = m === 'ask' ? 'Ask' : 'Auto'
        b.setAttribute('aria-pressed', String(S.approvalMode === m))
        b.addEventListener('click', () => {
          S.approvalMode = m
          savePrefs({ ...prefs, approvalMode: m })
          S.onModeUpdated?.()
          void renderBody()
        })
        approvalSeg.appendChild(b)
      }
      card.appendChild(
        makeRow(
          'Default tool approval',
          'Choose whether write and shell actions ask for confirmation or run automatically.',
          approvalSeg,
        ),
      )

      const planSeg = document.createElement('div')
      planSeg.className = 'hz-settings-seg'
      for (const p of [false, true]) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = p ? 'Plan first' : 'Direct'
        b.setAttribute('aria-pressed', String(S.planMode === p))
        b.addEventListener('click', () => {
          S.planMode = p
          savePrefs({ ...prefs, planMode: p })
          S.onModeUpdated?.()
          void renderBody()
        })
        planSeg.appendChild(b)
      }
      card.appendChild(
        makeRow('Execution style', 'Start directly or draft a structured step-by-step plan first.', planSeg),
      )

      const openWsBtn = document.createElement('button')
      openWsBtn.type = 'button'
      openWsBtn.className = 'hz-settings-btn'
      openWsBtn.textContent = 'Open Folder…'
      openWsBtn.addEventListener('click', () => {
        close()
        void runVsCodeCommand('hanzo.openFolder')
      })
      card.appendChild(
        makeRow('Project folder', getWorkspace() || 'No folder open', openWsBtn),
      )

      const phoneBtn = document.createElement('button')
      phoneBtn.type = 'button'
      phoneBtn.className = 'hz-settings-btn'
      phoneBtn.textContent = 'Get Hanzo on your phone'
      phoneBtn.addEventListener('click', () => {
        void import('./phone-app-modal.ts').then((m) => m.openPhoneAppModal())
      })
      card.appendChild(
        makeRow(
          'Get Hanzo on your phone',
          'Scan to download Hanzo on iOS or Android and sign in with the same account.',
          phoneBtn,
        ),
      )

      body.appendChild(card)
      return
    }

    if (activeSection === 'appearance') {
      const card = document.createElement('div')
      card.className = 'hz-settings-card'
      const curThemeId = document.documentElement.dataset.hanzoThemeId || readStoredAppearance()

      const themeSeg = document.createElement('div')
      themeSeg.className = 'hz-settings-seg'
      for (const opt of [
        { id: 'zen', label: 'Zen', cmd: 'hanzo.useZenTheme' },
        { id: 'clay', label: 'Clay', cmd: 'hanzo.useClayTheme' },
        { id: 'light', label: 'Zen Light', cmd: 'hanzo.useLightTheme' },
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = opt.label
        b.setAttribute(
          'aria-pressed',
          String(curThemeId === opt.id || (curThemeId === 'dark' && opt.id === 'zen')),
        )
        b.addEventListener('click', async () => {
          await runVsCodeCommand(opt.cmd)
          void renderBody()
        })
        themeSeg.appendChild(b)
      }
      card.appendChild(
        makeRow(
          'Color theme',
          'Zen (#000000 / #090909), Clay (#141418 / #111016), or Zen Light (#ffffff).',
          themeSeg,
        ),
      )

      if (tauri() && isMacDesktopPlatform()) {
        const curDock: DockIconMode = await getDockIconMode().catch(() => 'branded')
        const dockSeg = document.createElement('div')
        dockSeg.className = 'hz-settings-seg'
        for (const dm of ['branded', 'minimal'] as const) {
          const b = document.createElement('button')
          b.type = 'button'
          b.textContent = dm === 'branded' ? 'Branded' : 'Minimal'
          b.setAttribute('aria-pressed', String(curDock === dm))
          b.addEventListener('click', async () => {
            await setDockIconMode(dm).catch(() => {})
            void renderBody()
          })
          dockSeg.appendChild(b)
        }
        card.appendChild(
          makeRow('macOS Dock icon', 'Branded corner H badge or minimal squircle.', dockSeg),
        )
      }

      body.appendChild(card)
      return
    }

    if (activeSection === 'models') {
      const config: any = tauri() ? await invoke<any>('engine_get_config').catch(() => ({})) : {}
      const providers: any[] = config?.providers ?? []
      let selectedDef =
        PROVIDER_DEFS.find((d) => d.id === config?.default_provider) ?? PROVIDER_DEFS[0]

      const detectCard = document.createElement('div')
      detectCard.className = 'hz-settings-card'
      const detectBtn = document.createElement('button')
      detectBtn.type = 'button'
      detectBtn.className = 'hz-settings-btn'
      detectBtn.textContent = 'Auto-Detect Local Engines'
      detectBtn.addEventListener('click', async () => {
        detectBtn.textContent = 'Scanning…'
        await probeAndAutoSeedProviders(true)
        await emit('provider-updated').catch(() => {})
        void renderBody()
      })
      detectCard.appendChild(
        makeRow(
          'Model routing',
          `Active default: ${config?.default_model || 'zen6-coder'} (${config?.default_provider || 'hanzo'})`,
          detectBtn,
        ),
      )
      body.appendChild(detectCard)

      const chipRow = document.createElement('div')
      chipRow.className = 'hz-settings-chips'

      const formCard = document.createElement('div')
      formCard.className = 'hz-settings-card'

      const renderProviderForm = () => {
        chipRow.querySelectorAll('button').forEach((b) => {
          b.setAttribute('aria-selected', String((b as HTMLElement).dataset.pid === selectedDef.id))
        })
        const saved = providers.find((p: any) => p.id === selectedDef.id)
        formCard.innerHTML = ''

        const wrap = document.createElement('div')
        wrap.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:12px'

        const titleEl = document.createElement('div')
        titleEl.className = 'hz-settings-title'
        titleEl.textContent = `${selectedDef.label} configuration`

        const keyInp = document.createElement('input')
        keyInp.type = 'password'
        keyInp.className = 'hz-settings-input'
        keyInp.placeholder = `API Key (${selectedDef.placeholder})`
        keyInp.value = saved?.api_key || ''

        const urlInp = document.createElement('input')
        urlInp.type = 'text'
        urlInp.className = 'hz-settings-input'
        urlInp.placeholder = 'Base URL (https://...)'
        urlInp.value = saved?.base_url || selectedDef.url

        const modelInp = document.createElement('input')
        modelInp.type = 'text'
        modelInp.className = 'hz-settings-input'
        modelInp.placeholder = 'Default model ID (e.g. zen6-coder)'
        modelInp.value = saved?.default_model || selectedDef.models[0] || ''

        const presetRow = document.createElement('div')
        presetRow.className = 'hz-settings-chips'
        for (const m of selectedDef.models) {
          const c = document.createElement('button')
          c.type = 'button'
          c.className = 'hz-settings-chip'
          c.textContent = m
          c.setAttribute('aria-selected', String(modelInp.value === m))
          c.addEventListener('click', () => {
            modelInp.value = m
            presetRow.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', 'false'))
            c.setAttribute('aria-selected', 'true')
          })
          presetRow.appendChild(c)
        }

        const saveRow = document.createElement('div')
        saveRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px'
        const statusMsg = document.createElement('span')
        statusMsg.className = 'hz-settings-desc'

        const saveBtn = document.createElement('button')
        saveBtn.type = 'button'
        saveBtn.className = 'hz-settings-btn hz-settings-btn--primary'
        saveBtn.textContent = 'Save & Set Default'
        saveBtn.addEventListener('click', async () => {
          const model = modelInp.value.trim() || selectedDef.models[0] || 'zen6-coder'
          saveBtn.textContent = 'Saving…'
          try {
            const enabled = Array.from(new Set([...selectedDef.models, model]))
            await invoke('engine_upsert_provider', {
              provider: {
                id: selectedDef.id,
                name: selectedDef.label,
                kind: selectedDef.kind,
                api_key: keyInp.value.trim(),
                base_url: urlInp.value.trim(),
                default_model: model,
                enabled_models: enabled,
              },
            })
            const latest = await invoke<any>('engine_get_config')
            await invoke('engine_set_config', {
              config: { ...latest, default_provider: selectedDef.id, default_model: model },
            })
            S.selectedModel = model
            S.needsProviderSetup = false
            await emit('provider-updated').catch(() => {})
            statusMsg.textContent = `Saved ${selectedDef.label} (${model})`
            saveBtn.textContent = 'Saved ✓'
            setTimeout(() => {
              saveBtn.textContent = 'Save & Set Default'
            }, 1400)
          } catch (e) {
            statusMsg.textContent = String(e)
            saveBtn.textContent = 'Save & Set Default'
          }
        })

        saveRow.append(statusMsg, saveBtn)
        wrap.append(titleEl)
        if (selectedDef.id !== 'claudecode') {
          wrap.append(keyInp, urlInp)
        }
        wrap.append(modelInp)
        if (selectedDef.models.length > 0) wrap.append(presetRow)
        wrap.append(saveRow)
        formCard.appendChild(wrap)
      }

      for (const def of PROVIDER_DEFS) {
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'hz-settings-chip'
        chip.dataset.pid = def.id
        chip.textContent = def.label
        chip.addEventListener('click', () => {
          selectedDef = def
          renderProviderForm()
        })
        chipRow.appendChild(chip)
      }

      renderProviderForm()
      body.append(chipRow, formCard)
      return
    }

    if (activeSection === 'mcp') {
      const card = document.createElement('div')
      card.className = 'hz-settings-card'

      const drawerBtn = document.createElement('button')
      drawerBtn.type = 'button'
      drawerBtn.className = 'hz-settings-btn hz-settings-btn--primary'
      drawerBtn.textContent = 'Open MCP & Tools Drawer'
      drawerBtn.addEventListener('click', () => {
        close()
        void import('./zen-workspace.ts').then((m) => m.toggleZenPanel('integrations'))
      })
      card.appendChild(
        makeRow(
          'Hanzo MCP (HIP-0300)',
          'Auto-discovers ~/.local/bin/hanzo-mcp (fs, exec, code, git, fetch, think, memory, plan, kai, ui).',
          drawerBtn,
        ),
      )

      const runnerBtn = document.createElement('button')
      runnerBtn.type = 'button'
      runnerBtn.className = 'hz-settings-btn'
      runnerBtn.textContent = 'Run Tool…'
      runnerBtn.addEventListener('click', () => {
        close()
        void import('./mcp-drawer.ts').then((m) => m.openMcpToolRunnerModal())
      })
      card.appendChild(
        makeRow(
          'Interactive MCP Tool Runner',
          'Execute any connected HIP-0300 or custom MCP tool directly with live JSON-RPC inspection.',
          runnerBtn,
        ),
      )

      const addSrvBtn = document.createElement('button')
      addSrvBtn.type = 'button'
      addSrvBtn.className = 'hz-settings-btn'
      addSrvBtn.textContent = '+ Add Custom Server'
      addSrvBtn.addEventListener('click', () => {
        close()
        void import('./mcp-drawer.ts').then((m) => m.openAddCustomMcpModal())
      })
      card.appendChild(
        makeRow(
          'Custom MCP Servers',
          'Connect stdio commands or Streamable HTTP / SSE MCP servers with encrypted Vault env.',
          addSrvBtn,
        ),
      )

      card.appendChild(
        makeRow(
          'Local ZAP Bus',
          'Joined automatically so `hanzo` CLI and sibling desktop apps can coordinate with the active editor.',
        ),
      )
      body.appendChild(card)
      return
    }

    if (activeSection === 'editor') {
      const card = document.createElement('div')
      card.className = 'hz-settings-card'

      const uiBtn = document.createElement('button')
      uiBtn.type = 'button'
      uiBtn.className = 'hz-settings-btn'
      uiBtn.textContent = 'Open VS Code Settings UI'
      uiBtn.addEventListener('click', () => {
        close()
        void runVsCodeCommand('workbench.action.openSettings2')
      })
      card.appendChild(
        makeRow(
          'Workbench Settings UI',
          'Full Monaco / VS Code editor, formatter, terminal, and language settings.',
          uiBtn,
        ),
      )

      const jsonBtn = document.createElement('button')
      jsonBtn.type = 'button'
      jsonBtn.className = 'hz-settings-btn hz-settings-btn--primary'
      jsonBtn.textContent = 'Open settings.json'
      jsonBtn.addEventListener('click', () => {
        close()
        void runVsCodeCommand('workbench.action.openSettingsJson')
      })
      card.appendChild(
        makeRow(
          'Raw JSON Configuration',
          'Edit `settings.json` directly for advanced power-user workbench overrides.',
          jsonBtn,
        ),
      )

      body.appendChild(card)
      return
    }

    if (activeSection === 'keybindings') {
      const isMac = isMacDesktopPlatform()
      const card = document.createElement('div')
      card.className = 'hz-settings-card'
      for (const kb of HANZO_DEFAULT_KEYBINDINGS) {
        const badge = document.createElement('span')
        badge.className = 'hz-settings-kbd'
        badge.textContent = isMac ? kb.mac : kb.winLinux
        card.appendChild(makeRow(kb.label, kb.command, badge))
      }
      const allBtn = document.createElement('button')
      allBtn.type = 'button'
      allBtn.className = 'hz-settings-btn'
      allBtn.textContent = 'All Keyboard Shortcuts…'
      allBtn.addEventListener('click', () => {
        close()
        void runVsCodeCommand('workbench.action.openGlobalKeybindings')
      })
      card.appendChild(makeRow('Customize Keybindings', 'Open the full workbench keybinding editor.', allBtn))
      body.appendChild(card)
      return
    }

    const card = document.createElement('div')
    card.className = 'hz-settings-card'
    const docsBtn = document.createElement('button')
    docsBtn.type = 'button'
    docsBtn.className = 'hz-settings-btn'
    docsBtn.textContent = 'GitHub Repository'
    docsBtn.addEventListener('click', () => {
      if (tauri()) void invoke('open_external', { url: 'https://github.com/hanzoai/ide' }).catch(() => {})
      else window.open('https://github.com/hanzoai/ide', '_blank', 'noopener')
    })
    card.appendChild(
      makeRow('Hanzo IDE v0.1.2', `Platform: ${detectDesktopPlatform()} · AI-native Rust + Tauri IDE`, docsBtn),
    )
    body.appendChild(card)
  }

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close()
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', onKey)
      close()
    }
  }
  window.addEventListener('keydown', onKey)

  renderNav()
  void renderBody()
  document.body.appendChild(backdrop)
}
