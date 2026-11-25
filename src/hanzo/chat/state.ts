/**
 * Hanzo Chat — Shared mutable state singleton
 *
 * Shared state across all `src/hanzo/chat/*` modules via `import { S }`.
 */

import type { UnlistenFn } from '@tauri-apps/api/event'
import type {
  Agent,
  Session,
  ChatMsg,
  ApprovalMode,
  PendingTool,
  Attachment,
  AgentCheckpoint,
} from './types.ts'

interface ChatState {
  sessionId: string | null
  runId: string | null
  streaming: boolean
  messages: ChatMsg[]
  streamAccum: string
  unlisten: UnlistenFn | null

  selectedAgent: Agent | null
  selectedModel: string | null
  agents: Agent[]
  sessions: Session[]
  thinkingLevel: string
  approvalMode: ApprovalMode

  planMode: boolean
  lastSendWasPlan: boolean
  planSteps: string[]
  planStepIndex: number
  planProgressEl: HTMLElement | null

  pendingToolCalls: Map<string, PendingTool>

  msgList: HTMLElement | null
  streamingBubble: HTMLElement | null
  textarea: HTMLTextAreaElement | null
  sendBtn: HTMLButtonElement | null
  stopBtn: HTMLButtonElement | null
  toolRow: HTMLElement | null
  headerStatus: HTMLElement | null
  agentSelect: HTMLSelectElement | null
  modelSelect: HTMLSelectElement | null
  sessionSelect: HTMLSelectElement | null
  tokenDisplay: HTMLElement | null
  attachmentBar: HTMLElement | null
  contextBar: HTMLElement | null

  onSessionsUpdated: (() => void) | null
  onModelsUpdated: (() => void) | null
  onModeUpdated: (() => void) | null

  attachments: Attachment[]
  checkpoint: AgentCheckpoint | null

  needsProviderSetup: boolean

  whisperRow: HTMLElement | null
  whisperInput: HTMLInputElement | null

  completedRounds: number
  completedRunIds: Set<string>

  surfaced: boolean
  surfacedRound: number
  surfacedSummary: string
  surfaceBtn: HTMLButtonElement | null
  resumeBtn: HTMLButtonElement | null

  streamingRafId: number | null
  pendingStreamText: string

  thinkingStartTs: number | null
  thinkingTimerInterval: ReturnType<typeof setInterval> | null

  progressLog: HTMLDivElement | null
  progressUnlisten: (() => void) | null

  providerUpdatedUnlisten: (() => void) | null
  chatReattachUnlisten: (() => void) | null
}

export const S: ChatState = {
  sessionId: null,
  runId: null,
  streaming: false,
  messages: [],
  streamAccum: '',
  unlisten: null,

  selectedAgent: null,
  selectedModel: null,
  agents: [],
  sessions: [],
  thinkingLevel: 'medium',
  approvalMode: 'auto',

  planMode: false,
  lastSendWasPlan: false,
  planSteps: [],
  planStepIndex: 0,
  planProgressEl: null,

  pendingToolCalls: new Map(),

  msgList: null,
  streamingBubble: null,
  textarea: null,
  sendBtn: null,
  stopBtn: null,
  toolRow: null,
  headerStatus: null,
  agentSelect: null,
  modelSelect: null,
  sessionSelect: null,
  tokenDisplay: null,
  attachmentBar: null,
  contextBar: null,

  onSessionsUpdated: null,
  onModelsUpdated: null,
  onModeUpdated: null,

  attachments: [],
  checkpoint: null,

  needsProviderSetup: false,

  whisperRow: null,
  whisperInput: null,

  completedRounds: 0,
  completedRunIds: new Set<string>(),

  surfaced: false,
  surfacedRound: 0,
  surfacedSummary: '',
  surfaceBtn: null,
  resumeBtn: null,

  streamingRafId: null,
  pendingStreamText: '',
  thinkingStartTs: null,
  thinkingTimerInterval: null,

  progressLog: null,
  progressUnlisten: null,

  providerUpdatedUnlisten: null,
  chatReattachUnlisten: null,
}
