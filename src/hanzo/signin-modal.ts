// Canonical Compact Login (`Sign in to Hanzo IDE`) + `Continue without signing in`.
//
// Matches `@hanzo/ui/auth/panel` across Hanzo App, Hanzo Bot, and Hanzo Studio:
//   - Zero top-left `hanzo` wordmark
//   - Centered 64px canonical `hanzo-ide` `<>` Obsidian Squircle (`/favicon.svg`)
//   - Heading: "Sign in to Hanzo IDE" (24px)
//   - Byte-identical `@hanzo/ui` Google & GitHub icons in 44px × 13px-radius pills
//   - `or` divider + solid `[Continue with email]` + `[Continue without signing in]`
//   - 20px geometric Hanzo mark footer in gate mode (`460 × 640` -> `1440 × 900`).

import './signin-modal.css'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { tauri } from './tauri.ts'
import { session, signIn } from './iam.ts'
import { isMacDesktopPlatform } from './theme.ts'
import { bindFramelessDragRegion, createWindowControlsElement } from './account.ts'

export const SIGNIN_SKIPPED_KEY = 'hanzo.ide.signinGateSkipped'

const SVG_GOOGLE =
  '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.36 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.25C.45 8.16 0 9.96 0 12s.45 3.84 1.25 5.43l4.03-3.14z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z"/></svg>'

const SVG_GITHUB =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>'

const SVG_CLOSE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke-linecap="round"/><line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke-linecap="round"/></svg>'

interface AuthStatus {
  identity: string | null
  org: string | null
  signed_in: boolean
}

async function fetchAuthStatus(): Promise<AuthStatus> {
  if (tauri()) {
    try {
      return await invoke<AuthStatus>('auth_status')
    } catch {
      /* fallback */
    }
  }
  return {
    identity: null,
    org: null,
    signed_in: Boolean(session().authenticated),
  }
}

async function resizeDesktopWindow(
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
): Promise<void> {
  if (!tauri()) return
  try {
    const win = getCurrentWindow()
    await win.setMinSize(new LogicalSize(minWidth, minHeight))
    await win.setSize(new LogicalSize(width, height))
    await win.center()
    setTimeout(() => {
      void win.center().catch(() => {})
    }, 90)
  } catch (e) {
    console.warn('[hanzo-auth] window resize skipped:', e)
  }
}

export interface SignInModalOptions {
  mode?: 'modal' | 'gate'
  onSignedIn?: () => void
  onDismiss?: () => void
}

export function openSignInModal(options: SignInModalOptions = {}): void {
  const mode = options.mode ?? 'modal'
  const existing = document.getElementById('hanzo-auth-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'hanzo-auth-overlay'
  overlay.className = 'hanzo-auth-overlay'
  overlay.dataset.mode = mode
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Sign in to Hanzo IDE')

  let pollCancelled = false
  if (mode === 'gate') {
    document.documentElement.dataset.signinGate = 'true'
    document.documentElement.dataset.hanzoCompact = 'true'
  }

  const finishAndClose = async (signedIn: boolean) => {
    pollCancelled = true
    delete document.documentElement.dataset.signinGate
    delete document.documentElement.dataset.hanzoCompact
    try {
      localStorage.setItem(SIGNIN_SKIPPED_KEY, '1')
    } catch {
      /* ignore */
    }
    if (mode === 'gate') {
      await resizeDesktopWindow(1440, 900, 900, 600)
    }
    overlay.remove()
    window.dispatchEvent(new Event('resize'))
    if (signedIn) options.onSignedIn?.()
    else options.onDismiss?.()
  }

  if (mode === 'gate') {
    const gateBar = document.createElement('header')
    gateBar.className = 'hanzo-auth-gate-bar'
    gateBar.setAttribute('data-slot', 'masthead')
    gateBar.setAttribute('data-tauri-drag-region', '')
    bindFramelessDragRegion(gateBar)
    if (!isMacDesktopPlatform()) {
      gateBar.appendChild(createWindowControlsElement())
    }
    overlay.appendChild(gateBar)
  }

  const card = document.createElement('main')
  card.className = 'hanzo-auth-card'

  if (mode === 'modal') {
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'hanzo-auth-close'
    closeBtn.title = 'Close'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.innerHTML = SVG_CLOSE
    closeBtn.addEventListener('click', () => {
      void finishAndClose(false)
    })
    card.appendChild(closeBtn)
  }

  const icon = document.createElement('img')
  icon.src = '/favicon.svg'
  icon.alt = 'Hanzo IDE'
  icon.className = 'hanzo-auth-squircle'

  const title = document.createElement('h1')
  title.className = 'hanzo-auth-title'
  title.textContent = 'Sign in to Hanzo IDE'

  const subtitle = document.createElement('p')
  subtitle.className = 'hanzo-auth-subtitle'
  subtitle.textContent =
    'Sync Zen cloud models, memory, and org workspaces — or continue 100% locally.'

  const panel = document.createElement('section')
  panel.className = 'hanzo-auth-panel'
  panel.setAttribute('data-slot', 'signin-panel')

  const oauthGrid = document.createElement('div')
  oauthGrid.className = 'hanzo-auth-oauth-grid'

  const googleBtn = document.createElement('button')
  googleBtn.type = 'button'
  googleBtn.className = 'hanzo-auth-btn'
  googleBtn.innerHTML = `${SVG_GOOGLE}<span>Continue with Google</span>`

  const githubBtn = document.createElement('button')
  githubBtn.type = 'button'
  githubBtn.className = 'hanzo-auth-btn'
  githubBtn.innerHTML = `${SVG_GITHUB}<span>Continue with GitHub</span>`

  oauthGrid.append(googleBtn, githubBtn)

  const divider = document.createElement('div')
  divider.className = 'hanzo-auth-divider'
  divider.textContent = 'or'

  const emailBtn = document.createElement('button')
  emailBtn.type = 'button'
  emailBtn.className = 'hanzo-auth-btn'
  emailBtn.dataset.solid = 'true'
  emailBtn.textContent = 'Continue with email'

  const skipBtn = document.createElement('button')
  skipBtn.id = 'continue-without-login'
  skipBtn.type = 'button'
  skipBtn.className = 'hanzo-auth-btn'
  skipBtn.dataset.guest = 'true'
  skipBtn.textContent = 'Continue without signing in'
  skipBtn.addEventListener('click', () => {
    void finishAndClose(false)
  })

  const terms = document.createElement('p')
  terms.className = 'hanzo-auth-terms'
  terms.innerHTML =
    'By continuing, you agree to Hanzo\u2019s <a href="https://hanzo.ai/terms" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="https://hanzo.ai/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.'
  terms.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (!tauri()) return
      e.preventDefault()
      void invoke('open_external', { url: a.href }).catch(() => {})
    })
  })

  const statusEl = document.createElement('div')
  statusEl.className = 'hanzo-auth-status'

  const triggerLogin = async () => {
    googleBtn.disabled = true
    githubBtn.disabled = true
    emailBtn.disabled = true
    statusEl.textContent = 'Complete sign-in in your browser…'

    if (!tauri()) {
      await signIn()
      return
    }

    try {
      await invoke('auth_login')
      for (let i = 0; i < 120 && !pollCancelled; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const st = await fetchAuthStatus()
        if (st.signed_in) {
          await finishAndClose(true)
          return
        }
      }
      statusEl.textContent = 'Timed out waiting for browser sign-in.'
    } catch (e) {
      statusEl.textContent = String(e)
    } finally {
      googleBtn.disabled = false
      githubBtn.disabled = false
      emailBtn.disabled = false
    }
  }

  googleBtn.addEventListener('click', () => void triggerLogin())
  githubBtn.addEventListener('click', () => void triggerLogin())
  emailBtn.addEventListener('click', () => void triggerLogin())

  panel.append(oauthGrid, divider, emailBtn, skipBtn, terms)
  card.append(icon, title, subtitle, panel, statusEl)
  overlay.appendChild(card)

  if (mode === 'gate') {
    const spacer = document.createElement('div')
    spacer.style.height = '18px'
    overlay.appendChild(spacer)
  }

  if (mode === 'modal') {
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) void finishAndClose(false)
    })
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', onKey)
      void finishAndClose(false)
    }
  }
  window.addEventListener('keydown', onKey)

  document.body.appendChild(overlay)
}

export async function maybeShowInitialSignInGate(onSignedIn?: () => void): Promise<void> {
  if (!tauri()) return
  if (window.location.hash && window.location.hash.length > 1) return
  if (new URLSearchParams(window.location.search).get('skipSignIn') === '1') return
  try {
    if (localStorage.getItem(SIGNIN_SKIPPED_KEY) === '1') return
  } catch {
    return
  }
  const st = await fetchAuthStatus()
  if (st.signed_in) return

  await resizeDesktopWindow(460, 640, 380, 540)
  openSignInModal({
    mode: 'gate',
    onSignedIn,
  })
}
