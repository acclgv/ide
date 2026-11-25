// Antigravity-style Windows <-> WSL2 Host Switcher (`>< WSL: <Distro>`).
//
// On Windows, the GUI window remains the native Windows `.exe` while
// "Reopen in WSL (<Distro>)" <-> "Reopen in Windows" swaps the active
// terminal & agent execution host (`wsl.exe -d <distro>`) and reloads
// the window (`window.location.reload()`).

import { invoke } from '@tauri-apps/api/core'
import { tauri } from './tauri.ts'
import { detectDesktopPlatform } from './theme.ts'

export const WSL_DISTRO_STORAGE_KEY = 'hanzo.ide.wslDistro'

export interface WslStatus {
  available: boolean
  distros: string[]
  active_distro: string | null
}

export async function syncWslHostState(): Promise<WslStatus> {
  if (!tauri() || detectDesktopPlatform() !== 'windows') {
    return { available: false, distros: [], active_distro: null }
  }
  try {
    const saved = localStorage.getItem(WSL_DISTRO_STORAGE_KEY)?.trim() || null
    await invoke('set_wsl_mode', { distro: saved })
    return await invoke<WslStatus>('get_wsl_status')
  } catch {
    return { available: false, distros: [], active_distro: null }
  }
}

export async function switchWslDistroAndReload(distro: string | null): Promise<void> {
  try {
    if (distro) localStorage.setItem(WSL_DISTRO_STORAGE_KEY, distro)
    else localStorage.removeItem(WSL_DISTRO_STORAGE_KEY)
    if (tauri()) {
      await invoke('set_wsl_mode', { distro })
    }
  } catch (e) {
    console.warn('[hanzo-wsl] failed to set WSL mode:', e)
  }
  window.location.reload()
}

export async function mountWslRemoteChrome(): Promise<void> {
  const st = await syncWslHostState()
  if (!st.available) return

  const primaryDistro = st.distros[0] || 'Ubuntu'
  const active = st.active_distro

  // 1. Add "Reopen in WSL (<Distro>)" / "Reopen in Windows" to the F-menu
  const menuEl = document.getElementById('hanzo-desktop-app-menu')
  if (menuEl && !menuEl.querySelector('[data-wsl-item="true"]')) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'hanzo-desktop-menu-item'
    btn.setAttribute('role', 'menuitem')
    btn.setAttribute('data-wsl-item', 'true')

    const lbl = document.createElement('span')
    lbl.textContent = active ? 'Reopen in Windows' : `Reopen in WSL (${primaryDistro})`
    btn.appendChild(lbl)

    btn.addEventListener('click', () => {
      menuEl.hidden = true
      void switchWslDistroAndReload(active ? null : primaryDistro)
    })

    const firstSep = menuEl.querySelector('.hanzo-desktop-menu-sep')
    if (firstSep) menuEl.insertBefore(btn, firstSep)
    else menuEl.appendChild(btn)
  }

  // 2. Mount Antigravity-style bottom-left `><` / `>< WSL: <Distro>` statusbar pill
  const statusbar = document.querySelector<HTMLElement>('.monaco-workbench .part.statusbar')
  if (!statusbar || statusbar.querySelector('#hanzo-remote-host-pill')) return

  const pill = document.createElement('button')
  pill.id = 'hanzo-remote-host-pill'
  pill.type = 'button'
  pill.title = active
    ? `Connected to WSL (${active}) — click to reopen in Windows or switch distro`
    : `Running on Native Windows — click to reopen in WSL (${primaryDistro})`
  pill.style.cssText =
    'height:24px;padding:0 9px;border:none;background:var(--hanzo-accent,#fafafa);color:var(--hanzo-accent-ink,#09090b);font-family:var(--hanzo-font-ui);font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0'
  pill.innerHTML = `<span class="codicon codicon-remote" style="font-size:12px"></span><span>${active ? `WSL: ${active}` : ''}</span>`

  pill.addEventListener('click', (e) => {
    e.stopPropagation()
    const existing = document.getElementById('hanzo-wsl-picker-menu')
    if (existing) {
      existing.remove()
      return
    }
    const pop = document.createElement('div')
    pop.id = 'hanzo-wsl-picker-menu'
    pop.className = 'hanzo-desktop-menu'
    pop.style.top = 'auto'
    pop.style.bottom = '28px'
    pop.style.left = '6px'

    for (const d of st.distros) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'hanzo-desktop-menu-item'
      item.innerHTML = `<span>Reopen in WSL (${d})</span>${d === active ? '<span class="hanzo-desktop-menu-kbd">Active</span>' : ''}`
      item.addEventListener('click', () => {
        pop.remove()
        if (d !== active) void switchWslDistroAndReload(d)
      })
      pop.appendChild(item)
    }

    if (active) {
      const sep = document.createElement('div')
      sep.className = 'hanzo-desktop-menu-sep'
      pop.appendChild(sep)

      const winItem = document.createElement('button')
      winItem.type = 'button'
      winItem.className = 'hanzo-desktop-menu-item'
      winItem.innerHTML = '<span>Reopen in Windows</span>'
      winItem.addEventListener('click', () => {
        pop.remove()
        void switchWslDistroAndReload(null)
      })
      pop.appendChild(winItem)
    }

    const onDocDown = (ev: MouseEvent) => {
      if (!pop.contains(ev.target as Node) && !pill.contains(ev.target as Node)) {
        document.removeEventListener('mousedown', onDocDown)
        pop.remove()
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.body.appendChild(pop)
  })

  statusbar.prepend(pill)
}
