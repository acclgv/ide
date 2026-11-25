/**
 * `PhoneAppDialog` Parity for Hanzo IDE (`v0.2.0`).
 *
 * Matches `Hanzo Dev` (`PhoneAppDialog.tsx`) & `Hanzo Desktop`:
 *   - Title: "Get Hanzo on your phone"
 *   - Description: "Scan to download Hanzo on iOS or Android and sign in with the same account."
 *   - Scannable ISO/IEC 18004 SVG QR codes for iOS (`https://hanzo.ai/download#mobile`)
 *     and Android (`https://play.google.com/store/apps/details?id=ai.hanzo.dev`).
 */

import { zenIcon } from './brand.ts'

export const MOBILE_APP_DOWNLOADS = [
  {
    platform: 'iOS',
    url: 'https://hanzo.ai/download#mobile',
    viewBox: 29,
    path: 'M2 2h7v1H2zM10 2h1v1H10zM12 2h1v1H12zM15 2h2v1H15zM20 2h7v1H20zM2 3h1v1H2zM8 3h1v1H8zM10 3h1v1H10zM16 3h1v1H16zM18 3h1v1H18zM20 3h1v1H20zM26 3h1v1H26zM2 4h1v1H2zM4 4h3v1H4zM8 4h1v1H8zM11 4h1v1H11zM14 4h3v1H14zM20 4h1v1H20zM22 4h3v1H22zM26 4h1v1H26zM2 5h1v1H2zM4 5h3v1H4zM8 5h1v1H8zM11 5h2v1H11zM15 5h3v1H15zM20 5h1v1H20zM22 5h3v1H22zM26 5h1v1H26zM2 6h1v1H2zM4 6h3v1H4zM8 6h1v1H8zM10 6h1v1H10zM12 6h1v1H12zM16 6h1v1H16zM18 6h1v1H18zM20 6h1v1H20zM22 6h3v1H22zM26 6h1v1H26zM2 7h1v1H2zM8 7h1v1H8zM10 7h1v1H10zM12 7h1v1H12zM14 7h3v1H14zM18 7h1v1H18zM20 7h1v1H20zM26 7h1v1H26zM2 8h7v1H2zM10 8h1v1H10zM12 8h1v1H12zM14 8h1v1H14zM16 8h1v1H16zM18 8h1v1H18zM20 8h7v1H20zM10 9h1v1H10zM13 9h2v1H13zM16 9h1v1H16zM2 10h3v1H2zM7 10h2v1H7zM10 10h1v1H10zM14 10h1v1H14zM18 10h5v1H18zM25 10h2v1H25zM5 11h1v1H5zM13 11h2v1H13zM16 11h3v1H16zM20 11h2v1H20zM23 11h1v1H23zM25 11h2v1H25zM3 12h1v1H3zM6 12h1v1H6zM8 12h1v1H8zM10 12h2v1H10zM13 12h1v1H13zM17 12h1v1H17zM19 12h6v1H19zM26 12h1v1H26zM5 13h1v1H5zM10 13h1v1H10zM12 13h1v1H12zM14 13h1v1H14zM16 13h1v1H16zM19 13h1v1H19zM22 13h2v1H22zM3 14h1v1H3zM7 14h6v1H7zM14 14h1v1H14zM17 14h2v1H17zM20 14h2v1H20zM26 14h1v1H26zM3 15h2v1H3zM6 15h2v1H6zM9 15h2v1H9zM13 15h3v1H13zM17 15h2v1H17zM20 15h2v1H20zM25 15h2v1H25zM2 16h2v1H2zM5 16h2v1H5zM8 16h1v1H8zM13 16h1v1H13zM17 16h2v1H17zM23 16h2v1H23zM26 16h1v1H26zM6 17h1v1H6zM9 17h2v1H9zM13 17h1v1H13zM17 17h2v1H17zM20 17h4v1H20zM2 18h4v1H2zM8 18h7v1H8zM18 18h5v1H18zM25 18h1v1H25zM10 19h1v1H10zM13 19h1v1H13zM15 19h1v1H15zM18 19h1v1H18zM22 19h1v1H22zM26 19h1v1H26zM2 20h7v1H2zM12 20h4v1H12zM18 20h1v1H18zM20 20h1v1H20zM22 20h1v1H22zM26 20h1v1H26zM2 21h1v1H2zM8 21h1v1H8zM10 21h2v1H10zM14 21h1v1H14zM18 21h1v1H18zM22 21h1v1H22zM2 22h1v1H2zM4 22h3v1H4zM8 22h1v1H8zM12 22h3v1H12zM17 22h6v1H17zM25 22h2v1H25zM2 23h1v1H2zM4 23h3v1H4zM8 23h1v1H8zM11 23h1v1H11zM13 23h3v1H13zM17 23h3v1H17zM22 23h1v1H22zM24 23h1v1H24zM26 23h1v1H26zM2 24h1v1H2zM4 24h3v1H4zM8 24h1v1H8zM10 24h4v1H10zM21 24h3v1H21zM25 24h2v1H25zM2 25h1v1H2zM8 25h1v1H8zM10 25h1v1H10zM12 25h1v1H12zM16 25h1v1H16zM18 25h1v1H18zM20 25h3v1H20zM2 26h7v1H2zM10 26h1v1H10zM13 26h2v1H13zM18 26h2v1H18zM23 26h1v1H23zM26 26h1v1H26z',
  },
  {
    platform: 'Android',
    url: 'https://play.google.com/store/apps/details?id=ai.hanzo.dev',
    viewBox: 37,
    path: 'M2 2h7v1H2zM10 2h2v1H10zM15 2h1v1H15zM19 2h5v1H19zM25 2h1v1H25zM28 2h7v1H28zM2 3h1v1H2zM8 3h1v1H8zM10 3h2v1H10zM15 3h1v1H15zM18 3h1v1H18zM24 3h2v1H24zM28 3h1v1H28zM34 3h1v1H34zM2 4h1v1H2zM4 4h3v1H4zM8 4h1v1H8zM11 4h1v1H11zM14 4h1v1H14zM24 4h3v1H24zM28 4h1v1H28zM30 4h3v1H30zM34 4h1v1H34zM2 5h1v1H2zM4 5h3v1H4zM8 5h1v1H8zM10 5h1v1H10zM12 5h1v1H12zM16 5h4v1H16zM22 5h1v1H22zM25 5h2v1H25zM28 5h1v1H28zM30 5h3v1H30zM34 5h1v1H34zM2 6h1v1H2zM4 6h3v1H4zM8 6h1v1H8zM11 6h6v1H11zM21 6h1v1H21zM24 6h1v1H24zM26 6h1v1H26zM28 6h1v1H28zM30 6h3v1H30zM34 6h1v1H34zM2 7h1v1H2zM8 7h1v1H8zM14 7h1v1H14zM16 7h1v1H16zM19 7h3v1H19zM23 7h1v1H23zM26 7h1v1H26zM28 7h1v1H28zM34 7h1v1H34zM2 8h7v1H2zM10 8h1v1H10zM12 8h1v1H12zM14 8h1v1H14zM16 8h1v1H16zM18 8h1v1H18zM20 8h1v1H20zM22 8h1v1H22zM24 8h1v1H24zM26 8h1v1H26zM28 8h7v1H28zM10 9h2v1H10zM13 9h2v1H13zM19 9h3v1H19zM24 9h2v1H24zM2 10h1v1H2zM4 10h2v1H4zM7 10h3v1H7zM11 10h1v1H11zM14 10h1v1H14zM16 10h1v1H16zM18 10h3v1H18zM23 10h1v1H23zM25 10h1v1H25zM28 10h1v1H28zM31 10h1v1H31zM33 10h2v1H33zM5 11h3v1H5zM9 11h1v1H9zM11 11h2v1H11zM14 11h1v1H14zM18 11h5v1H18zM25 11h2v1H25zM28 11h2v1H28zM31 11h4v1H31zM4 12h1v1H4zM7 12h4v1H7zM14 12h1v1H14zM16 12h1v1H16zM20 12h1v1H20zM22 12h1v1H22zM24 12h3v1H24zM28 12h4v1H28zM33 12h2v1H33zM2 13h1v1H2zM7 13h1v1H7zM9 13h3v1H9zM13 13h6v1H13zM20 13h1v1H20zM22 13h1v1H22zM29 13h1v1H29zM31 13h1v1H31zM33 13h1v1H33zM6 14h1v1H6zM8 14h2v1H8zM17 14h1v1H17zM19 14h3v1H19zM24 14h4v1H24zM29 14h3v1H29zM2 15h1v1H2zM4 15h2v1H4zM9 15h1v1H9zM11 15h2v1H11zM15 15h1v1H15zM18 15h1v1H18zM21 15h1v1H21zM23 15h1v1H23zM26 15h1v1H26zM29 15h1v1H29zM31 15h1v1H31zM33 15h1v1H33zM8 16h2v1H8zM11 16h1v1H11zM13 16h3v1H13zM17 16h2v1H17zM20 16h4v1H20zM26 16h1v1H26zM28 16h1v1H28zM30 16h3v1H30zM3 17h1v1H3zM5 17h1v1H5zM9 17h4v1H9zM14 17h1v1H14zM16 17h1v1H16zM18 17h1v1H18zM23 17h3v1H23zM27 17h2v1H27zM32 17h1v1H32zM3 18h2v1H3zM8 18h2v1H8zM12 18h2v1H12zM15 18h4v1H15zM22 18h3v1H22zM26 18h3v1H26zM30 18h3v1H30zM4 19h2v1H4zM9 19h4v1H9zM16 19h2v1H16zM19 19h1v1H19zM24 19h3v1H24zM28 19h1v1H28zM30 19h2v1H30zM34 19h1v1H34zM2 20h3v1H2zM6 20h1v1H6zM8 20h1v1H8zM10 20h4v1H10zM15 20h1v1H15zM17 20h3v1H17zM22 20h2v1H22zM28 20h3v1H28zM32 20h2v1H32zM2 21h2v1H2zM6 21h1v1H6zM10 21h2v1H10zM15 21h5v1H15zM24 21h2v1H24zM27 21h2v1H27zM30 21h1v1H30zM34 21h1v1H34zM4 22h1v1H4zM6 22h9v1H6zM17 22h5v1H17zM23 22h1v1H23zM26 22h1v1H26zM29 22h1v1H29zM31 22h3v1H31zM2 23h3v1H2zM6 23h2v1H6zM9 23h1v1H9zM12 23h2v1H12zM16 23h2v1H16zM19 23h4v1H19zM25 23h2v1H25zM28 23h1v1H28zM31 23h1v1H31zM34 23h1v1H34zM4 24h1v1H4zM7 24h2v1H7zM11 24h6v1H11zM20 24h1v1H20zM22 24h5v1H22zM28 24h2v1H28zM32 24h3v1H32zM3 25h2v1H3zM6 25h1v1H6zM9 25h1v1H9zM11 25h1v1H11zM13 25h1v1H13zM15 25h3v1H15zM20 25h2v1H20zM25 25h1v1H25zM27 25h1v1H27zM29 25h3v1H29zM33 25h2v1H33zM2 26h1v1H2zM4 26h2v1H4zM8 26h1v1H8zM13 26h5v1H13zM19 26h1v1H19zM21 26h1v1H21zM24 26h1v1H24zM26 26h5v1H26zM34 26h1v1H34zM10 27h1v1H10zM12 27h3v1H12zM17 27h5v1H17zM23 27h1v1H23zM25 27h2v1H25zM30 27h2v1H30zM33 27h1v1H33zM2 28h7v1H2zM10 28h1v1H10zM12 28h1v1H12zM15 28h2v1H15zM18 28h1v1H18zM20 28h2v1H20zM24 28h3v1H24zM28 28h1v1H28zM30 28h1v1H30zM2 29h1v1H2zM8 29h1v1H8zM10 29h2v1H10zM13 29h6v1H13zM20 29h1v1H20zM22 29h5v1H22zM30 29h4v1H30zM2 30h1v1H2zM4 30h3v1H4zM8 30h1v1H8zM12 30h4v1H12zM18 30h1v1H18zM20 30h4v1H20zM25 30h6v1H25zM32 30h1v1H32zM34 30h1v1H34zM2 31h1v1H2zM4 31h3v1H4zM8 31h1v1H8zM10 31h1v1H10zM13 31h1v1H13zM15 31h3v1H15zM22 31h1v1H22zM24 31h1v1H24zM29 31h1v1H29zM31 31h1v1H31zM34 31h1v1H34zM2 32h1v1H2zM4 32h3v1H4zM8 32h1v1H8zM10 32h1v1H10zM14 32h2v1H14zM17 32h4v1H17zM24 32h2v1H24zM28 32h2v1H28zM32 32h1v1H32zM2 33h1v1H2zM8 33h1v1H8zM11 33h1v1H11zM13 33h1v1H13zM15 33h1v1H15zM18 33h4v1H18zM24 33h1v1H24zM26 33h2v1H26zM29 33h2v1H29zM34 33h1v1H34zM2 34h7v1H2zM10 34h1v1H10zM12 34h5v1H12zM19 34h2v1H19zM23 34h1v1H23zM25 34h1v1H25zM27 34h1v1H27zM30 34h1v1H30zM32 34h1v1H32z',
  },
] as const

export function openPhoneAppModal(): void {
  document.getElementById('hanzo-phone-app-modal')?.remove()

  const backdrop = document.createElement('div')
  backdrop.id = 'hanzo-phone-app-modal'
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.68);display:flex;align-items:center;justify-content:center;padding:20px;'

  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', 'Get Hanzo on your phone')
  dialog.style.cssText =
    'width:min(420px,92vw);background:var(--zen-surface,#141414);border:1px solid var(--zen-border,#2a2a2a);border-radius:12px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.8);color:var(--zen-fg,#e5e5e5);font-family:var(--hanzo-font-ui);position:relative;'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'hanzo-zen-ib'
  closeBtn.title = 'Close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.style.cssText = 'position:absolute;top:14px;right:14px;'
  closeBtn.innerHTML = zenIcon('close', 15)

  const close = () => backdrop.remove()
  closeBtn.addEventListener('click', close)

  const title = document.createElement('h2')
  title.textContent = 'Get Hanzo on your phone'
  title.style.cssText = 'margin:0 0 6px;font-size:16px;font-weight:600;padding-right:28px;'

  const desc = document.createElement('p')
  desc.textContent =
    'Scan to download Hanzo on iOS or Android and sign in with the same account.'
  desc.style.cssText = 'margin:0 0 20px;font-size:12.5px;line-height:1.5;color:var(--zen-muted,#a0a0a0);'

  const grid = document.createElement('div')
  grid.style.cssText = 'display:flex;justify-content:center;gap:32px;padding:6px 0 4px;'

  for (const dl of MOBILE_APP_DOWNLOADS) {
    const fig = document.createElement('figure')
    fig.style.cssText = 'margin:0;display:flex;flex-direction:column;align-items:center;gap:8px;'

    const link = document.createElement('a')
    link.href = dl.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.title = `${dl.platform} (${dl.url})`
    link.style.cssText = 'display:block;line-height:0;border-radius:6px;overflow:hidden;'
    link.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dl.viewBox} ${dl.viewBox}" width="132" height="132" shape-rendering="crispEdges" role="img" aria-label="${dl.platform}"><title>${dl.platform}</title><rect width="${dl.viewBox}" height="${dl.viewBox}" fill="#ffffff"/><path d="${dl.path}" fill="#000000"/></svg>`

    const cap = document.createElement('figcaption')
    cap.textContent = dl.platform
    cap.style.cssText = 'font-size:12px;color:var(--zen-muted,#a0a0a0);'

    fig.append(link, cap)
    grid.appendChild(fig)
  }

  dialog.append(closeBtn, title, desc, grid)
  backdrop.appendChild(dialog)

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close()
  })
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && document.body.contains(backdrop)) close()
    },
    { once: true },
  )

  document.body.appendChild(backdrop)
}
