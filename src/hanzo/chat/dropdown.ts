// Custom Solid #121214 (Dark) / #ffffff (Light) Dropdown Popover for Hanzo Chat.
// Replaces native GTK/OS <select> elements so menus stay 100% crisp and opaque.

export interface ChatDropdownOption {
  value: string
  label: string
  hint?: string
}

export interface ChatDropdownHandle {
  button: HTMLButtonElement
  getValue(): string
  setValue(value: string, silent?: boolean): void
  setOptions(options: ChatDropdownOption[], selectedValue?: string): void
  dispose(): void
}

export interface CreateChatDropdownInit {
  ariaLabel: string
  title?: string
  variant?: 'header' | 'pill'
  prefixIcon?: string
  placeholderLabel?: string
  options: ChatDropdownOption[]
  initialValue?: string
  align?: 'left' | 'right'
  openDirection?: 'down' | 'up'
  onChange: (value: string) => void
}

const SVG_CHEVRON =
  '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>'

const SVG_CHECK =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5"/></svg>'

export function createChatDropdown(init: CreateChatDropdownInit): ChatDropdownHandle {
  let options: ChatDropdownOption[] = [...init.options]
  let currentValue = init.initialValue ?? options[0]?.value ?? ''
  let menuEl: HTMLDivElement | null = null

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className =
    init.variant === 'header' ? 'hanzo-chat-dropdown-header' : 'hanzo-chat-dropdown-pill'
  btn.setAttribute('aria-label', init.ariaLabel)
  btn.setAttribute('aria-haspopup', 'listbox')
  btn.setAttribute('aria-expanded', 'false')
  if (init.title) btn.title = init.title

  const labelEl = document.createElement('span')
  labelEl.className = 'hanzo-chat-dropdown-label'

  const chevronWrap = document.createElement('span')
  chevronWrap.className = 'hanzo-chat-dropdown-chevron'
  chevronWrap.innerHTML = SVG_CHEVRON

  if (init.prefixIcon) {
    const icon = document.createElement('span')
    icon.className = `codicon ${init.prefixIcon}`
    icon.style.fontSize = '11px'
    btn.appendChild(icon)
  }
  btn.append(labelEl, chevronWrap)

  function syncButtonLabel(): void {
    const match = options.find((o) => o.value === currentValue)
    labelEl.textContent = match?.label || init.placeholderLabel || currentValue || 'Auto'
  }
  syncButtonLabel()

  function closeMenu(): void {
    if (!menuEl) return
    menuEl.remove()
    menuEl = null
    btn.setAttribute('aria-expanded', 'false')
  }

  function openMenu(): void {
    if (menuEl) {
      closeMenu()
      return
    }
    if (options.length === 0) return

    const pop = document.createElement('div')
    pop.className = 'hanzo-chat-popover-menu'
    pop.setAttribute('role', 'listbox')
    pop.setAttribute('aria-label', init.ariaLabel)

    for (const opt of options) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'hanzo-chat-popover-item'
      row.setAttribute('role', 'option')
      const active = opt.value === currentValue
      row.setAttribute('aria-selected', String(active))

      const left = document.createElement('span')
      left.className = 'hanzo-chat-popover-item-text'
      left.textContent = opt.label
      row.appendChild(left)

      const right = document.createElement('span')
      right.className = 'hanzo-chat-popover-item-meta'
      if (active) {
        right.innerHTML = SVG_CHECK
      } else if (opt.hint) {
        right.textContent = opt.hint
      }
      row.appendChild(right)

      row.addEventListener('click', (e) => {
        e.stopPropagation()
        currentValue = opt.value
        syncButtonLabel()
        closeMenu()
        init.onChange(opt.value)
      })
      pop.appendChild(row)
    }

    document.body.appendChild(pop)
    menuEl = pop
    btn.setAttribute('aria-expanded', 'true')

    const rect = btn.getBoundingClientRect()
    const popRect = pop.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let leftPos =
      init.align === 'right' ? Math.round(rect.right - popRect.width) : Math.round(rect.left)
    leftPos = Math.max(8, Math.min(leftPos, vw - popRect.width - 8))
    pop.style.left = `${leftPos}px`

    const preferUp = init.openDirection === 'up' || rect.bottom + popRect.height + 12 > vh
    if (preferUp && rect.top > popRect.height + 12) {
      pop.style.bottom = `${Math.round(vh - rect.top + 6)}px`
      pop.style.top = 'auto'
    } else {
      pop.style.top = `${Math.round(rect.bottom + 6)}px`
      pop.style.bottom = 'auto'
    }
  }

  const onDocDown = (e: MouseEvent) => {
    if (!menuEl) return
    const t = e.target as Node | null
    if (t && (btn.contains(t) || menuEl.contains(t))) return
    closeMenu()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && menuEl) {
      e.stopPropagation()
      closeMenu()
    }
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    openMenu()
  })
  document.addEventListener('mousedown', onDocDown)
  window.addEventListener('keydown', onKeyDown)

  return {
    button: btn,
    getValue: () => currentValue,
    setValue(val: string, silent = true) {
      currentValue = val
      syncButtonLabel()
      if (!silent) init.onChange(val)
    },
    setOptions(next: ChatDropdownOption[], selectedValue?: string) {
      options = [...next]
      if (selectedValue !== undefined) currentValue = selectedValue
      syncButtonLabel()
    },
    dispose() {
      closeMenu()
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
