import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Check, Circle, LoaderCircle, Minus, Square, X } from 'lucide-react'
import { Disclosure } from '@/components/Disclosure'
import { RubricStrip } from '@/components/RubricStrip'
import { DemoTag, StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { sectionLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { statusWord, summariseStages, type AttemptTrace, type StepStatus } from './runReducer'
import { useRunStream } from './runStreamContext'

function StepIcon({ status }: { status: StepStatus }) {
  const className = 'size-4 shrink-0'
  switch (status) {
    case 'running':
      return <LoaderCircle className={cn(className, 'animate-spin text-primary')} aria-hidden />
    case 'done':
      return <Check className={cn(className, 'text-pass')} aria-hidden />
    case 'failed':
      return <X className={cn(className, 'text-fail')} aria-hidden />
    case 'skipped':
      return <Minus className={cn(className, 'text-muted-foreground')} aria-hidden />
    default:
      return <Circle className={cn(className, 'text-muted-foreground')} aria-hidden />
  }
}

function Step({ title, status, children }: { title: string; status: StepStatus; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border bg-card px-3 py-2.5',
        status === 'running' && 'border-primary',
        status === 'pending' && 'border-dashed bg-transparent',
        status === 'failed' && 'border-fail',
      )}
    >
      <div className="flex items-center gap-2">
        <StepIcon status={status} />
        <span className="text-sm font-medium">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{statusWord(status)}</span>
      </div>
      {children && <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

function SectionChips({ sections }: { sections: string[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {sections.map((section) => (
        <li key={section} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-foreground">
          {sectionLabel(section)}
        </li>
      ))}
    </ul>
  )
}

const VERDICT_TEXT = {
  pass: 'All 10 criteria passed, so the lesson can be published.',
  retry: 'Failed with retries left, so revision feedback is being prepared.',
  exhausted: 'No retries left, so the lesson will not be published.',
}

function AttemptLane({ attempt, maxAttempts }: { attempt: AttemptTrace; maxAttempts: number | null }) {
  const failed = attempt.failedCriteria
  return (
    <section
      aria-label={`Attempt ${attempt.number}`}
      className="rounded-lg bg-muted/50 p-3"
    >
      <h3 className="mb-2 text-sm font-semibold tabular-nums">
        Attempt {attempt.number}
        {maxAttempts !== null && <span className="font-normal text-muted-foreground"> of {maxAttempts}</span>}
      </h3>
      <div className="grid items-stretch gap-1.5 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Step title={attempt.number === 1 ? 'Lesson generation' : 'Regeneration'} status={attempt.generation}>
          {attempt.generationError && <p className="text-fail">{attempt.generationError}</p>}
          {attempt.injected && <p className="text-caution">Demo defect injected into this version.</p>}
        </Step>
        <ArrowRight className="m-auto hidden size-4 text-muted-foreground md:block" aria-hidden />
        <Step title="Evaluation" status={attempt.evaluation}>
          {attempt.evaluationError && <p className="text-fail">{attempt.evaluationError}</p>}
          {failed && (
            <p className={cn(failed.length && 'font-medium text-fail')}>
              {failed.length ? `Failed ${failed.join(', ')}` : 'Passed all 10 criteria'}
            </p>
          )}
        </Step>
        <ArrowRight className="m-auto hidden size-4 text-muted-foreground md:block" aria-hidden />
        <Step title="Retry decision" status={attempt.decision}>
          {attempt.verdict && <p>{VERDICT_TEXT[attempt.verdict]}</p>}
        </Step>
      </div>
      <div className="mt-2">
        <RubricStrip
          failed={failed ?? []}
          waiting={failed === null}
          label={`Rubric result for attempt ${attempt.number}`}
        />
      </div>
    </section>
  )
}

/** The return path of the loop: drawn from the decision on the right back to the generator on the left. */
function LoopBack({ attempt }: { attempt: AttemptTrace }) {
  return (
    <div className="relative">
      <svg
        className="absolute inset-0 h-full w-full text-primary"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <path
          d="M 94 0 V 18 Q 94 24 90 24 H 10 Q 6 24 6 30 V 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative flex justify-center px-[10%] pt-5 pb-3">
        <div className="max-w-full rounded-md border border-primary bg-card px-3 py-2 text-sm">
          <p className="font-medium">
            Feedback from attempt {attempt.number}: revise {attempt.sectionsToRevise.length} section
            {attempt.sectionsToRevise.length === 1 ? '' : 's'}
          </p>
          <SectionChips sections={attempt.sectionsToRevise} />
        </div>
      </div>
      <ArrowDown className="absolute bottom-0 left-[6%] size-4 -translate-x-1/2 translate-y-1 text-primary" aria-hidden />
    </div>
  )
}

export function WorkflowPanel() {
  const { state, active, stop } = useRunStream()
  const stages = summariseStages(state)
  const { attempts, maxAttempts, memory, finalization, result, phase, request } = state
  const idle = phase === 'idle' || (phase === 'failed' && state.runId === null)
  const unused = maxAttempts !== null && !active ? maxAttempts - attempts.length : 0
  const current = stages.find((stage) => stage.status === 'running')

  return (
    <section aria-labelledby="workflow-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="workflow-heading" className="text-lg font-semibold tracking-tight">
            Live agent workflow
          </h2>
          {request && !idle ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{request.topic}</span>
              {request.demo_mode && <DemoTag />}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Start a run and each stage reports here as the backend reaches it.
            </p>
          )}
        </div>
        {active && (
          <Button variant="outline" size="sm" onClick={stop}>
            <Square aria-hidden />
            Stop run
          </Button>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {active
          ? current
            ? `${current.name} running`
            : 'Run in progress'
          : result
            ? `Run finished with status ${result.status}`
            : phase === 'stopped'
              ? 'Run stopped'
              : ''}
      </p>

      <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage) => (
          <li key={stage.name} className="min-w-0 bg-card px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <StepIcon status={stage.status} />
              <span className="text-xs font-medium">{stage.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {statusWord(stage.status)}
              {stage.detail && `: ${stage.detail}`}
            </p>
          </li>
        ))}
      </ol>

      {!idle && (
        <div className="space-y-2">
          <Step title="Memory retrieval" status={memory.status}>
            {memory.status === 'done' && !memory.used && <p>Nothing relevant learned from earlier runs yet.</p>}
            {memory.guidance.length > 0 && (
              <Disclosure summary={`${memory.guidance.length} guidance items sent to the generator`} className="mt-1">
                <ul className="list-disc space-y-1 pl-4">
                  {memory.guidance.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </Step>

          <div>
            {attempts.map((attempt, index) => (
              <Fragment key={attempt.number}>
                <AttemptLane attempt={attempt} maxAttempts={maxAttempts} />
                {index < attempts.length - 1 && <LoopBack attempt={attempt} />}
              </Fragment>
            ))}
          </div>
          {unused > 0 && phase === 'finished' && (
            <p className="text-sm text-muted-foreground">
              {unused} further attempt{unused === 1 ? '' : 's'} allowed but not used.
            </p>
          )}

          <Step title="Finalization" status={finalization.status}>
            {finalization.finalStatus && (
              <p>
                {finalization.finalStatus === 'PASS'
                  ? 'Final lesson stored and published.'
                  : 'Stored for inspection. Not published.'}
              </p>
            )}
          </Step>
        </div>
      )}

      {phase === 'stopped' && (
        <Alert>
          <AlertTitle>Run stopped</AlertTitle>
          <AlertDescription>The backend records a run closed this way as an error.</AlertDescription>
        </Alert>
      )}
      {state.error && !idle && (
        <Alert variant="destructive" className="border-fail/50">
          <AlertTitle>The run did not finish</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <StatusBadge status={result.status} />
          <p className="min-w-0 flex-1 text-sm">
            {result.status === 'PASS' &&
              `Published after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}.`}
            {result.status === 'REJECTED' && `Rejected after ${result.attempts} attempts. Nothing was published.`}
            {result.status === 'ERROR' && (result.error_message ?? 'The run ended with an error.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to={`/runs/${result.run_id}`}>Open run report</Link>
            </Button>
            {result.rejection_log.length > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/runs/${result.run_id}?tab=rejections`}>View rejection log</Link>
              </Button>
            )}
          </div>
        </div>
      )}
      {!result && state.runId && !active && (
        <Button asChild size="sm" variant="outline">
          <Link to={`/runs/${state.runId}`}>Open what was recorded</Link>
        </Button>
      )}

      {state.log.length > 0 && <EventLog />}
    </section>
  )
}

function EventLog() {
  const { state } = useRunStream()
  const startedAt = state.startedAt ?? 0
  return (
    <Disclosure summary={<span className="text-sm">Raw stream events ({state.log.length})</span>}>
      <ol className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-xs">
        {state.log.map((entry, index) => (
          <li key={index} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <span className="text-right text-muted-foreground tabular-nums">{entry.at - startedAt} ms</span>
            <span>
              {entry.node} {entry.event}
            </span>
          </li>
        ))}
      </ol>
    </Disclosure>
  )
}
