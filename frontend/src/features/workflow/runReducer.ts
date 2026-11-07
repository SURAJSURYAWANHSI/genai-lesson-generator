import { sectionLabel } from '@/lib/format'
import { criterionList } from '@/lib/rubric'
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

export type RunPhase = 'idle' | 'connecting' | 'streaming' | 'finished' | 'failed'

export interface RunStreamState {
  phase: RunPhase
  runId: string | null
  maxAttempts: number | null
  memory: { status: StepStatus; used: boolean }
  attempts: AttemptTrace[]
  finalization: { status: StepStatus; finalStatus: RunStatus | null }
  result: GenerateLessonResponse | null
  error: string | null
}

export const initialRunState: RunStreamState = {
  phase: 'idle',
  runId: null,
  maxAttempts: null,
  memory: { status: 'pending', used: false },
  attempts: [],
  finalization: { status: 'pending', finalStatus: null },
  result: null,
  error: null,
}

export type RunAction =
  | { type: 'begin'; request: GenerateLessonRequest }
  | { type: 'event'; event: StreamEvent }
  | { type: 'refused'; message: string }
  | { type: 'disconnected'; message: string }
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
        memory: starting ? { ...state.memory, status: 'running' } : { status: 'done', used: stage.memory_used ?? false },
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
      return { ...initialRunState, phase: 'connecting' }
    case 'refused':
      return { ...state, phase: 'failed', error: action.message }
    case 'disconnected':
      return { ...closeRunningSteps(state), phase: 'failed', error: action.message }
    case 'reset':
      return initialRunState
    case 'event': {
      const { event } = action
      if (event.type === 'started') {
        return { ...state, phase: 'streaming', runId: event.run_id, maxAttempts: event.maximum_attempts }
      }
      if (event.type === 'stage') return applyStage(state, event.stage)
      if (event.type === 'complete') {
        return { ...closeRunningSteps(state), phase: 'finished', result: event.result, runId: event.result.run_id }
      }
      return { ...closeRunningSteps(state), phase: 'failed', error: event.message }
    }
  }
}

const STATUS_WORD: Record<StepStatus, string> = {
  pending: 'Waiting',
  running: 'Working',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
}

export function statusWord(status: StepStatus): string {
  return STATUS_WORD[status]
}

export interface StageSummary {
  name: string
  status: StepStatus
  /** Plain sentences about what happened, one per attempt where a stage repeats. */
  notes: string[]
}

function attemptWords(number: number, maxAttempts: number | null): string {
  return maxAttempts === null ? `Attempt ${number}` : `Attempt ${number} of ${maxAttempts}`
}

const VERDICT_WORDS = {
  pass: 'publish the lesson.',
  retry: 'rewrite and try again.',
  exhausted: 'no attempts left.',
}

/** The six required stages. Where a stage repeats, its status is the latest attempt's. */
export function summariseStages(state: RunStreamState): StageSummary[] {
  const { attempts, memory, finalization, phase, maxAttempts } = state
  const over = phase === 'finished' || phase === 'failed'
  const first = attempts[0]
  const revisions = attempts.slice(1)
  const label = (attempt: AttemptTrace) => attemptWords(attempt.number, maxAttempts)
  // Once a run is over, nothing is still waiting: a stage it never reached was skipped.
  const settled = (status: StepStatus): StepStatus => (over && status === 'pending' ? 'skipped' : status)

  const regeneration: StepStatus = revisions.some((attempt) => attempt.generation === 'running')
    ? 'running'
    : revisions.some((attempt) => attempt.generation === 'failed')
      ? 'failed'
      : revisions.length > 0
        ? 'done'
        : 'pending'

  // A stage that repeats stays as it last finished until its next run actually starts.
  const lastKnown = (read: (attempt: AttemptTrace) => StepStatus): StepStatus =>
    [...attempts].reverse().map(read).find((status) => status !== 'pending') ?? 'pending'

  const stages: StageSummary[] = [
    {
      name: 'Memory retrieval',
      status: memory.status,
      notes: memory.status !== 'done' ? [] : [memory.used ? 'Used lessons learned from earlier runs.' : 'Nothing learned from earlier runs yet.'],
    },
    {
      name: 'Lesson generation',
      status: first?.generation ?? 'pending',
      notes: [
        ...(first?.generationError ? [first.generationError] : []),
        ...(first?.injected ? ['A mistake was planted on purpose for this demo.'] : []),
      ],
    },
    {
      name: 'Evaluation',
      status: lastKnown((attempt) => attempt.evaluation),
      notes: attempts.flatMap((attempt) => {
        if (attempt.evaluationError) return [`${label(attempt)}: ${attempt.evaluationError}`]
        if (!attempt.failedCriteria) return []
        return [
          attempt.failedCriteria.length
            ? `${label(attempt)}: found a problem with ${criterionList(attempt.failedCriteria)}.`
            : `${label(attempt)}: passed all 10 checks.`,
        ]
      }),
    },
    {
      name: 'Retry decision',
      status: lastKnown((attempt) => attempt.decision),
      notes: attempts.flatMap((attempt) => (attempt.verdict ? [`${label(attempt)}: ${VERDICT_WORDS[attempt.verdict]}`] : [])),
    },
    {
      name: 'Regeneration',
      status: regeneration,
      notes: revisions.flatMap((attempt, index) => [
        ...(attempt.generationError ? [attempt.generationError] : []),
        ...(attempts[index].sectionsToRevise.length
          ? [
              `${label(attempt)}: ${attempt.generation === 'done' ? 'rewrote' : 'rewriting'} ${attempts[index].sectionsToRevise.map(sectionLabel).join(' and ')}.`,
            ]
          : []),
      ]),
    },
    {
      name: 'Finalization',
      status: finalization.status,
      notes: !finalization.finalStatus ? [] : [finalization.finalStatus === 'PASS' ? 'Lesson published.' : 'Lesson not published.'],
    },
  ]
  return stages.map((stage) => ({ ...stage, status: settled(stage.status) }))
}

/** One plain sentence saying what is happening right now. */
export function currentSentence(state: RunStreamState): string {
  const { attempts, memory, finalization, maxAttempts } = state
  if (finalization.status === 'running') return 'Finishing up...'
  if (attempts.length === 0) {
    return memory.status === 'running' ? 'Looking up what was learned from earlier lessons...' : 'Getting started...'
  }
  const latest = attempts[attempts.length - 1]
  const previous = attempts[attempts.length - 2]
  const attempt = attemptWords(latest.number, maxAttempts)
  if (latest.generation === 'running') {
    if (!previous?.failedCriteria?.length) return 'Writing the lesson...'
    return `Found a problem with ${criterionList(previous.failedCriteria)}. Fixing it (${attempt})...`
  }
  if (latest.failedCriteria === null) {
    return latest.number === 1 ? 'Checking the lesson...' : `Checking the lesson again (${attempt})...`
  }
  if (latest.failedCriteria.length) return `Found a problem with ${criterionList(latest.failedCriteria)}...`
  return 'The lesson passed all 10 checks...'
}
