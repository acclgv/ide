import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  HANZO_DEFAULT_KEYBINDINGS,
  HANZO_IAM_DEFAULTS,
  HANZO_LIGHT_PALETTE,
  HANZO_OBSIDIAN_PALETTE,
  HANZO_OLLAMA_MODEL_PRESETS,
  HANZO_SHELL_GEOMETRY,
  HANZO_ZEN_MODEL_PRESETS,
  buildWorkbenchColorCustomizations,
  buildWorkbenchConfigurationDefaults,
  isAllowedModelId,
} from '../src/hanzo/theme.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Hanzo Dark / Obsidian & Hanzo Light palettes match Unified Shell tokens', () => {
  assert.equal(HANZO_OBSIDIAN_PALETTE.appearance, 'dark')
  assert.equal(HANZO_OBSIDIAN_PALETTE.floor, '#090909')
  assert.equal(HANZO_OBSIDIAN_PALETTE.rail, '#090909')
  assert.equal(HANZO_OBSIDIAN_PALETTE.sidebar, '#0c0c0c')
  assert.equal(HANZO_OBSIDIAN_PALETTE.stage, '#111114')
  assert.equal(HANZO_OBSIDIAN_PALETTE.border, '#222226')
  assert.equal(HANZO_OBSIDIAN_PALETTE.inkPrimary, '#fafafa')
  assert.equal(HANZO_OBSIDIAN_PALETTE.inkSecondary, '#a1a1aa')
  assert.equal(HANZO_OBSIDIAN_PALETTE.inkMuted, '#71717a')
  assert.equal(HANZO_OBSIDIAN_PALETTE.accent, '#ffffff')
  assert.equal(HANZO_OBSIDIAN_PALETTE.accentPill, '#e4e4e7')
  assert.equal(HANZO_OBSIDIAN_PALETTE.statusLive, '#10b981')
  assert.equal(HANZO_OBSIDIAN_PALETTE.statusWarning, '#f59e0b')
  assert.equal(HANZO_OBSIDIAN_PALETTE.statusError, '#ef4444')

  assert.equal(HANZO_LIGHT_PALETTE.appearance, 'light')
  assert.equal(HANZO_LIGHT_PALETTE.floor, '#f8f8fa')
  assert.equal(HANZO_LIGHT_PALETTE.stage, '#ffffff')
  assert.equal(HANZO_LIGHT_PALETTE.border, '#e4e4e7')
  assert.equal(HANZO_LIGHT_PALETTE.inkPrimary, '#18181b')
  assert.equal(HANZO_LIGHT_PALETTE.accent, '#18181b')
})

test('Shell geometry enforces 40-44px titlebar, 240-260px sidebar, and 8px pill rows', () => {
  assert.ok(
    HANZO_SHELL_GEOMETRY.titlebarHeightPx >= 40 && HANZO_SHELL_GEOMETRY.titlebarHeightPx <= 44,
  )
  assert.ok(
    HANZO_SHELL_GEOMETRY.sidebarDefaultWidthPx >= 240 &&
      HANZO_SHELL_GEOMETRY.sidebarDefaultWidthPx <= 260,
  )
  assert.equal(HANZO_SHELL_GEOMETRY.pillRowRadiusPx, 8)
})

test('Default keybindings include ⌘B, ⌘K, ⇧⌘P, ⌘,, and ⌥⌘B', () => {
  const macShortcuts = new Map(HANZO_DEFAULT_KEYBINDINGS.map((k) => [k.mac, k.command]))
  assert.equal(macShortcuts.get('⌘B'), 'workbench.action.toggleSidebarVisibility')
  assert.equal(macShortcuts.get('⌘K'), 'hanzo.commandOrInlineEdit')
  assert.equal(macShortcuts.get('⇧⌘P'), 'workbench.action.showCommands')
  assert.equal(macShortcuts.get('⌘,'), 'workbench.action.openSettings')
  assert.equal(macShortcuts.get('⌥⌘B'), 'workbench.action.toggleAuxiliaryBar')
})

test('Workbench color customizations contain zero VS Code blue/purple defaults', () => {
  const dark = buildWorkbenchColorCustomizations('dark')
  const serialized = JSON.stringify(dark).toLowerCase()
  assert.ok(!serialized.includes('#007acc'), 'must not use legacy VS Code blue #007acc')
  assert.ok(!serialized.includes('#0078d4'), 'must not use default VS Code blue #0078d4')
  assert.ok(!serialized.includes('#68217a'), 'must not use VS Code no-folder purple #68217a')

  const defaults = buildWorkbenchConfigurationDefaults()
  assert.equal(defaults['window.commandCenter'], true)
  assert.equal(defaults['window.menuBarVisibility'], 'hidden')
  assert.ok(String(defaults['editor.fontFamily']).includes('Zen Mono'))
})

test('Zen 6 and Qwen3+ model policy rejects all qwen2 and legacy zen4/zen5 models', () => {
  assert.deepEqual(HANZO_ZEN_MODEL_PRESETS, [
    'zen6',
    'zen6-coder',
    'zen6-flash',
    'zen6-max',
    'zen6-free',
    'zen-vl',
  ])
  for (const m of [...HANZO_ZEN_MODEL_PRESETS, ...HANZO_OLLAMA_MODEL_PRESETS]) {
    assert.equal(isAllowedModelId(m), true, `expected ${m} to be allowed`)
  }
  assert.equal(isAllowedModelId('zen'), true)
  assert.equal(isAllowedModelId('qwen3-coder:30b'), true)
  assert.equal(isAllowedModelId('qwen3:8b'), true)
  assert.equal(isAllowedModelId('qwen2.5-coder:7b'), false)
  assert.equal(isAllowedModelId('qwen2:7b'), false)
  assert.equal(isAllowedModelId('qwen/qwen-2.5-coder-32b-instruct'), false)
  assert.equal(isAllowedModelId('zen' + '5-coder'), false)
  assert.equal(isAllowedModelId('zen' + '4-max'), false)
})

test('IAM config uses hanzo.id and X-Org-Id multi-tenant header', () => {
  assert.equal(HANZO_IAM_DEFAULTS.issuer, 'https://hanzo.id')
  assert.equal(HANZO_IAM_DEFAULTS.domainLabel, 'hanzo.id')
  assert.equal(HANZO_IAM_DEFAULTS.clientId, 'hanzo-ide')
  assert.equal(HANZO_IAM_DEFAULTS.orgHeader, 'X-Org-Id')
})

test('tokens.css defines both dark obsidian and light alabaster schemes', () => {
  const css = fs.readFileSync(path.join(rootDir, 'src/styles/tokens.css'), 'utf8')
  assert.ok(css.includes('--hanzo-floor:           #090909;'))
  assert.ok(css.includes('--hanzo-bg:              #111114;'))
  assert.ok(css.includes('--hanzo-border:          #222226;'))
  assert.ok(css.includes('--hanzo-success:         #10b981;'))
  assert.ok(css.includes('--hanzo-warning:         #f59e0b;'))
  assert.ok(css.includes('--hanzo-error:           #ef4444;'))
  assert.ok(css.includes("[data-hanzo-theme='light']"))
  assert.ok(css.includes('--hanzo-floor:           #f8f8fa;'))
})
