import { Link } from 'react-router-dom'
import { Check, Circle, LoaderCircle, Minus, X } from 'lucide-react'
import { PageBand } from '@/components/PageHeader'
import { OutcomeMark } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { outcomeSentence, plainText } from '@/lib/format'
import type { GenerateLessonResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { currentSentence, statusWord, summariseStages, type StepStatus } from './runReducer'
import { useRunStream } from './runStreamContext'

function StepIcon({ status }: { status: StepStatus }) {
  const className = 'size-5'
  switch (status) {
    case 'running':
      return <LoaderCircle className={cn(className, 'animate-spin')} aria-hidden />
    case 'done':
      return <Check className={className} aria-hidden />
    case 'failed':
      return <X className={className} aria-hidden />
    case 'skipped':
      return <Minus className={className} aria-hidden />
    default:
      return <Circle className="size-3" aria-hidden />
  }
}

function Result({ result, planted }: { result: GenerateLessonResponse; planted: boolean }) {
  const passed = result.status === 'PASS'
  let explanation = result.error_message ? plainText(result.error_message) : ''
  if (passed) {
    explanation = planted
      ? 'The first version had a planted mistake. The checks caught it and the lesson was fixed.'
      : 'The lesson passed all 10 checks.'
  } else if (result.status === 'REJECTED') {
    explanation = 'The lesson kept failing a check, so it was not published. You can still read it.'
  }
  return (
    <div className="flex items-start gap-4">
      <OutcomeMark status={result.status} />
      <div className="min-w-0">
        <h1 className="page-title">{outcomeSentence(result.status, result.attempts)}</h1>
        {explanation && <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">{explanation}</p>}
        <Button asChild size="lg" className="mt-6">
          <Link to={`/runs/${result.run_id}`}>{result.status === 'ERROR' ? 'View details' : 'View lesson'}</Link>
        </Button>
      </div>
    </div>
  )
}

export function WorkflowPanel() {
  const { state, active, reset } = useRunStream()
  const { result } = state
  const stages = summariseStages(state)
  const sentence = active ? currentSentence(state) : ''

  return (
    <section aria-label="Live Agent Workflow">
      <PageBand>
        {result && <Result result={result} planted={state.attempts[0]?.injected ?? false} />}

        {!result && !state.error && (
          <>
            <h1 className="page-title">Live Agent Workflow</h1>
            <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground" role="status">
              {sentence}
            </p>
          </>
        )}

        {state.error && (
          <div role="alert" className="flex items-start gap-4">
            <OutcomeMark status="ERROR" />
            <div className="min-w-0">
              <h1 className="page-title">The run stopped before it finished</h1>
              <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">{plainText(state.error)}</p>
              <Button size="lg" className="mt-6" onClick={reset}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </PageBand>

      <div className="page-body">
        <div className="panel">
          <ol className="steps">
            {stages.map((stage) => (
              <li key={stage.name} className="step" data-status={stage.status}>
                <span className="step-marker">
                  <StepIcon status={stage.status} />
                </span>
                <div className="min-w-0 flex-1 pt-1.5 lg:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 lg:flex-col lg:items-start lg:gap-0.5">
                    <span className={cn('font-bold transition-colors duration-200', stage.status === 'pending' && 'text-muted-foreground')}>
                      {stage.name}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-semibold text-muted-foreground transition-colors duration-200',
                        stage.status === 'running' && 'text-caution',
                        stage.status === 'failed' && 'text-fail',
                      )}
                    >
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
            <Button variant="ghost" className="mt-6" onClick={reset}>
              Generate another lesson
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
