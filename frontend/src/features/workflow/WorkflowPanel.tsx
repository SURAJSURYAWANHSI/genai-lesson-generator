import { Link } from 'react-router-dom'
import { Ban, Check, Circle, CircleCheck, LoaderCircle, Minus, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { outcomeSentence, plainText } from '@/lib/format'
import type { GenerateLessonResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { currentSentence, statusWord, summariseStages, type StepStatus } from './runReducer'
import { useRunStream } from './runStreamContext'

function StepIcon({ status }: { status: StepStatus }) {
  const className = 'mt-0.5 size-5 shrink-0'
  switch (status) {
    case 'running':
      return <LoaderCircle className={cn(className, 'animate-spin text-primary')} aria-hidden />
    case 'done':
      return <Check className={cn(className, 'text-foreground')} aria-hidden />
    case 'failed':
      return <X className={cn(className, 'text-fail')} aria-hidden />
    case 'skipped':
      return <Minus className={cn(className, 'text-muted-foreground')} aria-hidden />
    default:
      return <Circle className={cn(className, 'text-muted-foreground/60')} aria-hidden />
  }
}

function Result({ result, planted }: { result: GenerateLessonResponse; planted: boolean }) {
  const passed = result.status === 'PASS'
  const Icon = passed ? CircleCheck : result.status === 'REJECTED' ? Ban : TriangleAlert
  let explanation = result.error_message ? plainText(result.error_message) : ''
  if (passed) {
    explanation = planted
      ? 'The first version had a planted mistake. The checks caught it and the lesson was fixed.'
      : 'The lesson passed all 10 checks.'
  } else if (result.status === 'REJECTED') {
    explanation = 'The lesson kept failing a check, so it was not published. You can still read it.'
  }
  return (
    <div className="space-y-4">
      <h1 className={cn('flex items-center gap-3 text-3xl font-semibold tracking-tight', passed ? 'text-pass' : 'text-fail')}>
        <Icon className="size-8 shrink-0" aria-hidden />
        {outcomeSentence(result.status, result.attempts)}
      </h1>
      {explanation && <p className="text-lg text-muted-foreground">{explanation}</p>}
      <Button asChild size="lg">
        <Link to={`/runs/${result.run_id}`}>{result.status === 'ERROR' ? 'View details' : 'View lesson'}</Link>
      </Button>
    </div>
  )
}

export function WorkflowPanel() {
  const { state, active, reset } = useRunStream()
  const { result } = state
  const stages = summariseStages(state)
  const sentence = active ? currentSentence(state) : ''

  return (
    <section aria-label="Live Agent Workflow" className="space-y-8">
      {result && <Result result={result} planted={state.attempts[0]?.injected ?? false} />}

      {!result && !state.error && (
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Live Agent Workflow</h1>
          <p className="mt-2 text-lg text-muted-foreground" role="status">
            {sentence}
          </p>
        </div>
      )}

      {state.error && (
        <div role="alert" className="space-y-3">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-fail">
            <TriangleAlert className="size-8 shrink-0" aria-hidden />
            The run stopped before it finished
          </h1>
          <p className="text-lg text-muted-foreground">{plainText(state.error)}</p>
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
        </div>
      )}

      <ol className="space-y-5">
        {stages.map((stage) => (
          <li key={stage.name} className="flex gap-3">
            <StepIcon status={stage.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className={cn('font-medium', stage.status === 'pending' && 'text-muted-foreground')}>{stage.name}</span>
                <span className={cn('text-sm text-muted-foreground', stage.status === 'failed' && 'text-fail')}>
                  {statusWord(stage.status)}
                </span>
              </div>
              {stage.notes.map((note) => (
                <p key={note} className="mt-0.5 text-sm text-muted-foreground">
                  {plainText(note)}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {result && (
        <Button variant="ghost" onClick={reset}>
          Generate another lesson
        </Button>
      )}
    </section>
  )
}
