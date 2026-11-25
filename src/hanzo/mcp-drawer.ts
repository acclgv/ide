/**
 * Hanzo IDE — `[⊞] MCP & Tools` Powerhouse Drawer, Interactive Tool Runner,
 * and Custom MCP Server Registration (`v0.2.0`).
 *
 * Exposes & wires:
 *   1. Auto-discovered `Hanzo MCP (HIP-0300)` (`~/.local/bin/hanzo-mcp` / `~/.hanzo/bin/hanzo-mcp`)
 *      with live connected tool chips (`fs`, `exec`, `code`, `git`, `fetch`, `think`, `memory`, `plan`, ...)
 *   2. Native IDE & Code Intelligence suites (live AST index status + toggleable)
 *   3. Curated 1-click MCP Server Catalog (`hanzod`, GitHub, Playwright, Postgres/SQLite)
 *   4. `+ Add Custom MCP Server` (`engine_mcp_save_server` + `engine_mcp_connect`)
 *   5. Interactive `"Run Tool"` tester modal (`engine_mcp_execute_tool` + native IDE tools)
 */

import './mcp-drawer.css'
import { invoke } from '@tauri-apps/api/core'
import { zenIcon } from './brand.ts'
import { getWorkspace } from './ide-context.ts'
import {
  HANZO_HIP0300_CORE_TOOLS,
  HANZO_MCP_CATALOG_PRESETS,
  HANZO_NATIVE_IDE_CAPABILITIES,
  buildDefaultToolSampleArgs,
  buildMcpServerConfigFromPreset,
  countEnabledNativeTools,
  isHanzoMcpAutoConnectEnabled,
  readNativeCapabilityStates,
  setHanzoMcpAutoConnectEnabled,
  setNativeCapabilityEnabled,
  type McpCatalogPreset,
  type McpServerConfigPayload,
} from './mcp-catalog.ts'
import { tauri } from './tauri.ts'
import { showZenToast, toggleZenPanel } from './zen-workspace.ts'

export interface LiveMcpServerStatus {
  id: string
  name: string
  connected: boolean
  error?: string | null
  tool_count: number
}

export interface LiveMcpToolInfo {
  server_id: string
  server_name: string
  name: string
  prefixed_name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface McpRuntimeSummary {
  connectedServers: number
  mcpToolCount: number
  nativeToolCount: number
  totalTools: number
  hanzoConnected: boolean
  detectedBinary: string | null
  liveTools: LiveMcpToolInfo[]
}

let latestSummary: McpRuntimeSummary = {
  connectedServers: 0,
  mcpToolCount: HANZO_HIP0300_CORE_TOOLS.length,
  nativeToolCount: countEnabledNativeTools(),
  totalTools: HANZO_HIP0300_CORE_TOOLS.length + countEnabledNativeTools(),
  hanzoConnected: false,
  detectedBinary: null,
  liveTools: [],
}

const summaryListeners = new Set<(s: McpRuntimeSummary) => void>()

export function getMcpRuntimeSummary(): McpRuntimeSummary {
  return latestSummary
}

export function subscribeMcpSummary(cb: (s: McpRuntimeSummary) => void): () => void {
  summaryListeners.add(cb)
  cb(latestSummary)
  return () => summaryListeners.delete(cb)
}

function broadcastSummary(next: McpRuntimeSummary): void {
  latestSummary = next
  summaryListeners.forEach((cb) => cb(next))
}

let autoConnectAttempted = false

export async function refreshMcpRuntimeState(): Promise<{
  statuses: LiveMcpServerStatus[]
  savedServers: McpServerConfigPayload[]
  liveTools: LiveMcpToolInfo[]
  detectedBinary: string | null
  astStatusLabel: string
}> {
  const nativeCount = countEnabledNativeTools()
  if (!tauri()) {
    broadcastSummary({
      connectedServers: 1,
      mcpToolCount: HANZO_HIP0300_CORE_TOOLS.length,
      nativeToolCount: nativeCount,
      totalTools: HANZO_HIP0300_CORE_TOOLS.length + nativeCount,
      hanzoConnected: true,
      detectedBinary: '/home/z/.local/bin/hanzo-mcp',
      liveTools: [],
    })
    return {
      statuses: [{ id: 'hanzo', name: 'Hanzo MCP (HIP-0300)', connected: true, tool_count: HANZO_HIP0300_CORE_TOOLS.length }],
      savedServers: [],
      liveTools: [],
      detectedBinary: '/home/z/.local/bin/hanzo-mcp',
      astStatusLabel: 'Ready',
    }
  }

  let detectedBinary: string | null = null
  try {
    detectedBinary = await invoke<string | null>('engine_mcp_detect_binary')
  } catch {
    detectedBinary = null
  }

  let statuses = await invoke<LiveMcpServerStatus[]>('engine_mcp_status').catch(() => [])

  // Auto-connect Hanzo MCP (HIP-0300) if binary is present and user kept auto-connect enabled
  const hanzoEntry = statuses.find((s) => s.id === 'hanzo')
  if (!autoConnectAttempted && detectedBinary && isHanzoMcpAutoConnectEnabled() && !hanzoEntry?.connected) {
    autoConnectAttempted = true
    try {
      const preset = HANZO_MCP_CATALOG_PRESETS[0]
      const cfg = buildMcpServerConfigFromPreset(preset, {
        resolvedBinary: detectedBinary,
        workspacePath: getWorkspace(),
      })
      await invoke('engine_mcp_save_server', { server: cfg })
      await invoke('engine_mcp_connect', { id: 'hanzo' })
      statuses = await invoke<LiveMcpServerStatus[]>('engine_mcp_status').catch(() => statuses)
    } catch (e) {
      console.warn('[hanzo-mcp] auto-connect skipped:', e)
    }
  }

  const savedServers = await invoke<McpServerConfigPayload[]>('engine_mcp_list_servers').catch(() => [])
  const liveTools = await invoke<LiveMcpToolInfo[]>('engine_mcp_list_tools').catch(() => [])

  let astStatusLabel = 'Standby · Open folder to index'
  try {
    const idx = await invoke<any>('get_index_status')
    if (idx?.indexed_files > 0) {
      astStatusLabel = `Indexed ${idx.indexed_files} files · ${idx.symbol_count ?? 0} symbols`
    } else if (getWorkspace()) {
      astStatusLabel = 'Tree-sitter active'
    }
  } catch {
    if (getWorkspace()) astStatusLabel = 'Tree-sitter active'
  }

  const connected = statuses.filter((s) => s.connected)
  const mcpToolCount = connected.reduce((acc, s) => acc + (s.tool_count || 0), 0)
  const hanzoConnected = connected.some((s) => s.id === 'hanzo')

  broadcastSummary({
    connectedServers: connected.length,
    mcpToolCount,
    nativeToolCount: nativeCount,
    totalTools: mcpToolCount + nativeCount,
    hanzoConnected,
    detectedBinary,
    liveTools,
  })

  return { statuses, savedServers, liveTools, detectedBinary, astStatusLabel }
}

export function openMcpToolRunnerModal(initial?: { serverId?: string; toolName?: string }): void {
  document.getElementById('hz-mcp-runner-backdrop')?.remove()

  const backdrop = document.createElement('div')
  backdrop.id = 'hz-mcp-runner-backdrop'
  backdrop.className = 'hz-mcp-modal-backdrop'

  const modal = document.createElement('div')
  modal.className = 'hz-mcp-modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', 'Run MCP or IDE Tool')

  const close = () => backdrop.remove()

  const head = document.createElement('div')
  head.className = 'hz-mcp-modal-head'
  const headTitle = document.createElement('span')
  headTitle.textContent = 'Run Tool · Live MCP & IDE Inspector'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'hanzo-chat-icon-button'
  closeBtn.innerHTML = zenIcon('close', 14)
  closeBtn.addEventListener('click', close)
  head.append(headTitle, closeBtn)

  const body = document.createElement('div')
  body.className = 'hz-mcp-modal-body'

  const srvField = document.createElement('div')
  srvField.className = 'hz-mcp-field'
  srvField.innerHTML = '<label>Target Server</label>'
  const srvSelect = document.createElement('select')
  srvSelect.className = 'hz-mcp-select'
  srvField.appendChild(srvSelect)

  const toolField = document.createElement('div')
  toolField.className = 'hz-mcp-field'
  toolField.innerHTML = '<label>Tool</label>'
  const toolSelect = document.createElement('select')
  toolSelect.className = 'hz-mcp-select'
  const toolDesc = document.createElement('div')
  toolDesc.className = 'hz-mcp-row-sub'
  toolField.append(toolSelect, toolDesc)

  const argsField = document.createElement('div')
  argsField.className = 'hz-mcp-field'
  argsField.innerHTML = '<label>Arguments (JSON)</label>'
  const argsArea = document.createElement('textarea')
  argsArea.className = 'hz-mcp-codearea'
  argsField.appendChild(argsArea)

  const outField = document.createElement('div')
  outField.className = 'hz-mcp-field'
  outField.innerHTML = '<label>Response</label>'
  const outPre = document.createElement('pre')
  outPre.className = 'hz-mcp-output'
  outPre.textContent = 'Ready — click Run Tool below to execute over JSON-RPC / IPC.'
  outField.appendChild(outPre)

  body.append(srvField, toolField, argsField, outField)

  const foot = document.createElement('div')
  foot.className = 'hz-mcp-modal-foot'
  const latencyEl = document.createElement('span')
  latencyEl.className = 'hz-mcp-row-sub'
  const runBtn = document.createElement('button')
  runBtn.type = 'button'
  runBtn.className = 'hz-mcp-btn hz-mcp-btn--primary'
  runBtn.innerHTML = `${zenIcon('play', 11)}<span>Run Tool</span>`
  foot.append(latencyEl, runBtn)

  modal.append(head, body, foot)
  backdrop.appendChild(modal)

  const nativeTools = [
    { name: 'ide_list_dir', desc: 'List files in directory via Rust IDE shell', sample: { path: getWorkspace() || '.' } },
    { name: 'get_index_status', desc: 'Query live tree-sitter AST & semantic index status', sample: {} },
    { name: 'ide_get_git_status', desc: 'Read workspace git status via Rust git engine', sample: { cwd: getWorkspace() || '.' } },
  ]

  const syncTools = (liveTools: LiveMcpToolInfo[]) => {
    const sid = srvSelect.value
    toolSelect.replaceChildren()
    if (sid === '__native__') {
      for (const nt of nativeTools) {
        const o = document.createElement('option')
        o.value = nt.name
        o.textContent = nt.name
        toolSelect.appendChild(o)
      }
    } else {
      const matching = liveTools.filter((t) => t.server_id === sid)
      const list =
        matching.length > 0
          ? matching
          : HANZO_HIP0300_CORE_TOOLS.map((name) => ({
              server_id: sid,
              server_name: 'Hanzo MCP (HIP-0300)',
              name,
              prefixed_name: `mcp_${sid}_${name}`,
              description: `HIP-0300 unified ${name} tool`,
              input_schema: {},
            }))
      for (const t of list) {
        const o = document.createElement('option')
        o.value = t.name
        o.textContent = `${t.name} (${t.prefixed_name})`
        o.dataset.desc = t.description.split('\n')[0] || ''
        toolSelect.appendChild(o)
      }
    }
    if (initial?.toolName && Array.from(toolSelect.options).some((o) => o.value === initial.toolName)) {
      toolSelect.value = initial.toolName
    }
    updateSampleArgs(liveTools)
  }

  const updateSampleArgs = (liveTools: LiveMcpToolInfo[]) => {
    const sid = srvSelect.value
    const tname = toolSelect.value
    if (sid === '__native__') {
      const found = nativeTools.find((n) => n.name === tname)
      toolDesc.textContent = found?.desc ?? ''
      argsArea.value = JSON.stringify(found?.sample ?? {}, null, 2)
      return
    }
    const found = liveTools.find((t) => t.server_id === sid && t.name === tname)
    toolDesc.textContent = (found?.description ?? '').split('\n')[0] || `Execute ${tname} over MCP`
    argsArea.value = buildDefaultToolSampleArgs(tname, getWorkspace())
  }

  void refreshMcpRuntimeState().then(({ statuses, liveTools }) => {
    srvSelect.replaceChildren()
    const connected = statuses.filter((s) => s.connected)
    if (connected.length === 0) {
      const o = document.createElement('option')
      o.value = 'hanzo'
      o.textContent = 'Hanzo MCP (HIP-0300)'
      srvSelect.appendChild(o)
    } else {
      for (const s of connected) {
        const o = document.createElement('option')
        o.value = s.id
        o.textContent = `${s.name} (${s.tool_count} tools)`
        srvSelect.appendChild(o)
      }
    }
    const nativeOpt = document.createElement('option')
    nativeOpt.value = '__native__'
    nativeOpt.textContent = 'Native IDE Shell (Tauri IPC)'
    srvSelect.appendChild(nativeOpt)

    if (initial?.serverId && Array.from(srvSelect.options).some((o) => o.value === initial.serverId)) {
      srvSelect.value = initial.serverId
    }
    syncTools(liveTools)
    srvSelect.addEventListener('change', () => syncTools(liveTools))
    toolSelect.addEventListener('change', () => updateSampleArgs(liveTools))
  })

  runBtn.addEventListener('click', async () => {
    const sid = srvSelect.value
    const tname = toolSelect.value
    const rawArgs = argsArea.value.trim() || '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawArgs)
    } catch (e) {
      outPre.textContent = `Invalid JSON arguments: ${String(e)}`
      return
    }

    runBtn.disabled = true
    outPre.textContent = `Executing ${tname}…`
    const t0 = performance.now()
    try {
      let res: unknown
      if (!tauri()) {
        res = { ok: true, simulated: true, server: sid, tool: tname, args: parsed }
      } else if (sid === '__native__') {
        res = await invoke(tname, parsed)
      } else {
        res = await invoke('engine_mcp_execute_tool', {
          serverId: sid,
          toolName: tname,
          arguments: JSON.stringify(parsed),
        })
      }
      const elapsed = Math.round(performance.now() - t0)
      latencyEl.textContent = `Completed in ${elapsed} ms`
      if (typeof res === 'string') {
        try {
          outPre.textContent = JSON.stringify(JSON.parse(res), null, 2)
        } catch {
          outPre.textContent = res
        }
      } else {
        outPre.textContent = JSON.stringify(res, null, 2)
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0)
      latencyEl.textContent = `Failed after ${elapsed} ms`
      outPre.textContent = `Error: ${String(err)}`
    } finally {
      runBtn.disabled = false
    }
  })

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close()
  })
  document.body.appendChild(backdrop)
}

export function openAddCustomMcpModal(onSaved?: () => void): void {
  document.getElementById('hz-mcp-add-backdrop')?.remove()

  const backdrop = document.createElement('div')
  backdrop.id = 'hz-mcp-add-backdrop'
  backdrop.className = 'hz-mcp-modal-backdrop'

  const modal = document.createElement('div')
  modal.className = 'hz-mcp-modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', 'Add Custom MCP Server')

  const close = () => backdrop.remove()

  const head = document.createElement('div')
  head.className = 'hz-mcp-modal-head'
  head.innerHTML = '<span>Add Custom MCP Server</span>'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'hanzo-chat-icon-button'
  closeBtn.innerHTML = zenIcon('close', 14)
  closeBtn.addEventListener('click', close)
  head.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'hz-mcp-modal-body'

  const nameInp = document.createElement('input')
  nameInp.className = 'hz-mcp-input'
  nameInp.placeholder = 'e.g. Linear MCP or Custom Tool Server'

  const transportSel = document.createElement('select')
  transportSel.className = 'hz-mcp-select'
  transportSel.innerHTML = `
    <option value="stdio">stdio (Local command + args)</option>
    <option value="streamable_http">Streamable HTTP (POST endpoint URL)</option>
    <option value="sse">SSE (Server-Sent Events URL)</option>
  `

  const cmdInp = document.createElement('input')
  cmdInp.className = 'hz-mcp-input'
  cmdInp.placeholder = 'Command (e.g. npx, uvx, hanzo-mcp, /path/to/bin)'

  const argsInp = document.createElement('input')
  argsInp.className = 'hz-mcp-input'
  argsInp.placeholder = 'Arguments (space-separated, e.g. -y @modelcontextprotocol/server-memory)'

  const urlInp = document.createElement('input')
  urlInp.className = 'hz-mcp-input'
  urlInp.placeholder = 'https://mcp.example.com/mcp or http://127.0.0.1:3333/sse'

  const envArea = document.createElement('textarea')
  envArea.className = 'hz-mcp-codearea'
  envArea.style.minHeight = '62px'
  envArea.placeholder = 'Optional KEY=VALUE per line (encrypted in Hanzo Vault)'

  const makeField = (lbl: string, el: HTMLElement) => {
    const wrap = document.createElement('div')
    wrap.className = 'hz-mcp-field'
    const l = document.createElement('label')
    l.textContent = lbl
    wrap.append(l, el)
    return wrap
  }

  const cmdField = makeField('Command', cmdInp)
  const argsField = makeField('Arguments', argsInp)
  const urlField = makeField('Endpoint URL', urlInp)
  urlField.hidden = true

  transportSel.addEventListener('change', () => {
    const isStdio = transportSel.value === 'stdio'
    cmdField.hidden = !isStdio
    argsField.hidden = !isStdio
    urlField.hidden = isStdio
  })

  body.append(
    makeField('Server Name', nameInp),
    makeField('Transport', transportSel),
    cmdField,
    argsField,
    urlField,
    makeField('Environment / Headers (KEY=VALUE)', envArea),
  )

  const foot = document.createElement('div')
  foot.className = 'hz-mcp-modal-foot'
  const statusEl = document.createElement('span')
  statusEl.className = 'hz-mcp-row-sub'
  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'hz-mcp-btn hz-mcp-btn--primary'
  saveBtn.textContent = 'Save & Connect'
  foot.append(statusEl, saveBtn)

  saveBtn.addEventListener('click', async () => {
    const name = nameInp.value.trim()
    if (!name) {
      statusEl.textContent = 'Enter a server name.'
      return
    }
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `mcp-${Date.now()}`
    const transport = transportSel.value as 'stdio' | 'sse' | 'streamable_http'
    const env: Record<string, string> = {}
    for (const line of envArea.value.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    }
    const server: McpServerConfigPayload = {
      id,
      name,
      transport,
      command: transport === 'stdio' ? cmdInp.value.trim() : '',
      args:
        transport === 'stdio'
          ? argsInp.value.trim().split(/\s+/).filter(Boolean)
          : [],
      env,
      url: transport === 'stdio' ? '' : urlInp.value.trim(),
      enabled: true,
    }

    saveBtn.disabled = true
    statusEl.textContent = 'Saving & connecting…'
    try {
      if (tauri()) {
        await invoke('engine_mcp_save_server', { server })
        await invoke('engine_mcp_connect', { id })
      }
      showZenToast(`Connected MCP server: ${name}`)
      close()
      onSaved?.()
    } catch (e) {
      statusEl.textContent = `Saved config; connect error: ${String(e)}`
      saveBtn.disabled = false
      onSaved?.()
    }
  })

  modal.append(head, body, foot)
  backdrop.appendChild(modal)
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close()
  })
  document.body.appendChild(backdrop)
}

export function buildMcpIntegrationsDrawer(): {
  element: HTMLElement
  refresh: () => Promise<void>
} {
  const root = document.createElement('div')
  root.className = 'hz-mcp-drawer'
  root.hidden = true

  const render = async () => {
    const { statuses, savedServers, liveTools, detectedBinary, astStatusLabel } =
      await refreshMcpRuntimeState()
    const summary = getMcpRuntimeSummary()
    const capStates = readNativeCapabilityStates()
    const statusById = new Map(statuses.map((s) => [s.id, s]))

    root.replaceChildren()

    // ── 1. Summary Bar (`HIP-0300 · N tools` + `[▷ Run Tool]` + `[↻]`) ──
    const summaryBar = document.createElement('div')
    summaryBar.className = 'hz-mcp-summary-bar'

    const summaryStatus = document.createElement('div')
    summaryStatus.className = 'hz-mcp-summary-status'
    summaryStatus.innerHTML = `<span class="hz-mcp-dot" data-live="${summary.connectedServers > 0}"></span><span>${
      summary.hanzoConnected
        ? `HIP-0300 Active · ${summary.totalTools} tools`
        : `${summary.nativeToolCount} IDE tools · MCP ready`
    }</span>`

    const summaryActions = document.createElement('div')
    summaryActions.className = 'hz-mcp-summary-actions'

    const runToolBtn = document.createElement('button')
    runToolBtn.type = 'button'
    runToolBtn.className = 'hz-mcp-btn hz-mcp-btn--primary'
    runToolBtn.title = 'Interactive MCP & IDE tool tester'
    runToolBtn.innerHTML = `${zenIcon('play', 10)}<span>Run Tool</span>`
    runToolBtn.addEventListener('click', () => openMcpToolRunnerModal())

    const refreshBtn = document.createElement('button')
    refreshBtn.type = 'button'
    refreshBtn.className = 'hz-mcp-btn'
    refreshBtn.title = 'Refresh MCP servers & tools'
    refreshBtn.innerHTML = zenIcon('refresh', 12)
    refreshBtn.addEventListener('click', () => void render())

    summaryActions.append(runToolBtn, refreshBtn)
    summaryBar.append(summaryStatus, summaryActions)
    root.appendChild(summaryBar)

    // ── 2. Featured Card: `Hanzo MCP · HIP-0300` ─────────────────────────
    const hanzoPreset = HANZO_MCP_CATALOG_PRESETS[0]
    const hanzoLive = statusById.get('hanzo')
    const hero = document.createElement('div')
    hero.className = 'hz-mcp-hero-card'

    const heroTop = document.createElement('div')
    heroTop.className = 'hz-mcp-hero-top'
    const heroMeta = document.createElement('div')
    heroMeta.innerHTML = `
      <div class="hz-mcp-hero-title-row">
        <span class="hz-mcp-dot" data-live="${Boolean(hanzoLive?.connected)}"></span>
        <span class="hz-mcp-hero-title">Hanzo MCP · HIP-0300</span>
        <span class="hz-mcp-badge">${hanzoLive?.connected ? `${hanzoLive.tool_count} live` : 'stdio'}</span>
      </div>
      <div class="hz-mcp-hero-sub">${hanzoPreset.subtitle}</div>
    `

    const heroBtn = document.createElement('button')
    heroBtn.type = 'button'
    heroBtn.className = hanzoLive?.connected ? 'hz-mcp-btn' : 'hz-mcp-btn hz-mcp-btn--primary'
    heroBtn.textContent = hanzoLive?.connected ? 'Connected' : 'Connect'
    heroBtn.addEventListener('click', async () => {
      heroBtn.disabled = true
      try {
        if (hanzoLive?.connected) {
          setHanzoMcpAutoConnectEnabled(false)
          if (tauri()) await invoke('engine_mcp_disconnect', { id: 'hanzo' })
          showZenToast('Disconnected Hanzo MCP')
        } else {
          setHanzoMcpAutoConnectEnabled(true)
          if (tauri()) {
            const cfg = buildMcpServerConfigFromPreset(hanzoPreset, {
              resolvedBinary: detectedBinary,
              workspacePath: getWorkspace(),
            })
            await invoke('engine_mcp_save_server', { server: cfg })
            await invoke('engine_mcp_connect', { id: 'hanzo' })
          }
          showZenToast('Connected Hanzo MCP (HIP-0300)')
        }
      } catch (e) {
        showZenToast(`Hanzo MCP: ${String(e)}`)
      } finally {
        await render()
      }
    })
    heroTop.append(heroMeta, heroBtn)
    hero.appendChild(heroTop)

    const binRow = document.createElement('div')
    binRow.className = 'hz-mcp-bin-path'
    binRow.innerHTML = `<span>${detectedBinary || 'hanzo-mcp (auto-discover on PATH)'}</span>`
    const autoToggle = document.createElement('button')
    autoToggle.type = 'button'
    autoToggle.className = 'hz-mcp-switch'
    autoToggle.title = 'Auto-connect Hanzo MCP on startup'
    autoToggle.setAttribute('role', 'switch')
    autoToggle.setAttribute('aria-checked', String(isHanzoMcpAutoConnectEnabled()))
    autoToggle.addEventListener('click', () => {
      const next = !isHanzoMcpAutoConnectEnabled()
      setHanzoMcpAutoConnectEnabled(next)
      autoToggle.setAttribute('aria-checked', String(next))
      showZenToast(next ? 'Hanzo MCP auto-connect enabled' : 'Hanzo MCP auto-connect paused')
    })
    binRow.appendChild(autoToggle)
    hero.appendChild(binRow)

    const hanzoToolNames =
      liveTools.filter((t) => t.server_id === 'hanzo').map((t) => t.name)
    const displayTools =
      hanzoToolNames.length > 0 ? hanzoToolNames : [...(hanzoPreset.featuredTools ?? HANZO_HIP0300_CORE_TOOLS)]
    const chips = document.createElement('div')
    chips.className = 'hz-mcp-tool-chips'
    for (const toolName of displayTools.slice(0, 12)) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'hz-mcp-tool-chip'
      chip.title = `Test mcp_hanzo_${toolName} in Run Tool inspector`
      chip.textContent = toolName
      chip.addEventListener('click', () =>
        openMcpToolRunnerModal({ serverId: 'hanzo', toolName }),
      )
      chips.appendChild(chip)
    }
    hero.appendChild(chips)
    root.appendChild(hero)

    // ── 3. Native IDE & Code Intelligence Suites (Live + Toggleable) ─────
    const nativeSec = document.createElement('div')
    nativeSec.className = 'hz-mcp-section'
    nativeSec.innerHTML = `<div class="hz-mcp-section-head"><h3>Native IDE & Code Intelligence</h3><span>${HANZO_NATIVE_IDE_CAPABILITIES.length} suites</span></div>`
    const nativeCard = document.createElement('div')
    nativeCard.className = 'hz-mcp-card-list'

    for (const cap of HANZO_NATIVE_IDE_CAPABILITIES) {
      const enabled = capStates[cap.id] !== false
      const row = document.createElement('div')
      row.className = 'hz-mcp-row'

      const iconEl = document.createElement('div')
      iconEl.className = 'hz-mcp-row-icon'
      iconEl.innerHTML = zenIcon(cap.icon, 14)

      const meta = document.createElement('div')
      meta.className = 'hz-mcp-row-meta'
      const sub = cap.id === 'ast' ? astStatusLabel : cap.subtitle
      meta.innerHTML = `
        <div class="hz-mcp-row-title"><span>${cap.name}</span></div>
        <div class="hz-mcp-row-sub">${sub}</div>
        <div class="hz-mcp-row-tools">${cap.tools.join(' · ')}</div>
      `

      if (cap.id === 'browser') {
        const openBrowserBtn = document.createElement('button')
        openBrowserBtn.type = 'button'
        openBrowserBtn.className = 'hz-mcp-btn'
        openBrowserBtn.textContent = 'Preview'
        openBrowserBtn.addEventListener('click', () => void toggleZenPanel('browser'))
        row.append(iconEl, meta, openBrowserBtn)
      } else {
        const sw = document.createElement('button')
        sw.type = 'button'
        sw.className = 'hz-mcp-switch'
        sw.setAttribute('role', 'switch')
        sw.setAttribute('aria-label', `Toggle ${cap.name}`)
        sw.setAttribute('aria-checked', String(enabled))
        sw.addEventListener('click', () => {
          const next = !(readNativeCapabilityStates()[cap.id] !== false)
          setNativeCapabilityEnabled(cap.id, next)
          sw.setAttribute('aria-checked', String(next))
          void refreshMcpRuntimeState()
        })
        row.append(iconEl, meta, sw)
      }
      nativeCard.appendChild(row)
    }
    nativeSec.appendChild(nativeCard)
    root.appendChild(nativeSec)

    // ── 4. Curated 1-Click MCP Server Catalog + User Custom Servers ──────
    const catalogSec = document.createElement('div')
    catalogSec.className = 'hz-mcp-section'
    catalogSec.innerHTML = `<div class="hz-mcp-section-head"><h3>MCP Server Catalog</h3><span>1-Click Connect</span></div>`
    const catalogCard = document.createElement('div')
    catalogCard.className = 'hz-mcp-card-list'

    const renderPresetOrCustomRow = (spec: {
      id: string
      name: string
      subtitle: string
      displaySpec: string
      icon: McpCatalogPreset['icon']
      preset?: McpCatalogPreset
    }) => {
      const st = statusById.get(spec.id)
      const isConnected = Boolean(st?.connected)
      const row = document.createElement('div')
      row.className = 'hz-mcp-row'

      const iconEl = document.createElement('div')
      iconEl.className = 'hz-mcp-row-icon'
      iconEl.innerHTML = zenIcon(spec.icon, 14)

      const meta = document.createElement('div')
      meta.className = 'hz-mcp-row-meta'
      meta.innerHTML = `
        <div class="hz-mcp-row-title">
          <span class="hz-mcp-dot" data-live="${isConnected}"></span>
          <span>${spec.name}</span>
        </div>
        <div class="hz-mcp-row-sub">${isConnected ? `Connected · ${st?.tool_count ?? 0} tools` : spec.subtitle}</div>
        <div class="hz-mcp-row-tools">${spec.displaySpec}</div>
      `

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'hz-mcp-btn'
      btn.textContent = isConnected ? 'Disconnect' : 'Connect'
      btn.addEventListener('click', async () => {
        btn.disabled = true
        btn.textContent = isConnected ? 'Stopping…' : 'Connecting…'
        try {
          if (!tauri()) {
            showZenToast(`Configured ${spec.name}`)
            return
          }
          if (isConnected) {
            await invoke('engine_mcp_disconnect', { id: spec.id })
          } else {
            if (spec.preset) {
              const cfg = buildMcpServerConfigFromPreset(spec.preset, {
                resolvedBinary: detectedBinary,
                workspacePath: getWorkspace(),
              })
              await invoke('engine_mcp_save_server', { server: cfg })
            }
            await invoke('engine_mcp_connect', { id: spec.id })
            showZenToast(`Connected ${spec.name}`)
          }
        } catch (e) {
          showZenToast(`${spec.name}: ${String(e)}`)
        } finally {
          await render()
        }
      })

      row.append(iconEl, meta, btn)
      catalogCard.appendChild(row)
    }

    for (const preset of HANZO_MCP_CATALOG_PRESETS.slice(1)) {
      renderPresetOrCustomRow({
        id: preset.id,
        name: preset.name,
        subtitle: preset.subtitle,
        displaySpec: preset.displaySpec,
        icon: preset.icon,
        preset,
      })
    }

    const presetIds = new Set(HANZO_MCP_CATALOG_PRESETS.map((p) => p.id))
    for (const custom of savedServers) {
      if (presetIds.has(custom.id)) continue
      renderPresetOrCustomRow({
        id: custom.id,
        name: custom.name,
        subtitle: custom.transport === 'stdio' ? 'Custom stdio server' : 'Custom HTTP/SSE server',
        displaySpec: custom.url || `${custom.command} ${(custom.args || []).join(' ')}`.trim(),
        icon: 'integrations',
      })
    }

    catalogSec.appendChild(catalogCard)
    root.appendChild(catalogSec)

    const addCustomBtn = document.createElement('button')
    addCustomBtn.type = 'button'
    addCustomBtn.className = 'hz-mcp-add-btn'
    addCustomBtn.innerHTML = `<span>+ Add Custom MCP Server</span>${zenIcon('plus', 14)}`
    addCustomBtn.addEventListener('click', () => openAddCustomMcpModal(() => void render()))
    root.appendChild(addCustomBtn)
  }

  void render()
  return { element: root, refresh: render }
}
