// Unified Hanzo Titlebar Shell Chrome & IAM Account/Org (`X-Org-Id`) Status Pill.
//
// Matches Hanzo Dev and Hanzo Team:
//   - Left cluster: Workspace / Project Switcher pill
//   - Right cluster: Sidebar (`⌘B`), Command Palette (`⌘K`), Hanzo Agent Panel,
//     Theme (`Hanzo Dark` / `Hanzo Light`), Settings (`⌘,`), and the Unified
//     Hanzo IAM Account & Org (`X-Org-Id`) status pill (`hanzo.id`).
//
// When a custom `into` container is passed (e.g. detached chat window's
// topbar actions), only the compact `.hanzo-account` pill is mounted there.

import './account.css'
import { invoke } from '@tauri-apps/api/core'
import { tauri } from './tauri.ts'
import { activeOrg, orgs, session, setActiveOrg, signIn, signOut, user } from './iam.ts'
import { getWorkspace } from './ide-context.ts'
import { HANZO_IAM_DEFAULTS, readStoredAppearance } from './theme.ts'

interface Account {
  identity: string | null
  org: string | null
  signed_in: boolean
}

const POLL_MS = 1500
const POLL_LIMIT = 120

async function status(): Promise<Account> {
  if (tauri()) {
    try {
      return await invoke<Account>('auth_status')
    } catch {
      // fallback
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

async function awaitSignIn(render: (a: Account) => void): Promise<void> {
  for (let i = 0; i < POLL_LIMIT; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    try {
      const a = await status()
      if (a.signed_in) {
        render(a)
        return
      }
    } catch {
      // CLI mid-write
    }
  }
  render({ identity: null, org: null, signed_in: false })
}

async function execCommand(commandId: string): Promise<void> {
  try {
    const { StandaloneServices } = await import('@codingame/monaco-vscode-api/services')
    const { ICommandService } = await import(
      '@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands'
    )
    if (!ICommandService) return
    const commandService = StandaloneServices.get(ICommandService) as any
    await commandService?.executeCommand?.(commandId)
  } catch (e) {
    console.warn('[hanzo-chrome] command failed:', commandId, e)
  }
}

function workspaceLabel(): string {
  const ws = getWorkspace()
  if (!ws) return 'Open Workspace'
  const parts = ws.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || ws
}

function makeChromeIconButton(
  codicon: string,
  title: string,
  onClick: () => void,
  extraClass = '',
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `hanzo-chrome-btn ${extraClass}`.trim()
  btn.title = title
  btn.setAttribute('aria-label', title)
  const icon = document.createElement('span')
  icon.className = `codicon ${codicon}`
  btn.appendChild(icon)
  btn.addEventListener('click', onClick)
  return btn
}

function mountWorkbenchShellChrome(titlebar: HTMLElement): HTMLElement {
  let left = titlebar.querySelector<HTMLElement>('.hanzo-shell-left')
  if (!left) {
    left = document.createElement('div')
    left.className = 'hanzo-shell-left'

    const wsBtn = document.createElement('button')
    wsBtn.type = 'button'
    wsBtn.className = 'hanzo-workspace-pill'
    wsBtn.title = 'Switch Workspace / Open Folder'
    wsBtn.setAttribute('aria-label', 'Switch Workspace')

    const mark = document.createElement('img')
    mark.src = '/mark.svg'
    mark.alt = ''
    mark.className = 'hanzo-workspace-mark'

    const wsText = document.createElement('span')
    wsText.className = 'hanzo-workspace-name'
    wsText.textContent = workspaceLabel()

    const chevron = document.createElement('span')
    chevron.className = 'codicon codicon-chevron-down hanzo-workspace-chevron'

    wsBtn.append(mark, wsText, chevron)
    wsBtn.addEventListener('click', () => {
      void execCommand('hanzo.openFolder')
    })

    window.addEventListener('hashchange', () => {
      wsText.textContent = workspaceLabel()
    })

    left.appendChild(wsBtn)
    titlebar.prepend(left)
  }

  let right = titlebar.querySelector<HTMLElement>('.hanzo-shell-right')
  if (!right) {
    right = document.createElement('div')
    right.className = 'hanzo-shell-right'

    const sidebarBtn = makeChromeIconButton(
      'codicon-layout-sidebar-left',
      'Toggle Sidebar (⌘B)',
      () => void execCommand('workbench.action.toggleSidebarVisibility'),
    )

    const paletteBtn = document.createElement('button')
    paletteBtn.type = 'button'
    paletteBtn.className = 'hanzo-chrome-pill'
    paletteBtn.title = 'Command Palette (⌘K / ⇧⌘P)'
    paletteBtn.setAttribute('aria-label', 'Command Palette (⌘K)')
    paletteBtn.innerHTML =
      '<span class="codicon codicon-search"></span><span class="hanzo-chrome-kbd">⌘K</span>'
    paletteBtn.addEventListener('click', () => {
      void execCommand('workbench.action.showCommands')
    })

    const agentBtn = makeChromeIconButton(
      'codicon-comment-discussion',
      'Toggle Hanzo Agent Panel (⌥⌘B)',
      () => void execCommand('workbench.action.toggleAuxiliaryBar'),
    )

    const themeBtn = makeChromeIconButton(
      readStoredAppearance() === 'light' ? 'codicon-color-mode' : 'codicon-color-mode',
      'Toggle Hanzo Dark / Light Theme',
      () => void execCommand('hanzo.toggleTheme'),
    )

    const settingsBtn = makeChromeIconButton(
      'codicon-settings-gear',
      'Settings (⌘,)',
      () => void execCommand('workbench.action.openSettings'),
    )

    const accountSlot = document.createElement('div')
    accountSlot.className = 'hanzo-account'

    right.append(sidebarBtn, paletteBtn, agentBtn, themeBtn, settingsBtn, accountSlot)
    titlebar.appendChild(right)
    return accountSlot
  }

  let accountSlot = right.querySelector<HTMLElement>('.hanzo-account')
  if (!accountSlot) {
    accountSlot = document.createElement('div')
    accountSlot.className = 'hanzo-account'
    right.appendChild(accountSlot)
  }
  return accountSlot
}

function slot(into?: HTMLElement): HTMLElement | null {
  if (into) {
    let el = into.querySelector<HTMLElement>('.hanzo-account')
    if (el) return el
    el = document.createElement('div')
    el.className = 'hanzo-account hanzo-account--compact'
    into.appendChild(el)
    return el
  }
  const titlebar = document.querySelector<HTMLElement>('.monaco-workbench .part.titlebar')
  if (!titlebar) return null
  return mountWorkbenchShellChrome(titlebar)
}

export async function registerAccount(into?: HTMLElement): Promise<void> {
  const el = slot(into)
  if (!el) return

  const render = (a: Account) => {
    el.textContent = ''

    if (!a.signed_in) {
      el.dataset.signedIn = 'false'
      if (!into) {
        const domain = document.createElement('span')
        domain.className = 'hanzo-account-domain'
        domain.textContent = HANZO_IAM_DEFAULTS.domainLabel
        el.appendChild(domain)
      }
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'hanzo-account-btn'
      btn.textContent = 'Sign In'
      btn.title = 'Sign in with Hanzo IAM (hanzo.id)'
      btn.onclick = async () => {
        btn.disabled = true
        if (tauri()) {
          btn.textContent = 'Continue in browser…'
          try {
            await invoke('auth_login')
            await awaitSignIn(render)
          } catch (e) {
            btn.textContent = 'Sign In'
            btn.title = String(e)
          } finally {
            btn.disabled = false
          }
        } else {
          await signIn()
        }
      }
      el.appendChild(btn)
      return
    }

    el.dataset.signedIn = 'true'
    const currentOrg = activeOrg() || a.org || 'hanzo'
    if (!activeOrg() && a.org) {
      setActiveOrg(a.org)
    }

    const dot = document.createElement('span')
    dot.className = 'hanzo-account-dot'
    dot.title = `Connected via ${HANZO_IAM_DEFAULTS.domainLabel} (${HANZO_IAM_DEFAULTS.orgHeader}: ${currentOrg})`

    const org = document.createElement('span')
    org.className = 'hanzo-account-org'
    org.textContent = currentOrg
    org.title = `Active organization (${HANZO_IAM_DEFAULTS.orgHeader}: ${currentOrg})`

    const sep = document.createElement('span')
    sep.className = 'hanzo-account-sep'
    sep.textContent = '/'

    const who = document.createElement('button')
    who.type = 'button'
    who.className = 'hanzo-account-btn hanzo-account-who'
    who.textContent = a.identity ?? 'Signed in'
    who.title = `Signed in via ${HANZO_IAM_DEFAULTS.domainLabel} — click to sign out`
    who.onclick = async () => {
      who.disabled = true
      if (tauri()) {
        try {
          await invoke('auth_logout')
        } catch (e) {
          console.warn('Logout error:', e)
        }
      } else {
        await signOut().catch((e) => console.warn('Logout error:', e))
      }
      render(await status())
      who.disabled = false
    }

    el.append(dot, org, sep, who)

    void orgs()
      .then((list) => {
        if (list.length < 2) return
        const pick = document.createElement('select')
        pick.className = 'hanzo-account-switch'
        pick.title = `Switch organization (${HANZO_IAM_DEFAULTS.orgHeader})`
        for (const name of list) {
          const o = document.createElement('option')
          o.value = name
          o.textContent = name
          o.selected = name === (activeOrg() || a.org || '')
          pick.appendChild(o)
        }
        pick.onchange = () => {
          setActiveOrg(pick.value)
          dot.title = `Connected via ${HANZO_IAM_DEFAULTS.domainLabel} (${HANZO_IAM_DEFAULTS.orgHeader}: ${pick.value})`
        }
        org.replaceWith(pick)
      })
      .catch(() => {})
  }

  try {
    render(await status())
  } catch {
    render({ identity: null, org: null, signed_in: false })
  }
}
