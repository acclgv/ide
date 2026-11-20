/**
 * macOS Dock icon mode bridge ("branded" with corner H badge vs "minimal" without badge).
 *
 * All Tauri calls are guarded by `tauri()` so browser builds (ide.hanzo.ai) stay safe.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen, tauri } from './tauri.ts'

export type DockIconMode = 'branded' | 'minimal'

export const DOCK_ICON_MODE_CHANGED_EVENT = 'dock-icon-mode-changed'

export function normalizeDockIconMode(raw: unknown): DockIconMode {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'minimal') {
    return 'minimal'
  }
  return 'branded'
}

export async function getDockIconMode(): Promise<DockIconMode> {
  if (!tauri()) return 'branded'
  const raw = await invoke<string>('get_dock_icon_mode')
  return normalizeDockIconMode(raw)
}

export async function setDockIconMode(mode: DockIconMode): Promise<DockIconMode> {
  if (!tauri()) return mode
  const raw = await invoke<string>('set_dock_icon_mode', { mode })
  return normalizeDockIconMode(raw)
}

export function onDockIconModeChanged(
  handler: (mode: DockIconMode) => void,
): Promise<() => void> {
  return listen<string>(DOCK_ICON_MODE_CHANGED_EVENT, (event) => {
    handler(normalizeDockIconMode(event.payload))
  })
}
