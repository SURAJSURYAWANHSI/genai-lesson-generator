import { readSse } from './sse'
import type {
  Evaluation,
  EvolutionAnalysis,
  FeedbackOut,
  FeedbackRequest,
  GenerateLessonRequest,
  GenerateLessonResponse,
  Health,
  HistoryResponse,
  LessonVersion,
  MemoryPatterns,
  MemoryRecord,
  PromptMetrics,
  PromptVersion,
  Proposal,
  ProposalStatus,
  Rejection,
  RunDetail,
  StageEvent,
  Stats,
  StreamEvent,
} from './types'

const BASE = '/api/v1'

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
      const field = (item.loc ?? []).filter((part) => part !== 'body').join('.')
      return field ? `${field}: ${message}` : message
    })
    .join(' ')
}

async function toApiError(response: Response): Promise<ApiError> {
  let message: string | null = null
  try {
    const body = (await response.json()) as { detail?: unknown }
    message = formatDetail(body.detail)
  } catch {
    // Not JSON, typically a proxy error page: fall through to the generic message.
  }
  if (!message) {
    message =
      response.status >= 502 && response.status <= 504
        ? 'The API is not reachable. Check that the backend is running.'
        : `The API returned status ${response.status}.`
  }
  return new ApiError(response.status, message)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export type ProposalAction = 'approve' | 'reject' | 'rollback'

export const api = {
  health: () => request<Health>('/health'),
  stats: () => request<Stats>('/stats'),
  history: (limit: number, offset: number) =>
    request<HistoryResponse>(`/lessons/history?limit=${limit}&offset=${offset}`),
  run: (id: string) => request<RunDetail>(`/lessons/${id}`),
  evaluations: (id: string) => request<Evaluation[]>(`/lessons/${id}/evaluations`),
  rejections: (id: string) => request<Rejection[]>(`/lessons/${id}/rejections`),
  versions: (id: string) => request<LessonVersion[]>(`/lessons/${id}/versions`),
  addFeedback: (id: string, body: FeedbackRequest) => post<FeedbackOut>(`/lessons/${id}/feedback`, body),
  memoryPatterns: () => request<MemoryPatterns>('/memory/patterns'),
  memoryRecords: (memoryType: string | null) =>
    request<MemoryRecord[]>(memoryType ? `/memory?memory_type=${encodeURIComponent(memoryType)}` : '/memory'),
  proposals: (status?: ProposalStatus) =>
    request<Proposal[]>(status ? `/evolution/proposals?status=${status}` : '/evolution/proposals'),
  decideProposal: (id: string, action: ProposalAction, reviewer: string, note: string | null) =>
    post<Proposal>(`/evolution/proposals/${id}/${action}`, { reviewer, note }),
  analyze: () => post<Proposal[]>('/evolution/analyze'),
  analysis: () => request<EvolutionAnalysis>('/evolution/analysis'),
  metrics: () => request<PromptMetrics[]>('/evolution/metrics'),
  prompts: () => request<PromptVersion[]>('/evolution/prompts'),
}

/** Starts a run and yields its events. Throws ApiError if the request is refused before streaming. */
export async function* streamGenerate(
  payload: GenerateLessonRequest,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${BASE}/lessons/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
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
