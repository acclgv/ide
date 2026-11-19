/**
 * Hanzo IAM, for the document OUTSIDE the shell (ide.hanzo.ai) and shared
 * `X-Org-Id` multi-tenant routing state.
 *
 * Inside Tauri the Rust side runs the CLI's own OIDC flow and holds the
 * credential in ~/.hanzo. Outside it, the SDK runs PKCE against hanzo.id and
 * completes the exchange on `/` on return.
 */
import { configureIam, getIam, getSession, getUser, handleCallback, logout, startLogin } from '@hanzo/iam'
import { HANZO_IAM_DEFAULTS } from './theme.ts'

configureIam({
  issuer: import.meta.env.VITE_HANZO_IAM_URL ?? HANZO_IAM_DEFAULTS.issuer,
  clientId: HANZO_IAM_DEFAULTS.clientId,
  redirect: `${location.origin}/`,
  scope: 'openid profile email offline_access',
})

export { startLogin as signIn, getSession as session, getUser as user, logout as signOut }

/** A live access token, renewed if it has expired; null when signed out. */
export const token = (): Promise<string | null> => getIam().getValidAccessToken()

/** Active organization slug persisted across launches (`X-Org-Id`). */
export function activeOrg(): string {
  try {
    return localStorage.getItem(HANZO_IAM_DEFAULTS.orgStorageKey)?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Persist active organization slug (`X-Org-Id`) and notify listeners. */
export function setActiveOrg(org: string): void {
  const clean = org.trim()
  try {
    if (clean) localStorage.setItem(HANZO_IAM_DEFAULTS.orgStorageKey, clean)
    else localStorage.removeItem(HANZO_IAM_DEFAULTS.orgStorageKey)
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hanzo:org', { detail: clean }))
  }
}

/** Build `X-Org-Id` request header map when an active org is known. */
export function orgHeaders(): Record<string, string> {
  const org = activeOrg()
  return org ? { [HANZO_IAM_DEFAULTS.orgHeader]: org } : {}
}

/**
 * Finish a sign-in this page was returned to. A no-op on every other load.
 */
export async function finish(): Promise<void> {
  if (!new URL(location.href).searchParams.has('code')) return
  await handleCallback()
  history.replaceState(null, '', location.pathname)
}

/**
 * The organizations this person may act in, home org FIRST.
 */
export async function orgs(): Promise<string[]> {
  const u = await getUser().catch(() => null)
  const home = (u?.owner ?? '').trim()
  const id = [u?.owner, u?.name].filter(Boolean).join('/')
  let rows: { org?: string }[] = []
  if (id) {
    const bearer = await token().catch(() => null)
    if (bearer) {
      const base = import.meta.env.VITE_HANZO_API_URL ?? 'https://api.hanzo.ai'
      const url = `${base}/v1/iam/memberships?user=${encodeURIComponent(id)}`
      const body = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/json',
          ...orgHeaders(),
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (body && Array.isArray(body.memberships)) rows = body.memberships
    }
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of [home, ...rows.map((m) => m.org ?? '')]) {
    const n = (name ?? '').trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}
