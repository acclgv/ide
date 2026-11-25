/**
 * Hanzo Chat — Right AI Agent Sidebar & Integrations Drawer (`v0.2.0`)
 *
 * Matches `hanzo-ide.html` + `uploaded_media_1795581530518.png` + `Hanzo Dev`:
 *   - 37px header: `New thread` (thread switcher) + `+` (New thread) + `×` (Close sidebar)
 *   - Empty state: 28×28 `@hanzo/logo` mark + `Build what’s next.` + 3 pill suggestions
 *   - Composer card (`#141414`, `1px solid #262626`, `14px` radius):
 *     borderless textarea + `[+] [zen6-coder ⌄] [Fast ⌄]  ...  [Auto ⌄] [↑]`
 *   - Integrations drawer (toggled from top-right `[Integrations]` toolbar button)
 */

import './styles.css'

import { marked } from 'marked'
import { invoke } from '@tauri-apps/api/core'
import { zenIcon } from '../brand.ts'
import { listen, tauri } from '../tauri.ts'
import { api } from '../cloud.ts'
import { orgHeaders } from '../iam.ts'
import { HANZO_OLLAMA_MODEL_PRESETS, HANZO_ZEN_MODEL_PRESETS, isAllowedModelId } from '../theme.ts'
import {
  buildMcpIntegrationsDrawer,
  openMcpToolRunnerModal,
  refreshMcpRuntimeState,
  subscribeMcpSummary,
} from '../mcp-drawer.ts'
import { closeRightDock, onRightDockModeChange, toggleZenPanel } from '../zen-workspace.ts'
import { S } from './state.ts'
import type { Agent, Session, StoredMessage, ChatMsg } from './types.ts'
import {
  renderMessages,
  renderMessagesFull,
  updateAgentSelect,
  updateSessionSelect,
  updateContextPills,
  renderAttachBar,
  clearPlanProgress,
  openPathInEditor,
  updateStatus,
} from './render.ts'
import { initProgressListener } from './streaming.ts'
import { checkProviders } from './settings.ts'
import { doSend, doAbort, doWhisper, doResume } from './send.ts'
import { loadPrefs, savePrefs } from './prefs.ts'
import { createChatDropdown, type ChatDropdownOption } from './dropdown.ts'
import { installMentionSupport, openMentionOrMcpPicker, pickAndAttach } from './mention.ts'

marked.setOptions({ async: false, breaks: true, gfm: true })

let cachedCatalogModels: string[] = []

async function loadAgents(): Promise<void> {
  if (tauri()) {
    try {
      S.agents = await invoke<Agent[]>('engine_list_all_agents')
    } catch {
      S.agents = []
    }
  }
  updateAgentSelect()
}

export async function loadSessions(): Promise<void> {
  if (tauri()) {
    try {
      const all = await invoke<Session[]>('engine_sessions_list')
      S.sessions = all.filter((s) => s.id !== '__hanzo_completions__')
    } catch {
      S.sessions = []
    }
  }
  updateSessionSelect()
}

async function loadHistory(): Promise<void> {
  if (!S.sessionId) return
  try {
    const stored = await invoke<StoredMessage[]>('engine_chat_history', {
      sessionId: S.sessionId,
      limit: 200,
    })
    S.messages = stored
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        ts: new Date(m.created_at),
        messageId: m.id,
      }))
    renderMessagesFull()
  } catch {
    /* no history yet */
  }
}

async function loadModels(): Promise<void> {
  if (!tauri()) {
    const res = await fetch(`${api}/v1/models`, { headers: orgHeaders() }).catch(() => null)
    const ids: string[] = res?.ok
      ? ((await res.json()).data ?? [])
          .map((m: { id: string }) => m.id)
          .filter((id: string) => isAllowedModelId(id))
      : [...HANZO_ZEN_MODEL_PRESETS]
    cachedCatalogModels = ids.length ? ids : [...HANZO_ZEN_MODEL_PRESETS]
    S.selectedModel ??= cachedCatalogModels.includes('zen6-coder')
      ? 'zen6-coder'
      : cachedCatalogModels[0] ?? 'zen6-coder'
    S.onModelsUpdated?.()
    return
  }
  try {
    const config = await invoke<any>('engine_get_config')
    S.selectedModel = config?.default_model || S.selectedModel || 'zen6-coder'
  } catch {
    S.selectedModel ??= 'zen6-coder'
  }
}

export async function updateModelSelect(): Promise<void> {
  if (!tauri()) {
    S.onModelsUpdated?.()
    return
  }
  try {
    const config = await invoke<any>('engine_get_config')
    const providers: any[] = config?.providers ?? []
    const current = S.selectedModel || 'zen6-coder'

    const models = new Set<string>(['zen6-coder'])
    if (config?.default_model && isAllowedModelId(config.default_model)) {
      models.add(config.default_model)
    }
    for (const p of providers) {
      if (p.default_model && isAllowedModelId(p.default_model)) models.add(p.default_model)
    }
    const PRESETS: Record<string, string[]> = {
      hanzo: [...HANZO_ZEN_MODEL_PRESETS],
      anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      openai: ['gpt-5.4', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
      google: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
      deepseek: ['deepseek-chat', 'deepseek-reasoner'],
      ollama: [...HANZO_OLLAMA_MODEL_PRESETS],
      claudecode: ['sonnet', 'opus', 'haiku'],
    }
    for (const p of providers) {
      const enabled: string[] | undefined = p.enabled_models
      if (enabled && enabled.length > 0) {
        for (const m of enabled) {
          if (isAllowedModelId(m)) models.add(m)
        }
      } else {
        const key = p.id === 'hanzo' ? 'hanzo' : p.kind
        for (const m of PRESETS[key] ?? []) models.add(m)
      }
    }
    for (const m of HANZO_ZEN_MODEL_PRESETS) models.add(m)
    if (current && isAllowedModelId(current)) models.add(current)
    cachedCatalogModels = Array.from(models)
    if (!S.selectedModel) S.selectedModel = 'zen6-coder'
    S.onModelsUpdated?.()
  } catch {
    cachedCatalogModels = [...HANZO_ZEN_MODEL_PRESETS]
    if (!S.selectedModel) S.selectedModel = 'zen6-coder'
    S.onModelsUpdated?.()
  }
}

function getModeValue(): string {
  if (S.planMode) return 'plan'
  return S.approvalMode === 'ask' ? 'ask' : 'auto'
}

export interface Chat {
  actions: HTMLElement
  dispose(): void
}

export function build(container: HTMLElement, opts: { detached?: boolean } = {}): Chat {
  container.classList.add('hanzo-chat-container')

  const prefs = loadPrefs()
  S.approvalMode = prefs.approvalMode
  S.thinkingLevel = prefs.thinkingLevel || 'none'
  S.planMode = prefs.planMode
  S.selectedModel = S.selectedModel || 'zen6-coder'
  const prefsAgentId = prefs.selectedAgentId

  function persistPrefs(): void {
    savePrefs({
      approvalMode: S.approvalMode,
      thinkingLevel: S.thinkingLevel,
      planMode: S.planMode,
      selectedAgentId: S.selectedAgent?.agent_id ?? null,
    })
  }

  // ── 1. Clean 37px Header Row (`New thread   +  ×`) ────────────────────────
  const topBar = document.createElement('div')
  topBar.className = 'hanzo-chat-topbar'

  const topBarMain = document.createElement('div')
  topBarMain.className = 'hanzo-chat-topbar-main'
  const topBarActions = document.createElement('div')
  topBarActions.className = 'hanzo-chat-topbar-actions'

  const integrationsTitleEl = document.createElement('span')
  integrationsTitleEl.className = 'hanzo-chat-integrations-title'
  integrationsTitleEl.textContent = 'MCP & Tools'
  integrationsTitleEl.hidden = true

  const sessionDropdown = createChatDropdown({
    ariaLabel: 'Conversation history',
    title: 'Switch thread',
    variant: 'header',
    placeholderLabel: 'New thread',
    options: [{ value: '', label: 'New thread' }],
    initialValue: S.sessionId ?? '',
    onChange: async (val) => {
      if (S.streaming) await doAbort()
      S.surfaced = false
      S.surfacedRound = 0
      if (S.resumeBtn) S.resumeBtn.style.display = 'none'
      if (val) {
        S.sessionId = val
        S.messages = []
        await loadHistory()
      } else {
        S.sessionId = null
        S.messages = []
        renderMessagesFull()
      }
    },
  })

  const syncSessionsDropdown = () => {
    const optsList: ChatDropdownOption[] = [
      { value: '', label: 'New thread' },
      ...S.sessions.slice(0, 24).map((s) => ({
        value: s.id,
        label: s.title || `Thread ${s.id.slice(0, 8)}`,
      })),
    ]
    sessionDropdown.setOptions(optsList, S.sessionId ?? '')
  }
  S.onSessionsUpdated = syncSessionsDropdown

  const mcpBadgeBtn = document.createElement('button')
  mcpBadgeBtn.type = 'button'
  mcpBadgeBtn.className = 'hanzo-chat-mcp-badge'
  mcpBadgeBtn.title = 'Inspect HIP-0300 MCP servers & IDE tools'
  mcpBadgeBtn.setAttribute('aria-label', 'MCP and IDE tools')
  const mcpBadgeLabel = document.createElement('span')
  mcpBadgeLabel.textContent = 'MCP'
  mcpBadgeBtn.innerHTML = `${zenIcon('integrations', 12)}`
  mcpBadgeBtn.appendChild(mcpBadgeLabel)
  mcpBadgeBtn.addEventListener('click', () => {
    if (opts.detached) openMcpToolRunnerModal()
    else void toggleZenPanel('integrations')
  })

  const backToAgentBtn = document.createElement('button')
  backToAgentBtn.type = 'button'
  backToAgentBtn.className = 'hanzo-chat-mcp-badge'
  backToAgentBtn.title = 'Switch to Agentic Coding Chat'
  backToAgentBtn.textContent = 'Chat ↗'
  backToAgentBtn.hidden = true
  backToAgentBtn.addEventListener('click', () => void toggleZenPanel('right'))

  const unsubscribeMcpSummary = subscribeMcpSummary((summary) => {
    mcpBadgeLabel.textContent =
      summary.mcpToolCount > 0
        ? `${summary.totalTools} tools`
        : `${summary.nativeToolCount} tools`
    mcpBadgeBtn.dataset.live = String(summary.hanzoConnected || summary.connectedServers > 0)
  })
  void refreshMcpRuntimeState()

  topBarMain.append(sessionDropdown.button, mcpBadgeBtn, integrationsTitleEl, backToAgentBtn)

  const newBtn = document.createElement('button')
  newBtn.type = 'button'
  newBtn.className = 'hanzo-chat-icon-button'
  newBtn.title = 'New thread'
  newBtn.setAttribute('aria-label', 'New thread')
  newBtn.innerHTML = zenIcon('plus', 15)
  newBtn.addEventListener('click', async () => {
    if (S.streaming) await doAbort()
    const agentToReset = S.selectedAgent
    S.sessionId = null
    S.completedRounds = 0
    S.streamAccum = ''
    S.surfaced = false
    S.surfacedRound = 0
    S.surfacedSummary = ''
    if (S.resumeBtn) S.resumeBtn.style.display = 'none'
    S.messages = []
    sessionDropdown.setValue('', true)
    clearPlanProgress()
    renderMessagesFull()
    S.textarea?.focus()
    if (agentToReset && tauri()) {
      void invoke('engine_agent_reset', { agentId: agentToReset.agent_id }).catch(() => {})
    }
  })

  const closeSidebarBtn = document.createElement('button')
  closeSidebarBtn.type = 'button'
  closeSidebarBtn.className = 'hanzo-chat-icon-button'
  closeSidebarBtn.title = 'Close sidebar'
  closeSidebarBtn.setAttribute('aria-label', 'Close sidebar')
  closeSidebarBtn.innerHTML = zenIcon('close', 15)
  closeSidebarBtn.hidden = Boolean(opts.detached)
  closeSidebarBtn.addEventListener('click', () => void closeRightDock())

  topBarActions.append(newBtn, closeSidebarBtn)
  topBar.append(topBarMain, topBarActions)
  container.appendChild(topBar)

  // ── 2. Agent Wrap vs MCP & Tools Drawer ───────────────────────────────────
  const agentWrap = document.createElement('div')
  agentWrap.className = 'hanzo-chat-agent-wrap'

  const mcpDrawer = buildMcpIntegrationsDrawer()
  const integrationsPane = mcpDrawer.element

  const unsubscribeDockMode = onRightDockModeChange((mode) => {
    const isIntegrations = !opts.detached && mode === 'integrations'
    agentWrap.hidden = isIntegrations
    agentWrap.style.display = isIntegrations ? 'none' : 'flex'
    integrationsPane.hidden = !isIntegrations
    sessionDropdown.button.hidden = isIntegrations
    mcpBadgeBtn.hidden = isIntegrations
    integrationsTitleEl.hidden = !isIntegrations
    backToAgentBtn.hidden = !isIntegrations
    newBtn.hidden = isIntegrations
    if (isIntegrations) void mcpDrawer.refresh()
  })

  // Status & Tool Activity Indicators
  const statusRow = document.createElement('div')
  statusRow.className = 'hanzo-chat-statusbar'
  const headerStatus = document.createElement('span')
  headerStatus.className = 'hanzo-chat-status'
  headerStatus.setAttribute('role', 'status')
  headerStatus.setAttribute('aria-live', 'polite')
  S.headerStatus = headerStatus
  const tokenDisp = document.createElement('span')
  tokenDisp.className = 'hanzo-chat-token'
  S.tokenDisplay = tokenDisp
  statusRow.append(headerStatus, tokenDisp)
  agentWrap.appendChild(statusRow)

  const toolRow = document.createElement('div')
  toolRow.className = 'hanzo-chat-toolrow'
  toolRow.style.display = 'none'
  toolRow.innerHTML =
    '<span class="codicon codicon-loading codicon-modifier-spin" style="font-size:12px"></span><span class="hanzo-tool-label">Working…</span>'
  S.toolRow = toolRow
  agentWrap.appendChild(toolRow)

  const progressLog = document.createElement('div')
  progressLog.className = 'hanzo-chat-progress'
  progressLog.style.display = 'none'
  S.progressLog = progressLog
  agentWrap.appendChild(progressLog)

  initProgressListener().catch(console.warn)

  // ── 3. Conversation Message Stage ─────────────────────────────────────────
  const messageStage = document.createElement('div')
  messageStage.className = 'hanzo-chat-message-stage'

  const msgList = document.createElement('div')
  msgList.className = 'hanzo-chat-messages'
  msgList.setAttribute('role', 'log')
  msgList.setAttribute('aria-label', 'Chat conversation')
  msgList.setAttribute('aria-live', 'polite')
  msgList.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-fspath]') as HTMLElement | null
    if (target?.dataset.fspath) void openPathInEditor(target.dataset.fspath)
  })
  msgList.addEventListener(
    'wheel',
    (e) => {
      e.stopPropagation()
      msgList.scrollTop += e.deltaY
    },
    { passive: false },
  )

  const scrollLatestBtn = document.createElement('button')
  scrollLatestBtn.type = 'button'
  scrollLatestBtn.className = 'hanzo-chat-scroll-latest'
  scrollLatestBtn.title = 'Jump to latest message'
  scrollLatestBtn.setAttribute('aria-label', 'Jump to latest message')
  scrollLatestBtn.setAttribute('data-visible', 'false')
  scrollLatestBtn.innerHTML = zenIcon('down', 13)
  const updateScrollLatest = () => {
    const distance = msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight
    scrollLatestBtn.setAttribute('data-visible', String(distance > 120))
  }
  msgList.addEventListener('scroll', updateScrollLatest, { passive: true })
  scrollLatestBtn.addEventListener('click', () => {
    msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' })
  })
  const messageObserver = new MutationObserver(updateScrollLatest)
  messageObserver.observe(msgList, { childList: true, subtree: true })

  S.msgList = msgList
  messageStage.append(msgList, scrollLatestBtn)
  agentWrap.appendChild(messageStage)

  // ── 4. Hanzo Dev Composer Card ────────────────────────────────────────────
  const inputArea = document.createElement('div')
  inputArea.className = 'hanzo-chat-input-area'

  const contextBar = document.createElement('div')
  contextBar.className = 'hanzo-chat-context-bar'
  S.contextBar = contextBar

  const attachBar = document.createElement('div')
  attachBar.className = 'hanzo-chat-attachment-bar'
  S.attachmentBar = attachBar

  const inputRow = document.createElement('div')
  inputRow.className = 'hanzo-chat-input-row'

  const textarea = document.createElement('textarea')
  textarea.rows = 1
  textarea.className = 'hanzo-chat-textarea'
  textarea.placeholder = S.planMode
    ? 'Describe what to build… (Plan first)'
    : 'Ask, edit files, or invoke @file /mcp tools…'
  textarea.setAttribute('aria-label', 'Agent message')

  const autoResizeTextarea = () => {
    textarea.style.height = 'auto'
    const next = Math.max(52, Math.min(textarea.scrollHeight, 168))
    textarea.style.height = `${next}px`
  }

  let lastInputTime = 0
  textarea.addEventListener('input', () => {
    lastInputTime = Date.now()
    autoResizeTextarea()
    if (S.sendBtn) S.sendBtn.disabled = textarea.value.trim().length === 0
  })

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      void doSend()
    }
  })

  textarea.addEventListener('focus', () => updateContextPills())
  textarea.addEventListener('blur', () => {
    if (Date.now() - lastInputTime < 2000 && textarea.value.length > 0) {
      requestAnimationFrame(() => textarea.focus())
    }
  })

  textarea.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue
        const reader = new FileReader()
        reader.onload = () => {
          S.attachments.push({
            name: `image-${Date.now()}.png`,
            content: reader.result as string,
            isImage: true,
          })
          renderAttachBar()
        }
        reader.readAsDataURL(blob)
      }
    }
  })

  const cleanupMentions = installMentionSupport(textarea)
  S.textarea = textarea
  inputRow.appendChild(textarea)

  // Whisper row (shown only while streaming)
  const whisperRow = document.createElement('div')
  whisperRow.className = 'hanzo-whisper-row'
  S.whisperRow = whisperRow
  const whisperInput = document.createElement('input')
  whisperInput.type = 'text'
  whisperInput.className = 'hanzo-whisper-input'
  whisperInput.placeholder = 'Steer running agent…'
  whisperInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void doWhisper()
    }
  })
  S.whisperInput = whisperInput
  const whisperBtn = document.createElement('button')
  whisperBtn.type = 'button'
  whisperBtn.className = 'hanzo-whisper-btn'
  whisperBtn.title = 'Inject guidance'
  whisperBtn.innerHTML = zenIcon('send', 12)
  whisperBtn.addEventListener('click', () => void doWhisper())
  whisperRow.append(whisperInput, whisperBtn)

  // Bottom bar inside composer card: [+] [zen6-coder ⌄] [Fast ⌄]   ...   [Auto ⌄] [↑]
  const optionsRow = document.createElement('div')
  optionsRow.className = 'hanzo-chat-options-row'
  const optionsLeft = document.createElement('div')
  optionsLeft.className = 'hanzo-chat-options-left'
  const optionsRight = document.createElement('div')
  optionsRight.className = 'hanzo-chat-options-right'

  const attachBtn = document.createElement('button')
  attachBtn.type = 'button'
  attachBtn.className = 'hanzo-chat-composer-tool'
  attachBtn.title = 'Attach file'
  attachBtn.setAttribute('aria-label', 'Attach file')
  attachBtn.innerHTML = zenIcon('plus', 15)
  attachBtn.addEventListener('click', () => void pickAndAttach(false))

  const mentionBtn = document.createElement('button')
  mentionBtn.type = 'button'
  mentionBtn.className = 'hanzo-chat-composer-tool hanzo-chat-composer-slash'
  mentionBtn.title = 'Mention @file, @git, or invoke /mcp tools'
  mentionBtn.setAttribute('aria-label', 'Mention file or MCP tool')
  mentionBtn.textContent = '/@'
  mentionBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    void openMentionOrMcpPicker(textarea, mentionBtn)
  })

  const modelDropdown = createChatDropdown({
    ariaLabel: 'Model',
    title: 'Select AI model',
    variant: 'pill',
    openDirection: 'up',
    placeholderLabel: 'zen6-coder',
    options: HANZO_ZEN_MODEL_PRESETS.map((m) => ({ value: m, label: m })),
    initialValue: S.selectedModel || 'zen6-coder',
    onChange: async (val) => {
      S.selectedModel = val || 'zen6-coder'
      if (tauri()) {
        try {
          const cfg = await invoke<any>('engine_get_config')
          await invoke('engine_set_config', {
            config: { ...cfg, default_model: S.selectedModel },
          })
        } catch {
          /* ignore */
        }
      }
    },
  })

  S.onModelsUpdated = () => {
    const list = cachedCatalogModels.length ? cachedCatalogModels : [...HANZO_ZEN_MODEL_PRESETS]
    const opts: ChatDropdownOption[] = list.map((m) => ({ value: m, label: m }))
    modelDropdown.setOptions(opts, S.selectedModel || 'zen6-coder')
  }

  const effortDropdown = createChatDropdown({
    ariaLabel: 'Reasoning effort',
    title: 'Reasoning effort',
    variant: 'pill',
    openDirection: 'up',
    options: [
      { value: 'none', label: 'Fast', hint: 'Instant' },
      { value: 'medium', label: 'Medium', hint: 'Balanced' },
      { value: 'high', label: 'High', hint: 'Deep' },
    ],
    initialValue: S.thinkingLevel === 'high' || S.thinkingLevel === 'medium' ? S.thinkingLevel : 'none',
    onChange: (val) => {
      S.thinkingLevel = val
      persistPrefs()
      updateContextPills()
    },
  })

  const modeDropdown = createChatDropdown({
    ariaLabel: 'Agent execution mode',
    title: 'Execution mode (Auto / Ask / Plan)',
    variant: 'pill',
    openDirection: 'up',
    align: 'right',
    options: [
      { value: 'auto', label: 'Auto', hint: 'Autonomous' },
      { value: 'ask', label: 'Ask', hint: 'Confirm writes' },
      { value: 'plan', label: 'Plan', hint: 'Plan first' },
    ],
    initialValue: getModeValue(),
    onChange: (val) => {
      if (val === 'plan') {
        S.planMode = true
      } else {
        S.planMode = false
        S.approvalMode = val === 'ask' ? 'ask' : 'auto'
      }
      if (!S.streaming && S.textarea) {
        S.textarea.placeholder = S.planMode
          ? 'Describe what to build… (Plan first)'
          : 'Ask, edit files, or invoke @file /mcp tools…'
      }
      persistPrefs()
    },
  })

  S.onModeUpdated = () => {
    modeDropdown.setValue(getModeValue(), true)
  }

  optionsLeft.append(attachBtn, mentionBtn, modelDropdown.button, effortDropdown.button)

  const surfaceBtn = document.createElement('button')
  surfaceBtn.type = 'button'
  surfaceBtn.className = 'hanzo-chat-run-button'
  surfaceBtn.style.display = 'none'
  surfaceBtn.title = 'Pause agent and surface findings'
  surfaceBtn.textContent = 'Surface'
  surfaceBtn.addEventListener('click', () => {
    if (S.sessionId) {
      invoke('engine_chat_surface', { sessionId: S.sessionId }).catch(console.warn)
      updateStatus('Surfacing after current tools…')
    }
  })
  S.surfaceBtn = surfaceBtn

  const resumeBtn = document.createElement('button')
  resumeBtn.type = 'button'
  resumeBtn.className = 'hanzo-chat-run-button'
  resumeBtn.style.display = 'none'
  resumeBtn.title = 'Resume paused agent'
  resumeBtn.textContent = 'Resume'
  resumeBtn.addEventListener('click', () => void doResume())
  S.resumeBtn = resumeBtn

  const stopBtn = document.createElement('button')
  stopBtn.type = 'button'
  stopBtn.className = 'hanzo-chat-stop'
  stopBtn.style.display = 'none'
  stopBtn.title = 'Stop generation'
  stopBtn.setAttribute('aria-label', 'Stop generation')
  stopBtn.innerHTML = zenIcon('stop', 12)
  stopBtn.addEventListener('click', () => void doAbort())
  S.stopBtn = stopBtn

  const sendBtn = document.createElement('button')
  sendBtn.type = 'button'
  sendBtn.className = 'hanzo-chat-send'
  sendBtn.title = 'Send (Enter)'
  sendBtn.setAttribute('aria-label', 'Send message')
  sendBtn.disabled = true
  sendBtn.innerHTML = zenIcon('send', 14)
  sendBtn.addEventListener('click', () => void doSend())
  S.sendBtn = sendBtn

  optionsRight.append(modeDropdown.button, surfaceBtn, resumeBtn, stopBtn, sendBtn)
  optionsRow.append(optionsLeft, optionsRight)

  const composer = document.createElement('div')
  composer.className = 'hanzo-chat-composer'
  composer.append(contextBar, attachBar, inputRow, whisperRow, optionsRow)
  inputArea.appendChild(composer)
  agentWrap.appendChild(inputArea)

  container.append(agentWrap, integrationsPane)

  // ── 5. Initial Data Hydration ─────────────────────────────────────────────
  renderMessages()

  checkProviders()
    .then(() => updateModelSelect())
    .catch(() => {})

  loadAgents()
    .then(() => {
      if (prefsAgentId) {
        const saved = S.agents.find((a) => a.agent_id === prefsAgentId)
        if (saved) S.selectedAgent = saved
      }
    })
    .catch(() => {})
  loadSessions().catch(() => {})
  loadModels()
    .then(() => updateModelSelect())
    .catch(() => {})

  listen('provider-updated', () => updateModelSelect())
    .then((unlisten) => {
      S.providerUpdatedUnlisten = unlisten
    })
    .catch(() => {})

  listen('chat-reattach', () => {
    try {
      const raw = localStorage.getItem('hanzo:chat:detached-state')
      if (!raw) return
      const snap = JSON.parse(raw) as {
        messages?: ChatMsg[]
        sessionId?: string | null
        runId?: string | null
        streamAccum?: string
        streaming?: boolean
        selectedAgentId?: string | null
        selectedModel?: string | null
      }
      if (Array.isArray(snap.messages)) S.messages = snap.messages
      if ('sessionId' in snap) S.sessionId = snap.sessionId ?? null
      if ('runId' in snap) S.runId = snap.runId ?? null
      if (typeof snap.streamAccum === 'string') S.streamAccum = snap.streamAccum
      if (typeof snap.streaming === 'boolean') S.streaming = snap.streaming
      if (typeof snap.selectedModel === 'string') S.selectedModel = snap.selectedModel
      if (snap.selectedAgentId) {
        const found = S.agents.find((a) => a.agent_id === snap.selectedAgentId)
        if (found) S.selectedAgent = found
      }
      localStorage.removeItem('hanzo:chat:detached-state')
      syncSessionsDropdown()
      S.onModelsUpdated?.()
      renderMessagesFull()
      if (S.textarea) {
        S.textarea.disabled = false
        S.textarea.placeholder = 'Ask, edit files, or invoke @file /mcp tools…'
      }
      if (S.sendBtn) S.sendBtn.disabled = !S.textarea?.value.trim()
    } catch (e) {
      console.warn('[hanzo-chat] chat-reattach hydration failed:', e)
    }
  })
    .then((unlisten) => {
      S.chatReattachUnlisten = unlisten
    })
    .catch(() => {})

  return {
    actions: topBarActions,
    dispose() {
      unsubscribeDockMode()
      unsubscribeMcpSummary()
      messageObserver.disconnect()
      cleanupMentions()
      sessionDropdown.dispose()
      modelDropdown.dispose()
      effortDropdown.dispose()
      modeDropdown.dispose()
      S.onSessionsUpdated = null
      S.onModelsUpdated = null
      S.onModeUpdated = null
      S.msgList = null
      S.textarea = null
      S.sendBtn = null
      S.stopBtn = null
      S.toolRow = null
      S.streamingBubble = null
      S.headerStatus = null
      S.progressLog = null
      if (S.progressUnlisten) {
        S.progressUnlisten()
        S.progressUnlisten = null
      }
      if (S.providerUpdatedUnlisten) {
        S.providerUpdatedUnlisten()
        S.providerUpdatedUnlisten = null
      }
      if (S.chatReattachUnlisten) {
        S.chatReattachUnlisten()
        S.chatReattachUnlisten = null
      }
      S.tokenDisplay = null
      S.attachmentBar = null
      S.contextBar = null
      S.whisperRow = null
      S.whisperInput = null
      S.surfaceBtn = null
      S.resumeBtn = null
      S.surfaced = false
      S.surfacedRound = 0
      S.attachments = []
      S.checkpoint = null
    },
  }
}
