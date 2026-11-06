import type { GenerateLessonRequest, GenerateLessonResponse, RunStatus, StageEvent, StreamEvent } from '@/lib/types'

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface AttemptTrace {
  number: number
  generation: StepStatus
  injected: boolean
  generationError: string | null
  evaluation: StepStatus
  /** Known once evaluate_lesson completes; null until then. */
  failedCriteria: string[] | null
  evaluationError: string | null
  decision: StepStatus
  verdict: 'pass' | 'retry' | 'exhausted' | null
  sectionsToRevise: string[]
}

export interface LogEntry {
  at: number
  node: string
  event: 'start' | 'complete'
  attempt: number
}

export type RunPhase = 'idle' | 'connecting' | 'streaming' | 'finished' | 'failed' | 'stopped'

export interface RunStreamState {
  phase: RunPhase
  request: GenerateLessonRequest | null
  runId: string | null
  maxAttempts: number | null
  startedAt: number | null
  memory: { status: StepStatus; used: boolean; guidance: string[] }
  attempts: AttemptTrace[]
  finalization: { status: StepStatus; finalStatus: RunStatus | null }
  result: GenerateLessonResponse | null
  error: string | null
  log: LogEntry[]
}

export const initialRunState: RunStreamState = {
  phase: 'idle',
  request: null,
  runId: null,
  maxAttempts: null,
  startedAt: null,
  memory: { status: 'pending', used: false, guidance: [] },
  attempts: [],
  finalization: { status: 'pending', finalStatus: null },
  result: null,
  error: null,
  log: [],
}

export type RunAction =
  | { type: 'begin'; request: GenerateLessonRequest; at: number }
  | { type: 'event'; event: StreamEvent; at: number }
  | { type: 'refused'; message: string }
  | { type: 'disconnected'; message: string }
  | { type: 'stopped' }
  | { type: 'reset' }

function newAttempt(number: number): AttemptTrace {
  return {
    number,
    generation: 'running',
    injected: false,
    generationError: null,
    evaluation: 'pending',
    failedCriteria: null,
    evaluationError: null,
    decision: 'pending',
    verdict: null,
    sectionsToRevise: [],
  }
}

function updateLast(attempts: AttemptTrace[], change: (attempt: AttemptTrace) => AttemptTrace): AttemptTrace[] {
  if (attempts.length === 0) return attempts
  return [...attempts.slice(0, -1), change(attempts[attempts.length - 1])]
}

function applyStage(state: RunStreamState, stage: StageEvent): RunStreamState {
  const starting = stage.event === 'start'
  switch (stage.node) {
    case 'load_memory':
      return {
        ...state,
        memory: starting
          ? { ...state.memory, status: 'running' }
          : { status: 'done', used: stage.memory_used ?? false, guidance: stage.guidance ?? [] },
      }
    case 'generate_lesson':
      // A start event carries the attempt that just ended, so the new attempt is counted here.
      // A complete event can't be trusted for this either: it repeats the old number on failure.
      if (starting) return { ...state, attempts: [...state.attempts, newAttempt(state.attempts.length + 1)] }
      return {
        ...state,
        attempts: updateLast(state.attempts, (attempt) => ({
          ...attempt,
          generation: stage.error ? 'failed' : 'done',
          generationError: stage.error ?? null,
          injected: stage.injected ?? false,
        })),
      }
    case 'evaluate_lesson':
      return {
        ...state,
        attempts: updateLast(state.attempts, (attempt) =>
          starting
            ? { ...attempt, evaluation: 'running' }
            : {
                ...attempt,
                // Stays running on success until record_evaluation, the second half of this stage.
                evaluation: stage.error ? 'failed' : 'running',
                evaluationError: stage.error ?? null,
                failedCriteria: stage.failed_criteria ?? null,
              },
        ),
      }
    case 'record_evaluation':
      if (starting) return state
      return { ...state, attempts: updateLast(state.attempts, (attempt) => ({ ...attempt, evaluation: 'done' })) }
    case 'decide_retry':
      return {
        ...state,
        attempts: updateLast(state.attempts, (attempt) =>
          starting
            ? { ...attempt, decision: 'running' }
            : {
                ...attempt,
                // A retry stays running until its revision feedback has been prepared.
                decision: stage.decision === 'retry' ? 'running' : 'done',
                verdict: stage.decision ?? null,
              },
        ),
      }
    case 'prepare_revision_feedback':
      if (starting) return state
      return {
        ...state,
        attempts: updateLast(state.attempts, (attempt) => ({
          ...attempt,
          decision: 'done',
          sectionsToRevise: stage.sections_to_revise ?? [],
        })),
      }
    case 'finalize_lesson':
    case 'reject_lesson':
      return {
        ...state,
        finalization: starting
          ? { status: 'running', finalStatus: null }
          : { status: 'done', finalStatus: stage.final_status ?? null },
      }
    default:
      return state
  }
}

/** A stream that ended early must not leave a spinner running forever. */
function closeRunningSteps(state: RunStreamState): RunStreamState {
  const close = (status: StepStatus): StepStatus => (status === 'running' ? 'failed' : status)
  return {
    ...state,
    memory: { ...state.memory, status: close(state.memory.status) },
    finalization: { ...state.finalization, status: close(state.finalization.status) },
    attempts: state.attempts.map((attempt) => ({
      ...attempt,
      generation: close(attempt.generation),
      evaluation: close(attempt.evaluation),
      decision: close(attempt.decision),
    })),
  }
}

export function runReducer(state: RunStreamState, action: RunAction): RunStreamState {
  switch (action.type) {
    case 'begin':
      return { ...initialRunState, phase: 'connecting', request: action.request, startedAt: action.at }
    case 'refused':
      return { ...state, phase: 'failed', error: action.message }
    case 'disconnected':
      return { ...closeRunningSteps(state), phase: 'failed', error: action.message }
    case 'stopped':
      return { ...closeRunningSteps(state), phase: 'stopped' }
    case 'reset':
      return initialRunState
    case 'event': {
      const { event } = action
      if (event.type === 'started') {
        return { ...state, phase: 'streaming', runId: event.run_id, maxAttempts: event.maximum_attempts }
      }
      if (event.type === 'stage') {
        const entry: LogEntry = {
          at: action.at,
          node: event.stage.node,
          event: event.stage.event,
          attempt: event.stage.attempt,
        }
        return { ...applyStage(state, event.stage), log: [...state.log, entry] }
      }
      if (event.type === 'complete') {
        return { ...closeRunningSteps(state), phase: 'finished', result: event.result, runId: event.result.run_id }
      }
      return { ...closeRunningSteps(state), phase: 'failed', error: event.message }
    }
  }
}

export interface StageSummary {
  name: string
  status: StepStatus
  detail: string
}

const STATUS_WORD: Record<StepStatus, string> = {
  pending: 'Waiting',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Not needed',
}

export function statusWord(status: StepStatus): string {
  return STATUS_WORD[status]
}

/** Collapses the attempts into the six stages named in the brief, showing the latest attempt. */
export function summariseStages(state: RunStreamState): StageSummary[] {
  const { attempts, memory, finalization, phase } = state
  const over = phase === 'finished' || phase === 'failed' || phase === 'stopped'
  const first = attempts[0]
  const latest = attempts[attempts.length - 1]
  const revisions = attempts.slice(1)

  const evaluationDetail = () => {
    if (!latest || latest.failedCriteria === null) return latest?.evaluationError ? 'Evaluator failed' : ''
    return latest.failedCriteria.length
      ? `Attempt ${latest.number} failed ${latest.failedCriteria.join(', ')}`
      : `Attempt ${latest.number} passed all 10`
  }

  const regeneration: StepStatus = revisions.some((attempt) => attempt.generation === 'running')
    ? 'running'
    : revisions.some((attempt) => attempt.generation === 'failed')
      ? 'failed'
      : revisions.length > 0
        ? 'done'
        : phase === 'finished'
          ? 'skipped'
          : 'pending'

  const verdictDetail = {
    pass: 'Publish the lesson',
    retry: `Retry with feedback`,
    exhausted: 'No retries left',
  }

  return [
    {
      name: 'Memory retrieval',
      status: memory.status,
      detail:
        memory.status !== 'done'
          ? ''
          : memory.used
            ? `${memory.guidance.length} guidance item${memory.guidance.length === 1 ? '' : 's'}`
            : 'No earlier guidance',
    },
    {
      name: 'Lesson generation',
      status: first?.generation ?? 'pending',
      detail: first?.injected ? 'Demo defect injected' : '',
    },
    { name: 'Evaluation', status: latest?.evaluation ?? 'pending', detail: evaluationDetail() },
    {
      name: 'Retry decision',
      status: latest?.decision ?? 'pending',
      detail: latest?.verdict ? verdictDetail[latest.verdict] : '',
    },
    {
      name: 'Regeneration',
      status: over && regeneration === 'pending' ? 'skipped' : regeneration,
      detail: revisions.length ? `${revisions.length} revision${revisions.length === 1 ? '' : 's'}` : '',
    },
    { name: 'Finalization', status: finalization.status, detail: finalization.finalStatus ?? '' },
  ]
}
