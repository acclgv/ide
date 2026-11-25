// Hanzo Chat — File Attachments, `@` Mentions & `/mcp` Tool Picker (`@file`, `@git`, `/mcp:*`).

import { invoke } from '@tauri-apps/api/core'
import { HANZO_HIP0300_CORE_TOOLS } from '../mcp-catalog.ts'
import { getMcpRuntimeSummary, openMcpToolRunnerModal } from '../mcp-drawer.ts'
import { S } from './state.ts'
import { renderAttachBar } from './render.ts'

function insertAtCaret(textarea: HTMLTextAreaElement, text: string): void {
  const pos = textarea.selectionStart
  textarea.value = textarea.value.slice(0, pos) + text + textarea.value.slice(pos)
  const newPos = pos + text.length
  textarea.setSelectionRange(newPos, newPos)
  textarea.dispatchEvent(new Event('input'))
  textarea.focus()
}

export async function attachGitDiff(textarea: HTMLTextAreaElement): Promise<void> {
  try {
    const { getWorkspace } = await import('../ide-context.ts')
    const ws = getWorkspace()
    if (!ws) {
      insertAtCaret(textarea, '\n(no project folder open)\n')
      return
    }
    const staged = await invoke<Array<{ path: string; patch: string }>>('git_diff', {
      repoPath: ws,
      staged: true,
    }).catch(() => [])
    const unstaged = await invoke<Array<{ path: string; patch: string }>>('git_diff', {
      repoPath: ws,
      staged: false,
    }).catch(() => [])
    const all = [...(staged ?? []), ...(unstaged ?? [])]
    if (all.length === 0) {
      insertAtCaret(textarea, '\n(no git changes)\n')
      return
    }
    let body = ''
    let budget = 8000
    for (const d of all) {
      const block = `### ${d.path}\n${d.patch}\n`
      if (budget - block.length < 0) {
        body += '\n[diff truncated]\n'
        break
      }
      body += block
      budget -= block.length
    }
    insertAtCaret(textarea, `\n\nMy current git changes:\n\`\`\`diff\n${body}\`\`\`\n`)
  } catch (e) {
    console.warn('[hanzo-chat] @git attach failed:', e)
  }
}

export async function pickAndAttach(insertMention: boolean): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const picked = await open({ multiple: true, directory: false }).catch(() => null)
    if (!picked) return
    const files = Array.isArray(picked) ? picked : [picked]
    for (const f of files) {
      try {
        const content = await readTextFile(f)
        const name = f.split(/[\\/]/).pop() ?? f
        S.attachments.push({ name, content, isImage: false })
        renderAttachBar()
        if (insertMention && S.textarea) {
          const pos = S.textarea.selectionStart ?? S.textarea.value.length
          const before = S.textarea.value.slice(0, pos)
          const after = S.textarea.value.slice(pos)
          const prefix = before.endsWith('@') ? before.slice(0, -1) : before
          S.textarea.value = `${prefix}@${name} ${after}`
          const newPos = prefix.length + name.length + 2
          S.textarea.setSelectionRange(newPos, newPos)
          S.textarea.dispatchEvent(new Event('input'))
          S.textarea.focus()
        }
      } catch {
        /* skip unreadable */
      }
    }
  } catch (e) {
    console.warn('[hanzo-chat] pickAndAttach failed:', e)
  }
}

let activeMentionCleanup: (() => void) | null = null

export async function openMentionOrMcpPicker(
  textarea: HTMLTextAreaElement,
  anchorEl?: HTMLElement,
): Promise<void> {
  activeMentionCleanup?.()

  let participants: Array<{ id: string; fullName?: string }> = []
  try {
    const mod = await import('../extension-chat-participants.ts')
    participants = mod.listParticipants()
  } catch {
    participants = []
  }

  const summary = getMcpRuntimeSummary()
  const mcpToolNames =
    summary.liveTools.length > 0
      ? summary.liveTools.slice(0, 10).map((t) => ({
          id: `mcp_${t.server_id}_${t.name}`,
          short: `/mcp:${t.name}`,
          hint: t.server_id === 'hanzo' ? 'HIP-0300' : t.server_name,
        }))
      : HANZO_HIP0300_CORE_TOOLS.slice(0, 8).map((name) => ({
          id: `mcp_hanzo_${name}`,
          short: `/mcp:${name}`,
          hint: 'HIP-0300',
        }))

  type PickerItem = {
    kind: 'file' | 'git' | 'mcp-tool' | 'mcp-runner' | 'participant'
    id: string
    label: string
    hint?: string
  }

  const items: PickerItem[] = [
    { kind: 'file', id: 'file', label: '@file · Attach file…', hint: 'Disk' },
    { kind: 'git', id: 'git', label: '@git · Working-tree diff', hint: 'Git' },
    ...mcpToolNames.map((t) => ({
      kind: 'mcp-tool' as const,
      id: t.id,
      label: t.short,
      hint: t.hint,
    })),
    { kind: 'mcp-runner', id: 'runner', label: '▷ Run MCP tool interactively…', hint: 'Inspector' },
    ...participants.map((p) => ({
      kind: 'participant' as const,
      id: p.id,
      label: `@${p.id}`,
      hint: p.fullName,
    })),
  ]

  const menu = document.createElement('div')
  menu.className = 'hanzo-chat-popover-menu'
  const rect = (anchorEl ?? textarea).getBoundingClientRect()
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 252, Math.round(rect.left)))}px`
  menu.style.bottom = `${Math.max(12, Math.round(window.innerHeight - rect.top + 6))}px`
  menu.style.top = 'auto'

  let activeIdx = 0
  const rows: HTMLButtonElement[] = []

  function setActive(i: number): void {
    activeIdx = i
    rows.forEach((r, idx) => r.setAttribute('aria-selected', String(idx === activeIdx)))
  }

  function dismiss(): void {
    menu.remove()
    textarea.removeEventListener('keydown', onKey, true)
    document.removeEventListener('mousedown', onDocDown)
    activeMentionCleanup = null
  }

  function stripTrailingTrigger(): void {
    const pos = textarea.selectionStart
    const ch = textarea.value.slice(pos - 1, pos)
    if (ch === '@' || ch === '/') {
      textarea.value = textarea.value.slice(0, pos - 1) + textarea.value.slice(pos)
      textarea.setSelectionRange(pos - 1, pos - 1)
    }
  }

  function choose(idx: number): void {
    const it = items[idx]
    dismiss()
    if (!it) return
    if (it.kind === 'file') {
      stripTrailingTrigger()
      void pickAndAttach(true)
    } else if (it.kind === 'git') {
      stripTrailingTrigger()
      void attachGitDiff(textarea)
    } else if (it.kind === 'mcp-runner') {
      stripTrailingTrigger()
      openMcpToolRunnerModal()
    } else if (it.kind === 'mcp-tool') {
      stripTrailingTrigger()
      insertAtCaret(textarea, `Use \`${it.id}\` to `)
    } else {
      stripTrailingTrigger()
      insertAtCaret(textarea, `@${it.id} `)
    }
  }

  items.forEach((item, idx) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'hanzo-chat-popover-item'
    row.innerHTML = `<span class="hanzo-chat-popover-item-text">${item.label}</span><span class="hanzo-chat-popover-item-meta">${item.hint ?? ''}</span>`
    row.addEventListener('mouseenter', () => setActive(idx))
    row.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      choose(idx)
    })
    rows.push(row)
    menu.appendChild(row)
  })

  function onKey(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setActive(Math.min(activeIdx + 1, items.length - 1))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive(Math.max(activeIdx - 1, 0))
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      choose(activeIdx)
    } else if (ev.key === 'Escape' || ev.key === ' ') {
      if (ev.key === 'Escape') ev.preventDefault()
      dismiss()
    }
  }

  function onDocDown(ev: MouseEvent): void {
    const t = ev.target as Node | null
    if (t && (menu.contains(t) || anchorEl?.contains(t))) return
    dismiss()
  }

  setActive(0)
  document.body.appendChild(menu)
  textarea.addEventListener('keydown', onKey, true)
  setTimeout(() => document.addEventListener('mousedown', onDocDown), 0)
  activeMentionCleanup = dismiss
}

export function installMentionSupport(textarea: HTMLTextAreaElement): () => void {
  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === '@' || e.key === '/') {
      const pos = textarea.selectionStart
      const before = textarea.value.slice(0, pos)
      if (before === '' || /[\s\n]$/.test(before)) {
        requestAnimationFrame(() => void openMentionOrMcpPicker(textarea))
      }
    }
  }

  textarea.addEventListener('keydown', onTriggerKey)
  return () => {
    activeMentionCleanup?.()
    textarea.removeEventListener('keydown', onTriggerKey)
  }
}
