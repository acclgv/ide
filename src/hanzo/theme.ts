/**
 * Canonical Hanzo Unified Shell Theme, Keybindings & Model Defaults.
 *
 * Aligns `Hanzo IDE` (`ai.hanzo.ide`) with `Hanzo Dev` and `Hanzo Team`:
 *   - Pure obsidian dark (`#090909` / `#111114`) & clean alabaster light (`#f8f8fa` / `#ffffff`)
 *   - 240–260px collapsible sidebar (`⌘B`) with 8px pill rows and zero noisy dividers
 *   - Hairline borders (`#222226` dark / `#e4e4e7` light)
 *   - High-contrast monochrome accents (`#ffffff` / `#e4e4e7` dark, `#18181b` light)
 *   - Semantic signals: `#10b981` live, `#f59e0b` warning/approval, `#ef4444` error
 *   - Zen + Qwen3+ model defaults (never Qwen2)
 *   - Unified Hanzo IAM (`hanzo.id`) with `X-Org-Id` multi-tenant routing
 */

export type HanzoAppearance = 'dark' | 'light'

export interface HanzoShellPalette {
  id: string
  name: string
  aliases: readonly string[]
  appearance: HanzoAppearance
  baseVsCodeTheme: string
  floor: string
  rail: string
  sidebar: string
  stage: string
  surfaceRaised: string
  surfaceCard: string
  border: string
  borderSubtle: string
  rowHover: string
  rowActive: string
  inkPrimary: string
  inkSecondary: string
  inkMuted: string
  accent: string
  accentPill: string
  accentInk: string
  statusLive: string
  statusWarning: string
  statusError: string
}

export const HANZO_OBSIDIAN_PALETTE: HanzoShellPalette = {
  id: 'hanzo-obsidian',
  name: 'Hanzo Dark',
  aliases: ['Hanzo Dark', 'Hanzo Obsidian'],
  appearance: 'dark',
  baseVsCodeTheme: 'Default Dark Modern',
  floor: '#090909',
  rail: '#090909',
  sidebar: '#0c0c0c',
  stage: '#111114',
  surfaceRaised: '#16161a',
  surfaceCard: '#141417',
  border: '#222226',
  borderSubtle: '#ffffff0f',
  rowHover: '#ffffff0d',
  rowActive: '#ffffff17',
  inkPrimary: '#fafafa',
  inkSecondary: '#a1a1aa',
  inkMuted: '#71717a',
  accent: '#ffffff',
  accentPill: '#e4e4e7',
  accentInk: '#09090b',
  statusLive: '#10b981',
  statusWarning: '#f59e0b',
  statusError: '#ef4444',
}

export const HANZO_LIGHT_PALETTE: HanzoShellPalette = {
  id: 'hanzo-light',
  name: 'Hanzo Light',
  aliases: ['Hanzo Light', 'Hanzo Alabaster'],
  appearance: 'light',
  baseVsCodeTheme: 'Default Light Modern',
  floor: '#f8f8fa',
  rail: '#f8f8fa',
  sidebar: '#f4f4f6',
  stage: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceCard: '#f4f4f5',
  border: '#e4e4e7',
  borderSubtle: '#0000000f',
  rowHover: '#0000000a',
  rowActive: '#00000012',
  inkPrimary: '#18181b',
  inkSecondary: '#52525b',
  inkMuted: '#71717a',
  accent: '#18181b',
  accentPill: '#27272a',
  accentInk: '#ffffff',
  statusLive: '#10b981',
  statusWarning: '#f59e0b',
  statusError: '#ef4444',
}

export const HANZO_SHELL_GEOMETRY = {
  titlebarHeightPx: 40,
  sidebarDefaultWidthPx: 248,
  sidebarMinWidthPx: 240,
  sidebarMaxWidthPx: 260,
  pillRowRadiusPx: 8,
  trafficLightsInsetPx: 78,
} as const

export interface HanzoShortcutSpec {
  id: string
  mac: string
  winLinux: string
  command: string
  label: string
}

export const HANZO_DEFAULT_KEYBINDINGS: readonly HanzoShortcutSpec[] = [
  {
    id: 'sidebar.toggle',
    mac: '⌘B',
    winLinux: 'Ctrl+B',
    command: 'workbench.action.toggleSidebarVisibility',
    label: 'Toggle Sidebar',
  },
  {
    id: 'palette.open',
    mac: '⌘K',
    winLinux: 'Ctrl+K',
    command: 'hanzo.commandOrInlineEdit',
    label: 'Command Palette / Inline Edit',
  },
  {
    id: 'commands.all',
    mac: '⇧⌘P',
    winLinux: 'Ctrl+Shift+P',
    command: 'workbench.action.showCommands',
    label: 'Show All Commands',
  },
  {
    id: 'settings.open',
    mac: '⌘,',
    winLinux: 'Ctrl+,',
    command: 'workbench.action.openSettings',
    label: 'Settings',
  },
  {
    id: 'agent.toggle',
    mac: '⌥⌘B',
    winLinux: 'Ctrl+Alt+B',
    command: 'workbench.action.toggleAuxiliaryBar',
    label: 'Toggle Hanzo Agent Panel',
  },
] as const

export const HANZO_ZEN_MODEL_PRESETS = [
  'zen6',
  'zen6-coder',
  'zen6-flash',
  'zen6-max',
  'zen6-free',
  'zen-vl',
] as const

export const HANZO_OLLAMA_MODEL_PRESETS = [
  'zen6-coder',
  'zen6-flash',
  'qwen3-coder:30b',
  'qwen3-coder',
  'qwen3:8b',
  'deepseek-coder-v2',
  'llama3.2',
] as const

/** Enforce the Zen 6 / Qwen3+ policy: Zen 6+ (or evergreen `zen*`) + Qwen3+ only, never Qwen2 or legacy zen1..zen5. */
export function isAllowedModelId(modelId: string): boolean {
  const lower = modelId.trim().toLowerCase()
  if (!lower) return false
  if (lower.includes('qwen2') || lower.includes('qwen-2')) return false
  if (/(?:^|\/)zen[1-5](?:\b|-|$)/.test(lower)) return false
  return true
}

export const HANZO_IAM_DEFAULTS = {
  issuer: 'https://hanzo.id',
  domainLabel: 'hanzo.id',
  clientId: 'hanzo-ide',
  orgHeader: 'X-Org-Id',
  orgStorageKey: 'hanzo.console.org',
  themeStorageKey: 'hanzo.ide.appearance',
} as const

export function buildPaletteColorMap(p: HanzoShellPalette): Record<string, string> {
  const isDark = p.appearance === 'dark'
  return {
    'activityBar.background': p.rail,
    'activityBar.activeBorder': p.accent,
    'activityBar.foreground': p.inkPrimary,
    'activityBar.inactiveForeground': p.inkMuted,
    'activityBarBadge.background': p.accent,
    'activityBarBadge.foreground': p.accentInk,
    'statusBar.background': p.floor,
    'statusBar.foreground': p.inkSecondary,
    'statusBar.noFolderBackground': p.floor,
    'statusBar.debuggingBackground': p.surfaceCard,
    'statusBar.debuggingForeground': p.inkPrimary,
    'sideBar.background': p.sidebar,
    'sideBar.foreground': p.inkPrimary,
    'sideBarSectionHeader.background': p.sidebar,
    'sideBarSectionHeader.foreground': p.inkMuted,
    'sideBarTitle.foreground': p.inkPrimary,
    'editor.background': p.stage,
    'editor.foreground': p.inkPrimary,
    'editorLineNumber.foreground': p.inkMuted,
    'editorLineNumber.activeForeground': p.inkSecondary,
    'editorCursor.foreground': p.accent,
    'editorGroupHeader.tabsBackground': p.floor,
    'tab.activeBackground': p.stage,
    'tab.inactiveBackground': p.floor,
    'tab.activeForeground': p.inkPrimary,
    'tab.inactiveForeground': p.inkMuted,
    'tab.activeBorderTop': p.border,
    'panel.background': p.stage,
    'panelTitle.activeBorder': p.accent,
    'panelTitle.activeForeground': p.inkPrimary,
    'panelTitle.inactiveForeground': p.inkMuted,
    'titleBar.activeBackground': p.floor,
    'titleBar.activeForeground': p.inkPrimary,
    'titleBar.inactiveBackground': p.floor,
    'titleBar.inactiveForeground': p.inkMuted,
    'commandCenter.background': p.surfaceCard,
    'commandCenter.activeBackground': p.rowHover,
    'commandCenter.foreground': p.inkSecondary,
    'commandCenter.activeForeground': p.inkPrimary,
    'commandCenter.border': p.border,
    'button.background': p.accent,
    'button.foreground': p.accentInk,
    'button.border': '#00000000',
    'button.hoverBackground': p.accentPill,
    'button.secondaryBackground': p.surfaceCard,
    'button.secondaryForeground': p.inkPrimary,
    'button.secondaryHoverBackground': p.rowHover,
    'input.background': p.surfaceCard,
    'input.foreground': p.inkPrimary,
    'input.placeholderForeground': p.inkMuted,
    'input.border': p.border,
    'dropdown.background': p.surfaceRaised,
    'dropdown.foreground': p.inkPrimary,
    'dropdown.border': p.border,
    'quickInput.background': p.surfaceRaised,
    'quickInput.foreground': p.inkPrimary,
    'quickInputList.focusBackground': p.rowActive,
    'quickInputList.focusForeground': p.inkPrimary,
    'list.activeSelectionBackground': p.rowActive,
    'list.activeSelectionForeground': p.inkPrimary,
    'list.inactiveSelectionBackground': p.rowHover,
    'list.focusBackground': p.rowActive,
    'list.hoverBackground': p.rowHover,
    'list.highlightForeground': p.accent,
    'progressBar.background': p.accent,
    'badge.background': p.accentPill,
    'badge.foreground': p.accentInk,
    'textLink.foreground': p.inkPrimary,
    'textLink.activeForeground': p.accent,
    'errorForeground': p.statusError,
    'editorError.foreground': p.statusError,
    'editorWarning.foreground': p.statusWarning,
    'testing.iconPassed': p.statusLive,
    'testing.iconFailed': p.statusError,
    // Zero noisy structural seams: surface value separates panes.
    'contrastBorder': '#00000000',
    'contrastActiveBorder': '#00000000',
    'sash.hoverBorder': p.border,
    'focusBorder': p.border,
    'activityBar.border': '#00000000',
    'sideBar.border': '#00000000',
    'sideBarSectionHeader.border': '#00000000',
    'statusBar.border': '#00000000',
    'titleBar.border': '#00000000',
    'panel.border': '#00000000',
    'editorGroup.border': '#00000000',
    'editorGroupHeader.tabsBorder': '#00000000',
    'editorGroupHeader.border': '#00000000',
    'tab.border': '#00000000',
    'menu.background': p.surfaceRaised,
    'menu.foreground': p.inkPrimary,
    'menu.selectionBackground': p.rowActive,
    'menu.selectionForeground': p.inkPrimary,
    'menu.border': p.border,
    'widget.border': p.border,
    // Neutral monochrome git tree decorations (badge letter carries state).
    'gitDecoration.modifiedResourceForeground': isDark ? '#e4e4e7' : '#27272a',
    'gitDecoration.untrackedResourceForeground': isDark ? '#a1a1aa' : '#52525b',
    'gitDecoration.ignoredResourceForeground': isDark ? '#52525b' : '#a1a1aa',
    'gitDecoration.deletedResourceForeground': isDark ? '#71717a' : '#71717a',
    'gitDecoration.renamedResourceForeground': isDark ? '#a1a1aa' : '#52525b',
    'gitDecoration.stageModifiedResourceForeground': isDark ? '#fafafa' : '#18181b',
    'gitDecoration.conflictingResourceForeground': p.statusWarning,
  }
}

export function buildWorkbenchColorCustomizations(appearance: HanzoAppearance = 'dark'): Record<string, unknown> {
  const active = appearance === 'light' ? HANZO_LIGHT_PALETTE : HANZO_OBSIDIAN_PALETTE
  const darkColors = buildPaletteColorMap(HANZO_OBSIDIAN_PALETTE)
  const lightColors = buildPaletteColorMap(HANZO_LIGHT_PALETTE)
  return {
    ...buildPaletteColorMap(active),
    '[Default Dark Modern]': darkColors,
    '[Default Dark+]': darkColors,
    '[Default Light Modern]': lightColors,
    '[Default Light+]': lightColors,
  }
}

export function buildWorkbenchConfigurationDefaults(): Record<string, unknown> {
  return {
    'workbench.colorTheme': HANZO_OBSIDIAN_PALETTE.baseVsCodeTheme,
    'workbench.preferredDarkColorTheme': HANZO_OBSIDIAN_PALETTE.baseVsCodeTheme,
    'workbench.preferredLightColorTheme': HANZO_LIGHT_PALETTE.baseVsCodeTheme,
    'editor.fontFamily': "'Zen Mono', 'SF Mono', ui-monospace, monospace",
    'terminal.integrated.fontFamily': "'Zen Mono', 'SF Mono', ui-monospace, monospace",
    'debug.console.fontFamily': "'Zen Mono', 'SF Mono', ui-monospace, monospace",
    'chat.editor.fontFamily': "'Zen Mono', 'SF Mono', ui-monospace, monospace",
    'editor.fontSize': 13,
    'editor.lineHeight': 1.55,
    'editor.tabSize': 2,
    'editor.renderWhitespace': 'selection',
    'editor.minimap.enabled': false,
    'workbench.startupEditor': 'none',
    'window.menuBarVisibility': 'hidden',
    'window.commandCenter': true,
    'workbench.activityBar.location': 'default',
    'workbench.quickOpen.closeOnFocusLost': false,
    'prettier.enable': true,
    'workbench.iconTheme': 'vs-seti',
    'explorer.compactFolders': true,
  }
}

export function readStoredAppearance(): HanzoAppearance {
  try {
    if (typeof localStorage === 'undefined') return 'dark'
    const v = localStorage.getItem(HANZO_IAM_DEFAULTS.themeStorageKey)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyDocumentAppearance(appearance: HanzoAppearance): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.hanzoTheme = appearance
    document.documentElement.classList.toggle('light', appearance === 'light')
    document.documentElement.classList.toggle('dark', appearance === 'dark')
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HANZO_IAM_DEFAULTS.themeStorageKey, appearance)
    }
  } catch {
    /* ignore storage restrictions */
  }
}
