// Unified Account, Usage & Billing views for Hanzo IDE Settings.
//
// Queries `https://api.hanzo.ai/v1/billing/summary` and `https://api.hanzo.ai/v1/usage`
// with `Authorization: Bearer <token>` and `X-Org-Id` (`orgHeaders()`), matching
// Hanzo Dev, Hanzo App, and Hanzo Team.

import { invoke } from '@tauri-apps/api/core'
import { tauri } from './tauri.ts'
import { activeOrg, orgHeaders, orgs, setActiveOrg, signOut, token, user } from './iam.ts'
import { HANZO_IAM_DEFAULTS } from './theme.ts'
import { openSignInModal } from './signin-modal.ts'

interface AuthStatus {
  identity: string | null
  org: string | null
  signed_in: boolean
}

interface BillingSummary {
  plan?: string
  tier?: string
  balance?: number
  credit_balance?: number
  credits_usd?: number
  monthly_spend?: number
  spend_usd?: number
  currency?: string
}

interface UsageSummary {
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
  requests?: number
  monthly_spend_usd?: number
  cost_usd?: number
}

function openExternalUrl(url: string): void {
  if (tauri()) {
    void invoke('open_external', { url }).catch(() => {
      window.open(url, '_blank', 'noopener')
    })
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

async function resolveBearerToken(): Promise<string | null> {
  const iamTok = await token().catch(() => null)
  if (iamTok) return iamTok
  if (tauri()) {
    try {
      const cfg = await invoke<any>('engine_get_config')
      const hanzoProv = (cfg?.providers ?? []).find((p: any) => p.id === 'hanzo')
      if (hanzoProv?.api_key) return String(hanzoProv.api_key)
    } catch {
      /* ignore */
    }
  }
  return null
}

async function resolveAccountState(): Promise<AuthStatus> {
  if (tauri()) {
    try {
      const st = await invoke<AuthStatus>('auth_status')
      if (st.signed_in) return st
    } catch {
      /* fallback */
    }
  }
  const tok = await token().catch(() => null)
  if (!tok) return { identity: null, org: null, signed_in: false }
  const u = await user().catch(() => null)
  return {
    identity: u?.name || u?.email || 'Hanzo User',
    org: u?.owner ?? null,
    signed_in: true,
  }
}

function fmtUsd(val: number | undefined | null): string {
  if (typeof val !== 'number' || Number.isNaN(val)) return '$0.00'
  return `$${val.toFixed(2)}`
}

function fmtCount(val: number | undefined | null): string {
  if (typeof val !== 'number' || Number.isNaN(val)) return '0'
  return val.toLocaleString()
}

function makeStatBox(label: string, value: string, sub?: string): HTMLDivElement {
  const box = document.createElement('div')
  box.style.cssText =
    'padding:14px 16px;background:#0d0d10;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:4px'
  const l = document.createElement('div')
  l.style.cssText = 'font-size:11px;font-weight:500;color:#a1a1aa'
  l.textContent = label
  const v = document.createElement('div')
  v.style.cssText = 'font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#fafafa'
  v.textContent = value
  box.append(l, v)
  if (sub) {
    const s = document.createElement('div')
    s.style.cssText = 'font-size:11px;color:#71717a'
    s.textContent = sub
    box.appendChild(s)
  }
  return box
}

export async function renderAccountAndBillingSection(
  body: HTMLElement,
  onCloseModal: () => void,
  onRefresh: () => void,
): Promise<void> {
  const auth = await resolveAccountState()

  const accountCard = document.createElement('div')
  accountCard.className = 'hz-settings-card'

  const row = document.createElement('div')
  row.className = 'hz-settings-row'
  const meta = document.createElement('div')
  meta.className = 'hz-settings-meta'
  const title = document.createElement('div')
  title.className = 'hz-settings-title'
  const desc = document.createElement('div')
  desc.className = 'hz-settings-desc'

  const currentOrg = activeOrg() || auth.org || 'hanzo'
  if (auth.signed_in && !activeOrg() && auth.org) {
    setActiveOrg(auth.org)
  }

  title.textContent = auth.signed_in
    ? `${auth.identity || 'Signed in'} · ${currentOrg}`
    : 'Not signed in (Local-First Mode)'
  desc.textContent = auth.signed_in
    ? `Authenticated via ${HANZO_IAM_DEFAULTS.domainLabel} (${HANZO_IAM_DEFAULTS.orgHeader}: ${currentOrg})`
    : 'Sign in with Hanzo ID to view unified account credits, org billing, and Zen cloud usage across all Hanzo apps.'
  meta.append(title, desc)

  const authBtn = document.createElement('button')
  authBtn.type = 'button'
  authBtn.className = auth.signed_in ? 'hz-settings-btn' : 'hz-settings-btn hz-settings-btn--primary'
  authBtn.textContent = auth.signed_in ? 'Sign Out' : 'Sign in to Hanzo IDE'
  authBtn.addEventListener('click', async () => {
    if (auth.signed_in) {
      if (tauri()) await invoke('auth_logout').catch(() => {})
      else await signOut().catch(() => {})
      onRefresh()
    } else {
      onCloseModal()
      openSignInModal({ mode: 'modal' })
    }
  })

  row.append(meta, authBtn)
  accountCard.appendChild(row)

  if (auth.signed_in) {
    const orgList = await orgs().catch(() => [currentOrg])
    const uniqueOrgs = Array.from(new Set([currentOrg, ...orgList].filter(Boolean)))
    const orgRow = document.createElement('div')
    orgRow.className = 'hz-settings-row'
    const orgMeta = document.createElement('div')
    orgMeta.className = 'hz-settings-meta'
    orgMeta.innerHTML = `<div class="hz-settings-title">Active Organization (${HANZO_IAM_DEFAULTS.orgHeader})</div><div class="hz-settings-desc">Routes API, usage, and billing requests to the selected organization.</div>`

    const orgChips = document.createElement('div')
    orgChips.className = 'hz-settings-chips'
    for (const orgName of uniqueOrgs) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'hz-settings-chip'
      chip.textContent = orgName
      chip.setAttribute('aria-selected', String(orgName === currentOrg))
      chip.addEventListener('click', () => {
        setActiveOrg(orgName)
        onRefresh()
      })
      orgChips.appendChild(chip)
    }
    orgRow.append(orgMeta, orgChips)
    accountCard.appendChild(orgRow)
  }

  body.appendChild(accountCard)

  // Live Billing + Usage telemetry when signed in
  const bearer = auth.signed_in ? await resolveBearerToken() : null
  let billing: BillingSummary | null = null
  let usage: UsageSummary | null = null

  if (bearer) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
      ...orgHeaders(),
    }
    const base = import.meta.env.VITE_HANZO_API_URL ?? 'https://api.hanzo.ai'
    ;[billing, usage] = await Promise.all([
      fetch(`${base}/v1/billing/summary`, { headers })
        .then((r) => (r.ok ? (r.json() as Promise<BillingSummary>) : null))
        .catch(() => null),
      fetch(`${base}/v1/usage`, { headers })
        .then((r) => (r.ok ? (r.json() as Promise<UsageSummary>) : null))
        .catch(() => null),
    ])
  }

  const planName = billing?.plan || billing?.tier || (auth.signed_in ? 'Developer' : 'Local Free')
  const credits = billing?.credit_balance ?? billing?.credits_usd ?? billing?.balance ?? 0
  const spend =
    billing?.monthly_spend ?? billing?.spend_usd ?? usage?.monthly_spend_usd ?? usage?.cost_usd ?? 0
  const totalTokens =
    usage?.total_tokens ?? ((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0))

  const statsGrid = document.createElement('div')
  statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px'
  statsGrid.append(
    makeStatBox('Active Plan', String(planName), auth.signed_in ? `Org: ${currentOrg}` : '100% local features unlocked'),
    makeStatBox('Credit Balance', auth.signed_in ? fmtUsd(credits) : '—', 'Shared across Hanzo Dev, IDE & App'),
    makeStatBox('Monthly Spend', auth.signed_in ? fmtUsd(spend) : '—', 'Current billing period'),
    makeStatBox(
      'Token Usage',
      auth.signed_in ? fmtCount(totalTokens) : 'Local',
      usage?.requests ? `${fmtCount(usage.requests)} API requests` : 'Zen & cloud completions',
    ),
  )
  body.appendChild(statsGrid)

  const payCard = document.createElement('div')
  payCard.className = 'hz-settings-card'
  const payRow = document.createElement('div')
  payRow.className = 'hz-settings-row'
  const payMeta = document.createElement('div')
  payMeta.className = 'hz-settings-meta'
  payMeta.innerHTML =
    '<div class="hz-settings-title">Billing & Credits</div><div class="hz-settings-desc">Top up credits, manage payment methods, invoices, and team seats on Hanzo Pay.</div>'
  const payBtn = document.createElement('button')
  payBtn.type = 'button'
  payBtn.className = 'hz-settings-btn hz-settings-btn--primary'
  payBtn.textContent = 'Manage Billing & Top Up →'
  payBtn.addEventListener('click', () => openExternalUrl('https://hanzo.ai/pay'))
  payRow.append(payMeta, payBtn)
  payCard.appendChild(payRow)
  body.appendChild(payCard)
}
