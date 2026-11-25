/**
 * Canonical Hanzo Brand Mark (`@hanzo/logo`) & Exact `Hanzo Dev` (`lucide-react@0.564.0`
 * + `DesktopAppMenu.tsx`) Icon Geometry.
 *
 * Uses `@hanzo/logo/logos` verbatim (`MARK_VIEWBOX`, `MARK_BLOCKS`, `MARK_SHADE`)
 * and exact `lucide-react@0.564.0` + `DesktopAppMenu.tsx` SVG paths.
 */

import { MARK_BLOCKS, MARK_SHADE, MARK_VIEWBOX } from '@hanzo/logo/logos'

export function renderHanzoMarkSvg(size = 36, className = 'hanzo-zen-logo'): string {
  const paths =
    `<path fill="currentColor" d="${MARK_BLOCKS[0]}"/>` +
    `<path fill="currentColor" opacity="0.55" d="${MARK_SHADE[0]}"/>` +
    `<path fill="currentColor" d="${MARK_BLOCKS[1]}"/>` +
    `<path fill="currentColor" d="${MARK_BLOCKS[2]}"/>` +
    `<path fill="currentColor" d="${MARK_BLOCKS[3]}"/>` +
    `<path fill="currentColor" opacity="0.55" d="${MARK_SHADE[1]}"/>` +
    `<path fill="currentColor" d="${MARK_BLOCKS[4]}"/>`
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}" role="img" aria-label="Hanzo">${paths}</svg>`
}

export type ZenIconName =
  | 'menu'
  | 'left'
  | 'right'
  | 'back'
  | 'forward'
  | 'search'
  | 'browser'
  | 'terminal'
  | 'terminalPrompt'
  | 'integrations'
  | 'folder'
  | 'file'
  | 'new'
  | 'clock'
  | 'git'
  | 'debug'
  | 'close'
  | 'plus'
  | 'chev'
  | 'down'
  | 'min'
  | 'max'
  | 'restore'
  | 'send'
  | 'stop'
  | 'refresh'
  | 'check'
  | 'settings'
  | 'focus'
  | 'alert'
  | 'popout'
  | 'play'
  | 'cpu'
  | 'layers'
  | 'globe'
  | 'at'

const ICON_PATHS: Readonly<Record<Exclude<ZenIconName, 'menu'>, string>> = {
  left: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  right: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  forward: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/>',
  browser: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.5h18"/>',
  terminal:
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="m7 11 2-2-2-2"/><path d="M11 13h4"/>',
  terminalPrompt: '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>',
  integrations:
    '<rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/>',
  folder:
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/>',
  new: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  clock: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/>',
  git: '<path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>',
  debug:
    '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  min: '<path d="M5 12h14"/>',
  max: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  restore: '<rect x="8" y="4.5" width="11" height="11" rx="1.5"/><path d="M5 8.5v9a1.5 1.5 0 0 0 1.5 1.5h9"/>',
  send: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  focus: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  popout:
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  layers:
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
}

export function zenIcon(name: ZenIconName, size = 16, className = 'hanzo-zen-icon'): string {
  if (name === 'menu') {
    return `<svg class="${className}" width="15" height="9" viewBox="0 0 19 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M1 1h17M1 10h10.7"/></svg>`
  }
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`
}
