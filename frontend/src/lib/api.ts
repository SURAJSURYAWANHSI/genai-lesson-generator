import { plainText } from './format'
import { readSse } from './sse'
import type {
  Evaluation,
  GenerateLessonRequest,
  GenerateLessonResponse,
  Health,
  HistoryResponse,
  MemoryPatterns,
  MemoryRecord,
  PromptVersion,
  Proposal,
  Rejection,
  RunDetail,
  StageEvent,
  Stats,
  StreamEvent,
} from './types'

const BASE = '/api/v1'

export const SERVER_DOWN_MESSAGE = "The server isn't responding. Make sure the backend is running, then try again."

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ValidationItem {
  loc?: (string | number)[]
  msg?: string
}

/** FastAPI sends `detail` as a string for app errors and as an array for 422 validation errors. */
function formatDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (!Array.isArray(detail)) return null
  return (detail as ValidationItem[])
    .map((item) => {
      const message = (item.msg ?? 'Invalid value').replace(/^Value error, /, '')
      const field = (item.loc ?? []).filter((part) => part !== 'body').pop()
      if (field === undefined) return message
      const name = plainText(String(field))
      return `${name.charAt(0).toUpperCase()}${name.slice(1)}: ${message}.`
    })
    .join(' ')
}

async function toApiError(response: Response): Promise<ApiError> {
  let message: string | null = null
  try {
    const body = (await response.json()) as { detail?: unknown }
    const detail = formatDetail(body.detail)
    message = detail && plainText(detail)
  } catch {
    // Not JSON, typically a proxy error page: fall through to the generic message.
  }
  if (!message) {
    message = SERVER_DOWN_MESSAGE
  }
  return new ApiError(response.status, message)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

export type ProposalAction = 'approve' | 'reject' | 'rollback'

export const api = {
  health: () => request<Health>('/health'),
  stats: () => request<Stats>('/stats'),
  history: () => request<HistoryResponse>('/lessons/history?limit=200'),
  run: (id: string) => request<RunDetail>(`/lessons/${id}`),
  evaluations: (id: string) => request<Evaluation[]>(`/lessons/${id}/evaluations`),
  rejections: (id: string) => request<Rejection[]>(`/lessons/${id}/rejections`),
  memoryPatterns: () => request<MemoryPatterns>('/memory/patterns'),
  memoryRecords: () => request<MemoryRecord[]>('/memory'),
  proposals: () => request<Proposal[]>('/evolution/proposals'),
  decideProposal: (id: string, action: ProposalAction, reviewer: string) =>
    request<Proposal>(`/evolution/proposals/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer }),
    }),
  prompts: () => request<PromptVersion[]>('/evolution/prompts'),
}

/** Starts a run and yields its events. Throws ApiError if the request is refused before streaming. */
export async function* streamGenerate(payload: GenerateLessonRequest): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${BASE}/lessons/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await toApiError(response)
  if (!response.body) throw new ApiError(response.status, 'The browser did not expose a response stream.')

  for await (const { event, data } of readSse(response.body)) {
    const parsed: unknown = JSON.parse(data)
    if (event === 'started') {
      const { run_id, maximum_attempts } = parsed as { run_id: string; maximum_attempts: number }
      yield { type: 'started', run_id, maximum_attempts }
    } else if (event === 'stage') {
      yield { type: 'stage', stage: parsed as StageEvent }
    } else if (event === 'complete') {
      yield { type: 'complete', result: parsed as GenerateLessonResponse }
    } else if (event === 'error') {
      yield { type: 'error', message: (parsed as { message: string }).message }
    }
  }
}
