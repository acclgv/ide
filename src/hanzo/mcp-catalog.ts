/**
 * Hanzo IDE — HIP-0300 MCP Catalog, Native IDE Capability Suites, & Quick-File Helpers.
 *
 * Pure data + pure configuration builders (zero browser-only top-level side effects
 * so unit tests in `test/theme.test.ts` can verify every preset & quick-file rule).
 */

import type { ZenIconName } from './brand.ts'

export interface NativeIdeCapabilitySpec {
  id: 'filesystem' | 'sandbox' | 'ast' | 'memory' | 'git' | 'lsp' | 'browser'
  name: string
  subtitle: string
  icon: ZenIconName
  tools: readonly string[]
  defaultEnabled: boolean
}

export const HANZO_NATIVE_IDE_CAPABILITIES: readonly NativeIdeCapabilitySpec[] = [
  {
    id: 'filesystem',
    name: 'Filesystem & Patch',
    subtitle: 'Workspace read, write, atomic patch & diff review',
    icon: 'folder',
    tools: ['ide_read_file', 'ide_write_file', 'ide_apply_edit', 'ide_list_dir'],
    defaultEnabled: true,
  },
  {
    id: 'sandbox',
    name: 'Execution Sandbox',
    subtitle: 'JS/WASM multi-step batching & PTY shell commands',
    icon: 'terminalPrompt',
    tools: ['execute_code', 'ide_run_command'],
    defaultEnabled: true,
  },
  {
    id: 'ast',
    name: 'AST & Call Graph',
    subtitle: 'Tree-sitter callers, callees, impact & type hierarchy',
    icon: 'cpu',
    tools: ['ide_ast_callers', 'ide_ast_callees', 'ide_ast_impact', 'ide_ast_type_info'],
    defaultEnabled: true,
  },
  {
    id: 'memory',
    name: 'Engram Semantic Memory',
    subtitle: 'Vector codebase context & Memory Palace recall',
    icon: 'layers',
    tools: ['ide_search_semantic', 'ide_get_codebase_context', 'memory_search', 'memory_store'],
    defaultEnabled: true,
  },
  {
    id: 'git',
    name: 'Git & Checkpoints',
    subtitle: 'Diff, staging, branches & instant restore checkpoints',
    icon: 'git',
    tools: ['git_status', 'git_diff', 'git_checkpoint_create', 'git_checkpoint_restore'],
    defaultEnabled: true,
  },
  {
    id: 'lsp',
    name: 'LSP & DAP Debugger',
    subtitle: 'Live Monaco diagnostics, symbols & debug adapters',
    icon: 'debug',
    tools: ['ide_get_diagnostics', 'lsp_list', 'dap_start'],
    defaultEnabled: true,
  },
  {
    id: 'browser',
    name: 'Integrated Browser',
    subtitle: 'Live localhost & documentation preview stage',
    icon: 'browser',
    tools: ['ide_open_browser_preview'],
    defaultEnabled: true,
  },
] as const

/** Canonical HIP-0300 unified tools exposed by `hanzo-mcp`. */
export const HANZO_HIP0300_CORE_TOOLS = [
  'fs',
  'exec',
  'code',
  'git',
  'fetch',
  'think',
  'memory',
  'plan',
  'kai',
  'ui',
  'workspace',
  'browser',
  'tasks',
  'coding',
  'research',
  'skills',
  'hanzo',
] as const

export interface McpServerConfigPayload {
  id: string
  name: string
  transport: 'stdio' | 'sse' | 'streamable_http'
  command: string
  args: string[]
  env: Record<string, string>
  url: string
  enabled: boolean
}

export interface McpCatalogPreset {
  id: string
  name: string
  badge: string
  subtitle: string
  icon: ZenIconName
  transport: 'stdio' | 'sse' | 'streamable_http'
  command: string
  args: readonly string[]
  url: string
  displaySpec: string
  featuredTools?: readonly string[]
}

export const HANZO_MCP_BINARY_CANDIDATES = [
  '/home/z/.local/bin/hanzo-mcp',
  '/home/z/.hanzo/bin/hanzo-mcp',
  '~/.local/bin/hanzo-mcp',
  '~/.hanzo/bin/hanzo-mcp',
] as const

export const HANZO_MCP_CATALOG_PRESETS: readonly McpCatalogPreset[] = [
  {
    id: 'hanzo',
    name: 'Hanzo MCP (HIP-0300)',
    badge: 'HIP-0300',
    subtitle: 'Unified fs, exec, code, git, fetch, think, memory, plan, kai & ui tools',
    icon: 'integrations',
    transport: 'stdio',
    command: 'hanzo-mcp',
    args: ['--transport', 'stdio'],
    url: '',
    displaySpec: 'hanzo-mcp serve · stdio',
    featuredTools: ['fs', 'exec', 'code', 'git', 'fetch', 'think', 'memory', 'plan'],
  },
  {
    id: 'hanzod',
    name: 'Hanzo Local Node (hanzod)',
    badge: '127.0.0.1:3690',
    subtitle: 'Local Hanzo AI node, router & ZAP workspace mesh',
    icon: 'globe',
    transport: 'streamable_http',
    command: '',
    args: [],
    url: 'http://127.0.0.1:3690/mcp',
    displaySpec: 'http://127.0.0.1:3690/mcp',
  },
  {
    id: 'github',
    name: 'GitHub MCP',
    badge: 'stdio',
    subtitle: 'Pull requests, issues, code search, workflows & releases',
    icon: 'git',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    url: '',
    displaySpec: 'npx -y @modelcontextprotocol/server-github',
  },
  {
    id: 'playwright',
    name: 'Browser / Playwright MCP',
    badge: 'stdio',
    subtitle: 'DOM snapshots, browser automation & visual verification',
    icon: 'browser',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    url: '',
    displaySpec: 'npx -y @playwright/mcp@latest',
  },
  {
    id: 'database',
    name: 'PostgreSQL / SQLite MCP',
    badge: 'stdio',
    subtitle: 'Schema inspection, read-only SQL queries & migrations',
    icon: 'layers',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    url: '',
    displaySpec: 'npx -y @modelcontextprotocol/server-postgres',
  },
] as const

export function buildMcpServerConfigFromPreset(
  preset: McpCatalogPreset,
  opts: { resolvedBinary?: string | null; workspacePath?: string | null } = {},
): McpServerConfigPayload {
  const isHanzo = preset.id === 'hanzo'
  const command =
    isHanzo && opts.resolvedBinary ? opts.resolvedBinary : preset.command
  const args = [...preset.args]
  if (isHanzo && opts.workspacePath) {
    args.push('--project-dir', opts.workspacePath)
  }
  return {
    id: preset.id,
    name: preset.name,
    transport: preset.transport,
    command,
    args,
    env: {},
    url: preset.url,
    enabled: true,
  }
}

export function buildDefaultToolSampleArgs(
  toolName: string,
  workspacePath?: string | null,
): string {
  const ws = workspacePath || '.'
  const defaults: Record<string, Record<string, unknown>> = {
    fs: { action: 'list', uri: ws, depth: 1 },
    exec: { action: 'ps' },
    code: { action: 'outline', uri: ws },
    git: { action: 'status', cwd: ws },
    fetch: { action: 'help' },
    think: { action: 'models' },
    memory: { action: 'help' },
    plan: { action: 'help' },
    workspace: { action: 'detect', cwd: ws },
    kai: { action: 'help' },
    ui: { action: 'help' },
    tasks: { action: 'list' },
    skills: { action: 'list' },
    hanzo: {},
  }
  const sample = defaults[toolName] ?? {}
  return JSON.stringify(sample, null, 2)
}

// ── Native IDE Capability Enable/Disable State ────────────────────────────

const NATIVE_CAPS_STORAGE_KEY = 'hanzo.ide.nativeCapabilities.v1'
const AUTO_CONNECT_HANZO_KEY = 'hanzo.ide.mcpAutoConnectHanzo'

export function readNativeCapabilityStates(): Record<string, boolean> {
  const base: Record<string, boolean> = {}
  for (const cap of HANZO_NATIVE_IDE_CAPABILITIES) {
    base[cap.id] = cap.defaultEnabled
  }
  try {
    if (typeof localStorage === 'undefined') return base
    const raw = localStorage.getItem(NATIVE_CAPS_STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const cap of HANZO_NATIVE_IDE_CAPABILITIES) {
      if (typeof parsed[cap.id] === 'boolean') {
        base[cap.id] = parsed[cap.id] as boolean
      }
    }
  } catch {
    /* ignore */
  }
  return base
}

export function setNativeCapabilityEnabled(id: string, enabled: boolean): Record<string, boolean> {
  const next = { ...readNativeCapabilityStates(), [id]: enabled }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NATIVE_CAPS_STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    /* ignore */
  }
  return next
}

export function countEnabledNativeTools(states = readNativeCapabilityStates()): number {
  let count = 0
  for (const cap of HANZO_NATIVE_IDE_CAPABILITIES) {
    if (states[cap.id] !== false) count += cap.tools.length
  }
  return count
}

export function isHanzoMcpAutoConnectEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true
    return localStorage.getItem(AUTO_CONNECT_HANZO_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setHanzoMcpAutoConnectEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_CONNECT_HANZO_KEY, enabled ? 'true' : 'false')
    }
  } catch {
    /* ignore */
  }
}

// ── Quick-File & Top Bar Pill Pure Helpers (Zed Speed) ─────────────────────

export interface QuickLaunchInfo {
  quickFile: string | null
  line: number | null
  column: number | null
  workspaceFolder: string | null
  zenLayout: string | null
}

export function parseQuickFileTargetFromLocation(
  search: string,
  hash: string,
): QuickLaunchInfo {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const quickFile = params.get('quickFile')?.trim() || null
  const rawLine = params.get('line')
  const rawCol = params.get('col')
  const line = rawLine && /^\d+$/.test(rawLine) ? Number(rawLine) : null
  const column = rawCol && /^\d+$/.test(rawCol) ? Number(rawCol) : null
  const zenLayout = params.get('zenLayout')?.trim() || null

  let workspaceFolder: string | null = null
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  if (rawHash) {
    try {
      const decoded = decodeURIComponent(rawHash)
      if (decoded.startsWith('/') || decoded.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(decoded)) {
        workspaceFolder = decoded
      }
    } catch {
      /* ignore malformed hash */
    }
  }

  return { quickFile, line, column, workspaceFolder, zenLayout }
}

export function formatQuickTopbarLabel(opts: {
  workspacePath: string | null
  activeFilePath: string | null
  isUntitledScratch: boolean
  untitledLabel?: string | null
}): { label: string; kind: 'workspace' | 'quick-file' | 'scratch' | 'empty' } {
  if (opts.workspacePath) {
    const parts = opts.workspacePath.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean)
    const label =
      parts.length >= 2
        ? `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`
        : parts[parts.length - 1] || opts.workspacePath
    return { label, kind: 'workspace' }
  }
  if (opts.isUntitledScratch) {
    return { label: opts.untitledLabel?.trim() || 'New file · Scratch', kind: 'scratch' }
  }
  if (opts.activeFilePath) {
    const parts = opts.activeFilePath.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean)
    const label =
      parts.length >= 2
        ? `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`
        : parts[parts.length - 1] || opts.activeFilePath
    return { label, kind: 'quick-file' }
  }
  return { label: '', kind: 'empty' }
}

const ZEN_RECENT_FOLDERS_KEY = 'hanzo.ide.recentFolders'

export function persistWorkspaceExplorerOpen(
  folderPath: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): void {
  if (!folderPath) return
  const store =
    storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return
  try {
    const key = `hanzo.ide.zenLayout.v2:${folderPath}`
    let prev: Record<string, unknown> = {}
    const raw = store.getItem(key)
    if (raw) {
      try {
        prev = JSON.parse(raw) as Record<string, unknown>
      } catch {
        prev = {}
      }
    }
    store.setItem(
      key,
      JSON.stringify({
        left: true,
        right: Boolean(prev.right),
        bottom: Boolean(prev.bottom),
        browser: false,
        integrations: false,
        leftView: 'Explorer',
        traditionalActivityBar: store.getItem('hanzo.ide.traditionalActivityBar') === 'true',
      }),
    )

    let recents: string[] = []
    const rawRecents = store.getItem(ZEN_RECENT_FOLDERS_KEY)
    if (rawRecents) {
      try {
        const parsed = JSON.parse(rawRecents)
        if (Array.isArray(parsed)) {
          recents = parsed.filter((p): p is string => typeof p === 'string' && p.length > 0)
        }
      } catch {
        recents = []
      }
    }
    const nextRecents = [folderPath, ...recents.filter((p) => p !== folderPath)].slice(0, 8)
    store.setItem(ZEN_RECENT_FOLDERS_KEY, JSON.stringify(nextRecents))
  } catch {
    /* ignore storage quota */
  }
}

const ENTRY_CANDIDATES = [
  'README.md',
  'readme.md',
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'index.ts',
  'main.ts',
  'main.rs',
  'lib.rs',
  'main.py',
  'main.go',
  'index.html',
] as const

export function pickPreferredEntryFile(
  entries: ReadonlyArray<{ name: string; is_dir: boolean }>,
): string | null {
  const files = entries.filter((e) => !e.is_dir && !e.name.startsWith('.'))
  for (const preferred of ENTRY_CANDIDATES) {
    const match = files.find((f) => f.name === preferred)
    if (match) return match.name
  }
  const textExt = /\.(ts|tsx|js|jsx|rs|py|go|md|toml|json|yaml|yml|css|html|sh|c|cpp|h)$/i
  const codeFile = files.find((f) => textExt.test(f.name))
  return codeFile?.name ?? null
}
