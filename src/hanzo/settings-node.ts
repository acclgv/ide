// Local AI (Private Inference) + Hanzo Node (`hanzod`) & Blockchain Console (HIP-1330).
//
// Shared across Hanzo App, Hanzo Dev, and Hanzo IDE:
//   - Live probe of `hanzo-engine` (`:36900`), `hanzo-router` (`:1235`),
//     `hanzod` (`:3690`), and `Ollama` (`:11434`) with 1-click activation in IDE Chat.
//   - Hanzo Chain (`hanzo-chain` HIP-1330) network selector (Mainnet 36963,
//     Testnet 36962, Devnet 36964, Local `hanzod` `:3690` / `:19630`), live
//     `eth_blockNumber`, `eth_chainId`, `net_peerCount`, interactive JSON-RPC
//     console, and Explorer link (`https://explorer.hanzo.ai`).

import { invoke } from '@tauri-apps/api/core'
import { emit, tauri } from './tauri.ts'
import { S } from './chat/state.ts'

interface LocalEndpointSpec {
  id: string
  name: string
  baseUrl: string
  probeUrl: string
  kind: 'openai' | 'ollama'
  fallbackModel: string
  desc: string
}

const LOCAL_AI_ENDPOINTS: readonly LocalEndpointSpec[] = [
  {
    id: 'hanzo-engine-local',
    name: 'Hanzo Engine (Private Local AI)',
    baseUrl: 'http://127.0.0.1:36900/v1',
    probeUrl: 'http://127.0.0.1:36900/v1/models',
    kind: 'openai',
    fallbackModel: 'enso',
    desc: 'http://127.0.0.1:36900/v1 · Native local inference daemon',
  },
  {
    id: 'hanzo-router-local',
    name: 'Hanzo Router',
    baseUrl: 'http://127.0.0.1:1235/v1',
    probeUrl: 'http://127.0.0.1:1235/v1/models',
    kind: 'openai',
    fallbackModel: 'enso',
    desc: 'http://127.0.0.1:1235/v1 · Local OpenAI-compatible router',
  },
  {
    id: 'hanzod-local',
    name: 'Hanzo Node (hanzod AI)',
    baseUrl: 'http://127.0.0.1:3690/v1',
    probeUrl: 'http://127.0.0.1:3690/v1/models',
    kind: 'openai',
    fallbackModel: 'enso',
    desc: 'http://127.0.0.1:3690/v1 · Unified local node inference + RPC',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    probeUrl: 'http://localhost:11434/api/tags',
    kind: 'ollama',
    fallbackModel: 'qwen3-coder:30b',
    desc: 'http://localhost:11434 · Local GGUF model runner',
  },
] as const

interface ChainNetworkSpec {
  id: string
  label: string
  rpcUrls: readonly string[]
  expectedChainId: number
}

const CHAIN_NETWORKS: readonly ChainNetworkSpec[] = [
  {
    id: 'mainnet',
    label: 'Mainnet · Chain 36963',
    rpcUrls: ['https://rpc.hanzo.ai'],
    expectedChainId: 36963,
  },
  {
    id: 'testnet',
    label: 'Testnet · Chain 36962',
    rpcUrls: ['https://rpc-testnet.hanzo.ai'],
    expectedChainId: 36962,
  },
  {
    id: 'devnet',
    label: 'Devnet · Chain 36964',
    rpcUrls: ['https://rpc-devnet.hanzo.ai'],
    expectedChainId: 36964,
  },
  {
    id: 'local',
    label: 'Local hanzod · 127.0.0.1:3690',
    rpcUrls: ['http://127.0.0.1:3690/v1/chain/hanzo', 'http://127.0.0.1:19630/ext/bc/C/rpc'],
    expectedChainId: 36963,
  },
] as const

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 1500): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function probeLocalModels(spec: LocalEndpointSpec): Promise<{ online: boolean; models: string[] }> {
  try {
    const res = await fetchWithTimeout(spec.probeUrl, { method: 'GET' }, 1100)
    if (!res.ok) return { online: false, models: [] }
    const data = await res.json()
    if (spec.kind === 'ollama') {
      const names = Array.isArray(data?.models)
        ? data.models.map((m: any) => String(m?.name || '')).filter(Boolean)
        : []
      return { online: true, models: names }
    }
    const ids = Array.isArray(data?.data)
      ? data.data.map((m: any) => String(m?.id || '')).filter(Boolean)
      : []
    return { online: true, models: ids }
  } catch {
    return { online: false, models: [] }
  }
}

async function callJsonRpc(rpcUrls: readonly string[], method: string, params: unknown[] = []): Promise<any> {
  let lastErr: unknown = null
  for (const url of rpcUrls) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        },
        2200,
      )
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`)
        continue
      }
      return await res.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('RPC unreachable')
}

function parseHexInt(hex: unknown): string {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return '—'
  const n = Number.parseInt(hex, 16)
  return Number.isFinite(n) ? n.toLocaleString() : '—'
}

export async function renderLocalNodeSection(body: HTMLElement): Promise<void> {
  const intro = document.createElement('div')
  intro.className = 'hz-settings-desc'
  intro.textContent =
    'Run 100% private local AI inference via hanzo-engine, hanzo-router, hanzod, or Ollama — zero cloud key required.'
  body.appendChild(intro)

  const listCard = document.createElement('div')
  listCard.className = 'hz-settings-card'
  body.appendChild(listCard)

  const renderEndpoints = async () => {
    listCard.innerHTML = ''
    const results = await Promise.all(
      LOCAL_AI_ENDPOINTS.map(async (spec) => ({ spec, status: await probeLocalModels(spec) })),
    )

    for (const { spec, status } of results) {
      const row = document.createElement('div')
      row.className = 'hz-settings-row'

      const meta = document.createElement('div')
      meta.className = 'hz-settings-meta'

      const titleRow = document.createElement('div')
      titleRow.style.cssText = 'display:flex;align-items:center;gap:8px'
      const dot = document.createElement('span')
      dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${status.online ? '#10b981' : '#52525b'};flex-shrink:0`
      const t = document.createElement('span')
      t.className = 'hz-settings-title'
      t.textContent = spec.name
      const stateBadge = document.createElement('span')
      stateBadge.style.cssText = `font-size:10.5px;color:${status.online ? '#10b981' : '#71717a'}`
      stateBadge.textContent = status.online
        ? `Online${status.models.length ? ` · ${status.models.length} models` : ''}`
        : 'Offline'
      titleRow.append(dot, t, stateBadge)

      const d = document.createElement('div')
      d.className = 'hz-settings-desc'
      d.textContent = status.models.length
        ? `${spec.desc} · Models: ${status.models.slice(0, 3).join(', ')}`
        : spec.desc

      meta.append(titleRow, d)

      const useBtn = document.createElement('button')
      useBtn.type = 'button'
      useBtn.className = status.online ? 'hz-settings-btn hz-settings-btn--primary' : 'hz-settings-btn'
      useBtn.textContent = status.online ? 'Use in IDE Chat' : 'Configure Local'
      useBtn.addEventListener('click', async () => {
        if (!tauri()) return
        const chosenModel = status.models[0] || spec.fallbackModel
        useBtn.textContent = 'Activating…'
        try {
          await invoke('engine_upsert_provider', {
            provider: {
              id: spec.id,
              name: spec.name,
              kind: spec.kind,
              api_key: '',
              base_url: spec.baseUrl,
              default_model: chosenModel,
              enabled_models: status.models.length ? status.models : [chosenModel],
            },
          })
          const cfg = await invoke<any>('engine_get_config')
          await invoke('engine_set_config', {
            config: { ...cfg, default_provider: spec.id, default_model: chosenModel },
          })
          S.selectedModel = chosenModel
          S.needsProviderSetup = false
          await emit('provider-updated').catch(() => {})
          useBtn.textContent = `Active (${chosenModel}) ✓`
        } catch (e) {
          useBtn.textContent = 'Failed'
          console.warn('[hanzo-local-ai] activation error:', e)
        }
      })

      row.append(meta, useBtn)
      listCard.appendChild(row)
    }
  }

  const rescanBtn = document.createElement('button')
  rescanBtn.type = 'button'
  rescanBtn.className = 'hz-settings-btn'
  rescanBtn.style.alignSelf = 'flex-start'
  rescanBtn.textContent = 'Rescan Local Ports'
  rescanBtn.addEventListener('click', () => void renderEndpoints())
  body.appendChild(rescanBtn)

  await renderEndpoints()
}

export async function renderBlockchainConsoleSection(body: HTMLElement): Promise<void> {
  let activeNet: ChainNetworkSpec = CHAIN_NETWORKS[0]

  const topRow = document.createElement('div')
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap'

  const netChips = document.createElement('div')
  netChips.className = 'hz-settings-chips'

  const explorerBtn = document.createElement('button')
  explorerBtn.type = 'button'
  explorerBtn.className = 'hz-settings-btn'
  explorerBtn.textContent = 'Explorer →'
  explorerBtn.addEventListener('click', () => {
    const url = 'https://explorer.hanzo.ai'
    if (tauri()) void invoke('open_external', { url }).catch(() => {})
    else window.open(url, '_blank', 'noopener')
  })

  topRow.append(netChips, explorerBtn)
  body.appendChild(topRow)

  // Stats Grid (Block Height, Chain ID, Peers)
  const statsGrid = document.createElement('div')
  statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px'

  const makeMetric = (label: string) => {
    const card = document.createElement('div')
    card.style.cssText =
      'padding:14px 16px;background:#0d0d10;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:4px'
    const l = document.createElement('div')
    l.style.cssText = 'font-size:11px;color:#a1a1aa'
    l.textContent = label
    const v = document.createElement('div')
    v.style.cssText = 'font-size:18px;font-weight:600;font-family:var(--hanzo-font-mono);color:#fafafa'
    v.textContent = '…'
    card.append(l, v)
    return { card, valEl: v }
  }

  const blockMetric = makeMetric('Block Height (eth_blockNumber)')
  const chainMetric = makeMetric('Chain ID (eth_chainId)')
  const peerMetric = makeMetric('Peers (net_peerCount)')
  statsGrid.append(blockMetric.card, chainMetric.card, peerMetric.card)
  body.appendChild(statsGrid)

  const refreshMetrics = async () => {
    blockMetric.valEl.textContent = '…'
    chainMetric.valEl.textContent = '…'
    peerMetric.valEl.textContent = '…'
    const [blk, cid, peers] = await Promise.all([
      callJsonRpc(activeNet.rpcUrls, 'eth_blockNumber').catch(() => null),
      callJsonRpc(activeNet.rpcUrls, 'eth_chainId').catch(() => null),
      callJsonRpc(activeNet.rpcUrls, 'net_peerCount').catch(() => null),
    ])
    blockMetric.valEl.textContent = blk?.result ? parseHexInt(blk.result) : 'Offline'
    chainMetric.valEl.textContent = cid?.result ? parseHexInt(cid.result) : String(activeNet.expectedChainId)
    peerMetric.valEl.textContent = peers?.result ? parseHexInt(peers.result) : '0'
  }

  const rebuildNetChips = () => {
    netChips.innerHTML = ''
    for (const net of CHAIN_NETWORKS) {
      const c = document.createElement('button')
      c.type = 'button'
      c.className = 'hz-settings-chip'
      c.textContent = net.label
      c.setAttribute('aria-selected', String(net.id === activeNet.id))
      c.addEventListener('click', () => {
        activeNet = net
        rebuildNetChips()
        void refreshMetrics()
      })
      netChips.appendChild(c)
    }
  }
  rebuildNetChips()

  // Interactive JSON-RPC Tester Card
  const rpcCard = document.createElement('div')
  rpcCard.className = 'hz-settings-card'
  const rpcWrap = document.createElement('div')
  rpcWrap.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:10px'

  const rpcTitle = document.createElement('div')
  rpcTitle.className = 'hz-settings-title'
  rpcTitle.textContent = 'Interactive JSON-RPC Console (HIP-1330)'

  const methodChips = document.createElement('div')
  methodChips.className = 'hz-settings-chips'

  const payloadInput = document.createElement('input')
  payloadInput.type = 'text'
  payloadInput.className = 'hz-settings-input'
  payloadInput.style.fontFamily = 'var(--hanzo-font-mono)'
  payloadInput.value = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })

  for (const m of ['eth_blockNumber', 'eth_chainId', 'net_peerCount', 'eth_gasPrice', 'web3_clientVersion']) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'hz-settings-chip'
    chip.textContent = m
    chip.addEventListener('click', () => {
      payloadInput.value = JSON.stringify({ jsonrpc: '2.0', id: 1, method: m, params: [] })
    })
    methodChips.appendChild(chip)
  }

  const outPre = document.createElement('pre')
  outPre.style.cssText =
    'margin:0;padding:12px;border-radius:8px;background:#060608;border:1px solid rgba(255,255,255,0.08);color:#e4e4e7;font-family:var(--hanzo-font-mono);font-size:11.5px;max-height:180px;overflow:auto;white-space:pre-wrap'
  outPre.textContent = '// Click "Send RPC" to query the selected Hanzo Chain endpoint.'

  const sendRpcBtn = document.createElement('button')
  sendRpcBtn.type = 'button'
  sendRpcBtn.className = 'hz-settings-btn hz-settings-btn--primary'
  sendRpcBtn.style.alignSelf = 'flex-start'
  sendRpcBtn.textContent = 'Send RPC'
  sendRpcBtn.addEventListener('click', async () => {
    sendRpcBtn.textContent = 'Sending…'
    try {
      const parsed = JSON.parse(payloadInput.value)
      const res = await callJsonRpc(
        activeNet.rpcUrls,
        String(parsed.method || 'eth_blockNumber'),
        Array.isArray(parsed.params) ? parsed.params : [],
      )
      outPre.textContent = JSON.stringify(res, null, 2)
    } catch (e) {
      outPre.textContent = `RPC Error (${activeNet.rpcUrls[0]}):\n${String(e)}`
    } finally {
      sendRpcBtn.textContent = 'Send RPC'
    }
  })

  rpcWrap.append(rpcTitle, methodChips, payloadInput, sendRpcBtn, outPre)
  rpcCard.appendChild(rpcWrap)
  body.appendChild(rpcCard)

  void refreshMetrics()
}
