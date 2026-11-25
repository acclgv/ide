// Unified 40px `#000000` Hanzo Dev / Zen Top Bar, Window Controls & IAM Session.
//
// Mounted directly on `document.body` (`#hanzo-zen-toolbar`) so it NEVER depends
// on VS Code's `.part.titlebar`. Matches `uploaded_media_0_1795583923431.png` 1:1:
//   - Left:   [F-menu] [PanelLeft] [<] [>] (plus project label when folder is open)
//   - Middle: Pure `#000000` empty drag region (`data-tauri-drag-region`)
//   - Right:  [🔍 Search] [🗔 Browser] [>_ Terminal] [⊞ Integrations] [PanelRight] | [— □ ×]

import './account.css'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { zenIcon } from './brand.ts'
import { tauri } from './tauri.ts'
import { activeOrg, session, setActiveOrg, signOut, user } from './iam.ts'
import { getWorkspace } from './ide-context.ts'
import {
  detectDesktopPlatform,
  isMacDesktopPlatform,
  readStoredThemeId,
} from './theme.ts'
import {
  getWorkspacePath,
  openWorkspaceFolderPath,
  pickAndOpenFile,
  pickAndOpenFolder,
} from './workspace.ts'
import {
  execZenCommand,
  formatWorkspaceLabel,
  getZenRecentFolders,
  onZenActiveTargetChange,
  recordZenRecentFolder,
  resetZenDefaultLayout,
  toggleTraditionalActivityBar,
  toggleZenFocusMode,
  toggleZenPanel,
  type ZenPanelKey,
} from './zen-workspace.ts'

interface Account {
  identity: string | null
  org: string | null
  signed_in: boolean
}

let currentAccount: Account = { identity: null, org: null, signed_in: false }

const INTERACTIVE_TITLEBAR_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  'a:not([data-tauri-drag-region])',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="combobox"]',
  '[aria-haspopup]',
  '[contenteditable="true"]',
  '[data-tauri-drag-region="false"]',
  '[data-slot="window-controls"]',
  '[data-slot="desktop-app-menu"]',
  '[data-slot="desktop-app-menu-trigger"]',
  '.hanzo-toolbar-ib',
  '.hanzo-zen-project',
].join(', ')

function getCurrentWindowLabel(): string {
  const w = window as unknown as {
    __TAURI_INTERNALS__?: {
      metadata?: {
        currentWindow?: { label?: string }
        currentWebview?: { windowLabel?: string }
      }
    }
  }
  return (
    w.__TAURI_INTERNALS__?.metadata?.currentWindow?.label ||
    w.__TAURI_INTERNALS__?.metadata?.currentWebview?.windowLabel ||
    'main'
  )
}

function invokeWindowRaw<T = unknown>(
  cmd:
    | 'minimize'
    | 'maximize'
    | 'unmaximize'
    | 'toggle_maximize'
    | 'is_maximized'
    | 'close'
    | 'start_dragging',
): Promise<T | null> {
  const w = window as unknown as {
    __TAURI_INTERNALS__?: {
      invoke?: (c: string, args?: Record<string, unknown>) => Promise<T>
    }
  }
  const label = getCurrentWindowLabel()
  if (w.__TAURI_INTERNALS__?.invoke) {
    return w.__TAURI_INTERNALS__.invoke(`plugin:window|${cmd}`, { label })
  }
  return Promise.resolve(null)
}

async function minimizeDesktopWindow(): Promise<void> {
  if (!tauri()) return
  try {
    await getCurrentWindow().minimize()
  } catch {
    await invokeWindowRaw('minimize').catch(() => {})
  }
}

async function toggleMaximizeDesktopWindow(): Promise<void> {
  if (!tauri()) return
  try {
    await getCurrentWindow().toggleMaximize()
  } catch {
    await invokeWindowRaw('toggle_maximize').catch(() => {})
  }
}

async function isDesktopWindowMaximized(): Promise<boolean> {
  if (!tauri()) return false
  try {
    return await getCurrentWindow().isMaximized()
  } catch {
    const v = await invokeWindowRaw<boolean>('is_maximized').catch(() => false)
    return Boolean(v)
  }
}

export async function closeDesktopWindow(): Promise<void> {
  if (!tauri()) {
    window.close()
    return
  }
  try {
    await getCurrentWindow().close()
  } catch {
    await invokeWindowRaw('close').catch(() => {})
  }
}

function startDesktopWindowDragging(): void {
  if (!tauri()) return
  void invokeWindowRaw('start_dragging').catch(() => {
    try {
      void getCurrentWindow().startDragging()
    } catch {
      /* ignore */
    }
  })
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el && typeof el.closest === 'function' && el.closest(INTERACTIVE_TITLEBAR_SELECTOR))
}

let maximizedSyncInstalled = false
const maximizedSubscribers = new Set<(maximized: boolean) => void>()

function installMaximizedStateSync(): void {
  if (typeof window === 'undefined') return
  const platform = detectDesktopPlatform()
  document.documentElement.dataset.hanzoPlatform = platform
  if (platform === 'linux') {
    document.documentElement.style.removeProperty('background')
    document.documentElement.style.removeProperty('background-color')
    document.body?.style.removeProperty('background')
    document.body?.style.removeProperty('background-color')
  }
  if (maximizedSyncInstalled) return
  maximizedSyncInstalled = true

  const sync = () => {
    void isDesktopWindowMaximized().then((maximized) => {
      if (maximized) {
        document.documentElement.setAttribute('data-maximized', 'true')
      } else {
        document.documentElement.removeAttribute('data-maximized')
      }
      maximizedSubscribers.forEach((cb) => cb(maximized))
    })
  }

  sync()
  window.addEventListener('resize', sync)
}

export function bindFramelessDragRegion(bar: HTMLElement): void {
  if (bar.dataset.hanzoDragBound === 'true') return
  bar.dataset.hanzoDragBound = 'true'

  bar.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0 || isInteractiveTarget(e.target)) return
    if (e.detail && e.detail > 1) return
    startDesktopWindowDragging()
  })

  bar.addEventListener('dblclick', (e: MouseEvent) => {
    if (isInteractiveTarget(e.target)) return
    void toggleMaximizeDesktopWindow().then(() => {
      window.dispatchEvent(new Event('resize'))
    })
  })
}

export function createWindowControlsElement(onCustomClose?: () => void): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'hanzo-window-controls'
  wrap.setAttribute('data-slot', 'window-controls')
  wrap.setAttribute('data-tauri-drag-region', 'false')
  wrap.addEventListener('mousedown', (e) => e.stopPropagation())

  const minBtn = document.createElement('button')
  minBtn.type = 'button'
  minBtn.className = 'hanzo-win-btn'
  minBtn.title = 'Minimize'
  minBtn.setAttribute('aria-label', 'Minimize')
  minBtn.innerHTML = zenIcon('min', 13)
  minBtn.addEventListener('click', () => void minimizeDesktopWindow())

  const maxBtn = document.createElement('button')
  maxBtn.type = 'button'
  maxBtn.className = 'hanzo-win-btn'
  maxBtn.title = 'Maximize'
  maxBtn.setAttribute('aria-label', 'Maximize')
  maxBtn.innerHTML = zenIcon('max', 13)

  const applyMaxIcon = (maximized: boolean) => {
    maxBtn.title = maximized ? 'Restore' : 'Maximize'
    maxBtn.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize')
    maxBtn.innerHTML = maximized ? zenIcon('restore', 13) : zenIcon('max', 13)
  }

  maximizedSubscribers.add(applyMaxIcon)
  void isDesktopWindowMaximized().then(applyMaxIcon)

  maxBtn.addEventListener('click', () => {
    void toggleMaximizeDesktopWindow().then(() => {
      void isDesktopWindowMaximized().then((m) => {
        if (m) document.documentElement.setAttribute('data-maximized', 'true')
        else document.documentElement.removeAttribute('data-maximized')
        maximizedSubscribers.forEach((cb) => cb(m))
      })
    })
  })

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'hanzo-win-btn hanzo-win-btn--close'
  closeBtn.title = 'Close window'
  closeBtn.setAttribute('aria-label', 'Close window')
  closeBtn.innerHTML = zenIcon('close', 13)
  closeBtn.addEventListener('click', () => {
    if (onCustomClose) onCustomClose()
    else void closeDesktopWindow()
  })

  wrap.append(minBtn, maxBtn, closeBtn)
  return wrap
}

async function status(): Promise<Account> {
  if (tauri()) {
    try {
      return await invoke<Account>('auth_status')
    } catch {
      /* fallback */
    }
  }
  if (!session().authenticated) return { identity: null, org: null, signed_in: false }
  const u = await user().catch(() => null)
  return {
    identity: u?.name || u?.email || 'Signed in',
    org: u?.owner ?? null,
    signed_in: true,
  }
}

function openProjectFolderMenu(anchorBtn: HTMLElement): void {
  const existing = document.getElementById('hanzo-project-folder-menu')
  if (existing) {
    existing.remove()
    return
  }

  const menu = document.createElement('div')
  menu.id = 'hanzo-project-folder-menu'
  menu.className = 'hanzo-desktop-menu'
  menu.setAttribute('role', 'menu')
  menu.setAttribute('data-slot', 'desktop-app-menu')

  const rect = anchorBtn.getBoundingClientRect()
  menu.style.top = `${Math.max(40, Math.round(rect.bottom + 4))}px`
  menu.style.left = `${Math.max(8, Math.round(rect.left))}px`

  const closeMenu = () => menu.remove()
  const isMac = isMacDesktopPlatform()

  const addItem = (label: string, kbd: string | undefined, onClick: () => void) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'hanzo-desktop-menu-item'
    btn.setAttribute('role', 'menuitem')
    const s = document.createElement('span')
    s.textContent = label
    btn.appendChild(s)
    if (kbd) {
      const k = document.createElement('span')
      k.className = 'hanzo-desktop-menu-kbd'
      k.textContent = kbd
      btn.appendChild(k)
    }
    btn.addEventListener('click', () => {
      closeMenu()
      onClick()
    })
    menu.appendChild(btn)
  }

  addItem('Open folder…', isMac ? '⌘O' : 'Ctrl K Ctrl O', () => void pickAndOpenFolder())
  addItem('Open file…', isMac ? '⌘O' : 'Ctrl O', () => void pickAndOpenFile())

  const current = getWorkspacePath() ?? getWorkspace()
  const recents = getZenRecentFolders().filter((p) => p !== current)
  if (recents.length > 0) {
    const sep = document.createElement('div')
    sep.className = 'hanzo-desktop-menu-sep'
    menu.appendChild(sep)
    for (const folderPath of recents.slice(0, 6)) {
      addItem(formatWorkspaceLabel(folderPath), undefined, () => {
        recordZenRecentFolder(folderPath)
        openWorkspaceFolderPath(folderPath)
      })
    }
  }

  if (current) {
    const sep = document.createElement('div')
    sep.className = 'hanzo-desktop-menu-sep'
    menu.appendChild(sep)
    addItem('Close folder', undefined, () => {
      history.replaceState(null, '', window.location.pathname)
      window.location.reload()
    })
  }

  const onOutside = (e: MouseEvent) => {
    const t = e.target as Node | null
    if (t && (anchorBtn.contains(t) || menu.contains(t))) return
    document.removeEventListener('mousedown', onOutside)
    closeMenu()
  }
  document.addEventListener('mousedown', onOutside)

  document.body.appendChild(menu)
}

interface DesktopMenuEntry {
  label?: string | (() => string)
  kbd?: string
  separator?: boolean
  action?: () => void
}

function createDesktopMenuButton(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'hanzo-toolbar-ib'
  btn.title = 'Application menu'
  btn.setAttribute('aria-label', 'Application menu')
  btn.setAttribute('aria-haspopup', 'menu')
  btn.setAttribute('aria-expanded', 'false')
  btn.setAttribute('data-slot', 'desktop-app-menu-trigger')
  btn.setAttribute('data-tauri-drag-region', 'false')
  btn.innerHTML = zenIcon('menu', 16)
  btn.addEventListener('mousedown', (e) => e.stopPropagation())

  let menuEl = document.getElementById('hanzo-desktop-app-menu') as HTMLDivElement | null
  if (!menuEl) {
    menuEl = document.createElement('div')
    menuEl.id = 'hanzo-desktop-app-menu'
    menuEl.className = 'hanzo-desktop-menu'
    menuEl.setAttribute('role', 'menu')
    menuEl.setAttribute('aria-label', 'Hanzo IDE menu')
    menuEl.setAttribute('data-slot', 'desktop-app-menu')
    menuEl.setAttribute('data-tauri-drag-region', 'false')
    menuEl.hidden = true
    document.body.appendChild(menuEl)
  }

  const isMac = isMacDesktopPlatform()
  const entries: DesktopMenuEntry[] = [
    {
      label: 'New file',
      kbd: isMac ? '⌘N' : 'Ctrl N',
      action: () => void execZenCommand('workbench.action.files.newUntitledFile'),
    },
    {
      label: 'Open file…',
      kbd: isMac ? '⌘O' : 'Ctrl O',
      action: () => void pickAndOpenFile(),
    },
    {
      label: 'Open folder…',
      kbd: isMac ? '⇧⌘O' : 'Ctrl K Ctrl O',
      action: () => void pickAndOpenFolder(),
    },
    {
      label: 'Command palette…',
      kbd: isMac ? '⌘K' : 'Ctrl K',
      action: () => void execZenCommand('workbench.action.showCommands'),
    },
    { separator: true },
    {
      label: () => {
        const id = readStoredThemeId()
        const name = id === 'clay' ? 'Clay' : id === 'light' ? 'Zen Light' : 'Zen'
        return `Appearance: ${name}`
      },
      action: () => void execZenCommand('hanzo.cycleTheme'),
    },
    {
      label: 'Focus mode',
      kbd: 'Esc',
      action: () => toggleZenFocusMode(),
    },
    {
      label: 'Toggle Traditional Activity Bar',
      action: () => void toggleTraditionalActivityBar(),
    },
    { separator: true },
    {
      label: 'Local AI & Hanzo Node…',
      action: () => {
        void import('./settings-modal.ts').then((m) => m.openHanzoSettingsModal('local-node'))
      },
    },
    {
      label: () =>
        currentAccount.signed_in
          ? `Account & Usage (${currentAccount.identity ?? 'Signed in'})`
          : 'Sign in / Account…',
      action: () => {
        if (currentAccount.signed_in) {
          void import('./settings-modal.ts').then((m) => m.openHanzoSettingsModal('account'))
        } else {
          void import('./signin-modal.ts').then(({ openSignInModal }) =>
            openSignInModal({
              mode: 'modal',
              onSignedIn: () => void status().then((a) => (currentAccount = a)),
            }),
          )
        }
      },
    },
    {
      label: 'Get Hanzo on your phone',
      action: () => {
        void import('./phone-app-modal.ts').then((m) => m.openPhoneAppModal())
      },
    },
    {
      label: 'Settings…',
      kbd: isMac ? '⌘,' : 'Ctrl ,',
      action: () => {
        void import('./settings-modal.ts').then((m) => m.openHanzoSettingsModal('general'))
      },
    },
    {
      label: 'Reset to default layout',
      action: () => void resetZenDefaultLayout(),
    },
    { separator: true },
    {
      label: 'Quit Hanzo IDE',
      kbd: isMac ? '⌘Q' : 'Alt+F4',
      action: () => void closeDesktopWindow(),
    },
  ]

  function renderEntries(): void {
    if (!menuEl) return
    const wslItem = menuEl.querySelector('#hanzo-wsl-menu-item')
    menuEl.replaceChildren()
    for (const entry of entries) {
      if (entry.separator) {
        const sep = document.createElement('div')
        sep.className = 'hanzo-desktop-menu-sep'
        sep.setAttribute('role', 'separator')
        menuEl.appendChild(sep)
        continue
      }
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'hanzo-desktop-menu-item'
      item.setAttribute('role', 'menuitem')

      const lbl = document.createElement('span')
      lbl.textContent = typeof entry.label === 'function' ? entry.label() : (entry.label ?? '')
      item.appendChild(lbl)

      if (entry.kbd) {
        const kbd = document.createElement('span')
        kbd.className = 'hanzo-desktop-menu-kbd'
        kbd.textContent = entry.kbd
        item.appendChild(kbd)
      }

      item.addEventListener('click', () => {
        closeMenu()
        entry.action?.()
      })
      menuEl.appendChild(item)
    }
    if (wslItem) {
      menuEl.insertBefore(wslItem, menuEl.children[4] ?? null)
    }
  }

  function closeMenu(): void {
    if (!menuEl) return
    menuEl.hidden = true
    btn.setAttribute('aria-expanded', 'false')
  }

  function openMenu(): void {
    if (!menuEl) return
    renderEntries()
    const rect = btn.getBoundingClientRect()
    menuEl.style.top = `${Math.max(40, Math.round(rect.bottom + 4))}px`
    menuEl.style.left = `${Math.max(8, Math.round(rect.left))}px`
    menuEl.hidden = false
    btn.setAttribute('aria-expanded', 'true')
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (menuEl && !menuEl.hidden) closeMenu()
    else openMenu()
  })

  document.addEventListener('mousedown', (e) => {
    if (!menuEl || menuEl.hidden) return
    const t = e.target as Node | null
    if (t && (btn.contains(t) || menuEl.contains(t))) return
    closeMenu()
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuEl && !menuEl.hidden) {
      e.stopPropagation()
      closeMenu()
    }
  })

  window.addEventListener('blur', () => closeMenu())

  return btn
}

function makePanelToggleButton(
  panel: ZenPanelKey,
  iconName: 'left' | 'right' | 'terminal' | 'browser' | 'integrations',
  title: string,
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'hanzo-toolbar-ib'
  btn.dataset.zenPanel = panel
  btn.title = title
  btn.setAttribute('aria-label', title)
  btn.setAttribute('aria-pressed', 'false')
  btn.setAttribute('data-tauri-drag-region', 'false')
  btn.innerHTML = zenIcon(iconName, 16)
  btn.addEventListener('mousedown', (e) => e.stopPropagation())
  btn.addEventListener('click', () => void toggleZenPanel(panel))
  return btn
}

function createNavButton(direction: 'back' | 'forward'): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'hanzo-toolbar-ib'
  const label = direction === 'back' ? 'Previous editor' : 'Next editor'
  btn.title = label
  btn.setAttribute('aria-label', label)
  btn.setAttribute('data-tauri-drag-region', 'false')
  btn.innerHTML = zenIcon(direction, 16)
  btn.addEventListener('mousedown', (e) => e.stopPropagation())
  btn.addEventListener('click', () => {
    void execZenCommand(
      direction === 'back' ? 'workbench.action.navigateBack' : 'workbench.action.navigateForward',
    )
  })
  return btn
}

export function mountWorkbenchShellChrome(): HTMLElement {
  installMaximizedStateSync()

  const isMac = isMacDesktopPlatform()
  let toolbar = document.getElementById('hanzo-zen-toolbar') as HTMLElement | null
  if (!toolbar) {
    toolbar = document.createElement('header')
    toolbar.id = 'hanzo-zen-toolbar'
    toolbar.className = 'hanzo-zen-toolbar'
    toolbar.setAttribute('aria-label', 'Window toolbar')
    toolbar.setAttribute('data-tauri-drag-region', '')
    bindFramelessDragRegion(toolbar)

    // 1. Left Cluster: [F-menu] [PanelLeft] [<] [>] (+ project pill when folder is open)
    const left = document.createElement('div')
    left.className = 'hanzo-zen-cluster'

    if (!isMac) {
      left.appendChild(createDesktopMenuButton())
    }
    left.append(
      makePanelToggleButton(
        'left',
        'left',
        isMac ? 'Toggle left sidebar (⌘B)' : 'Toggle left sidebar (Ctrl+B)',
      ),
      createNavButton('back'),
      createNavButton('forward'),
    )

    const projectBtn = document.createElement('button')
    projectBtn.type = 'button'
    projectBtn.className = 'hanzo-zen-project'
    projectBtn.title = 'Switch project folder'
    projectBtn.setAttribute('aria-label', 'Workspace folder')

    const syncProjectLabel = () => {
      const ws = getWorkspacePath() ?? getWorkspace()
      if (ws) {
        projectBtn.textContent = formatWorkspaceLabel(ws)
        projectBtn.dataset.kind = 'workspace'
        projectBtn.hidden = false
      } else if (!projectBtn.dataset.kind || projectBtn.dataset.kind === 'workspace') {
        projectBtn.textContent = ''
        projectBtn.hidden = true
      }
    }
    syncProjectLabel()
    window.addEventListener('hashchange', syncProjectLabel)
    onZenActiveTargetChange((target) => {
      projectBtn.dataset.kind = target.kind
      if (target.kind === 'empty') {
        projectBtn.textContent = ''
        projectBtn.hidden = true
      } else {
        projectBtn.textContent = target.label
        projectBtn.hidden = false
      }
    })

    projectBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      openProjectFolderMenu(projectBtn)
    })

    left.appendChild(projectBtn)

    // 2. Middle Drag Region: 100% clean empty `#000000`
    const dragSpacer = document.createElement('div')
    dragSpacer.className = 'hanzo-zen-drag-spacer'
    dragSpacer.setAttribute('data-tauri-drag-region', '')

    // 3. Right Cluster: [🔍 Search] [🗔 Browser] [>_ Terminal] [⊞ Integrations] [PanelRight] | [— □ ×]
    const right = document.createElement('div')
    right.className = 'hanzo-zen-cluster'

    const searchBtn = document.createElement('button')
    searchBtn.type = 'button'
    searchBtn.className = 'hanzo-toolbar-ib'
    searchBtn.title = isMac
      ? 'Quick Open / Command Palette (⌘P / ⌘K)'
      : 'Quick Open / Command Palette (Ctrl+P / Ctrl+K)'
    searchBtn.setAttribute('aria-label', 'Quick Open or Command Palette')
    searchBtn.setAttribute('data-tauri-drag-region', 'false')
    searchBtn.innerHTML = zenIcon('search', 16)
    searchBtn.addEventListener('mousedown', (e) => e.stopPropagation())
    searchBtn.addEventListener('click', () => {
      void execZenCommand(
        getWorkspacePath() ?? getWorkspace()
          ? 'workbench.action.quickOpen'
          : 'workbench.action.showCommands',
      )
    })

    const accountSlot = document.createElement('div')
    accountSlot.className = 'hanzo-account'

    right.append(
      searchBtn,
      makePanelToggleButton('browser', 'browser', 'Integrated Browser'),
      makePanelToggleButton(
        'bottom',
        'terminal',
        isMac ? 'Terminal (⌃`)' : 'Terminal (Ctrl+`)',
      ),
      makePanelToggleButton('integrations', 'integrations', 'MCP & Tools (HIP-0300)'),
      makePanelToggleButton(
        'right',
        'right',
        isMac ? 'Agentic Chat (⌥⌘B)' : 'Agentic Chat (Ctrl+Alt+B)',
      ),
      accountSlot,
    )

    if (!isMac) {
      const sep = document.createElement('div')
      sep.className = 'hanzo-zen-sep'
      sep.setAttribute('aria-hidden', 'true')
      right.append(sep, createWindowControlsElement())
    }

    toolbar.append(left, dragSpacer, right)
    const host = document.getElementById('hanzo-ide-shell') ?? document.body
    host.prepend(toolbar)
    return accountSlot
  }

  let accountSlot = toolbar.querySelector<HTMLElement>('.hanzo-account')
  if (!accountSlot) {
    accountSlot = document.createElement('div')
    accountSlot.className = 'hanzo-account'
    toolbar.appendChild(accountSlot)
  }
  return accountSlot
}

export function mountDetachedChatChrome(
  topBar: HTMLElement | null,
  actionsContainer: HTMLElement,
  onClose: () => void,
): void {
  installMaximizedStateSync()
  const isMac = isMacDesktopPlatform()
  if (topBar) {
    topBar.style.minHeight = '40px'
    topBar.style.background = 'var(--zen-chrome, #000000)'
    if (isMac) topBar.style.paddingLeft = '78px'
    bindFramelessDragRegion(topBar)
  }
  if (!isMac && !actionsContainer.querySelector('[data-slot="window-controls"]')) {
    const sep = document.createElement('div')
    sep.className = 'hanzo-zen-sep'
    sep.setAttribute('aria-hidden', 'true')
    actionsContainer.append(sep, createWindowControlsElement(onClose))
  }
}

function slot(into?: HTMLElement): HTMLElement {
  if (into) {
    let el = into.querySelector<HTMLElement>('.hanzo-account')
    if (el) return el
    el = document.createElement('div')
    el.className = 'hanzo-account hanzo-account--compact'
    into.appendChild(el)
    return el
  }
  return mountWorkbenchShellChrome()
}

export async function registerAccount(into?: HTMLElement): Promise<void> {
  const el = slot(into)

  const syncAccount = (a: Account) => {
    currentAccount = a
    el.dataset.signedIn = String(a.signed_in)
    if (a.signed_in && !activeOrg() && a.org) {
      setActiveOrg(a.org)
    }
  }

  try {
    const initial = await status()
    syncAccount(initial)
    void import('./wsl-remote.ts').then(({ mountWslRemoteChrome }) => {
      void mountWslRemoteChrome()
    })
    const params = new URLSearchParams(window.location.search)
    const skipGateForPreset = params.has('zenLayout') && !params.has('signin')
    if (!into && !initial.signed_in && !skipGateForPreset) {
      void import('./signin-modal.ts').then(({ maybeShowInitialSignInGate }) =>
        maybeShowInitialSignInGate(() => {
          void status().then(syncAccount)
        }),
      )
    }
  } catch {
    syncAccount({ identity: null, org: null, signed_in: false })
  }
}

export async function signOutAccount(): Promise<void> {
  if (tauri()) await invoke('auth_logout').catch(() => {})
  else await signOut().catch(() => {})
}
