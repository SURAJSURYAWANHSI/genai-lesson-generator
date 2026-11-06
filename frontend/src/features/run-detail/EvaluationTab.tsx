import { Disclosure } from '@/components/Disclosure'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { RubricStrip } from '@/components/RubricStrip'
import { StatusBadge } from '@/components/StatusBadge'
import { formatCost, formatDate, formatNumber, sectionLabel } from '@/lib/format'
import { useEvaluations } from '@/lib/queries'
import type { Check, Evaluation } from '@/lib/types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  )
}

function sourceLabel(source: string, provider: string): string {
  const model = provider === 'mock' ? 'Mock evaluator' : 'Model'
  if (source === 'deterministic') return 'Deterministic validator'
  if (source === 'llm+deterministic') return `${model} and deterministic validator`
  return model
}

function CriterionRow({ check, provider }: { check: Check; provider: string }) {
  return (
    <Disclosure
      defaultOpen={check.status === 'FAIL'}
      summary={
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            <span className="tabular-nums">{check.criterion_id}</span> {check.criterion_name}
          </span>
          <StatusBadge status={check.status} />
        </span>
      }
    >
      <dl className="space-y-2 text-sm">
        <Field label="Evidence">{check.evidence || 'None recorded.'}</Field>
        {check.failure_reason && <Field label="Failure reason">{check.failure_reason}</Field>}
        {check.suggested_correction && <Field label="Suggested correction">{check.suggested_correction}</Field>}
        {check.affected_sections.length > 0 && (
          <Field label="Affected sections">{check.affected_sections.map(sectionLabel).join(', ')}</Field>
        )}
        <Field label="Checked by">{sourceLabel(check.source, provider)}</Field>
      </dl>
    </Disclosure>
  )
}

function AttemptReport({ evaluation }: { evaluation: Evaluation }) {
  const failed = evaluation.checks.filter((check) => check.status === 'FAIL').map((check) => check.criterion_id)
  return (
    <section aria-label={`Attempt ${evaluation.attempt_number}`} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold">Attempt {evaluation.attempt_number}</h3>
        <StatusBadge status={evaluation.passed ? 'PASS' : 'FAIL'} />
        <p className="text-sm text-muted-foreground">
          {failed.length ? `${failed.length} of 10 criteria failed` : 'All 10 criteria passed'}
        </p>
      </div>
      <RubricStrip failed={failed} label={`Rubric result for attempt ${evaluation.attempt_number}`} />
      <div className="space-y-1.5">
        {evaluation.checks.map((check) => (
          <CriterionRow key={check.criterion_id} check={check} provider={evaluation.model_provider} />
        ))}
      </div>
      {evaluation.deterministic_issues.length > 0 && (
        <Disclosure summary={<span className="text-sm">Deterministic issues ({evaluation.deterministic_issues.length})</span>}>
          <ul className="space-y-2 text-sm">
            {evaluation.deterministic_issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">
                  {issue.criterion_id}, {sectionLabel(issue.section)}:
                </span>{' '}
                <span className="text-muted-foreground">{issue.message}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      <p className="text-sm text-muted-foreground">
        Evaluated by {evaluation.model_provider} ({evaluation.model_name}) against rubric version{' '}
        {evaluation.rubric_version ?? 'unknown'}. Tokens: {formatNumber(evaluation.input_tokens)} in,{' '}
        {formatNumber(evaluation.output_tokens)} out. Estimated cost: {formatCost(evaluation.estimated_cost_usd)}.{' '}
        {formatDate(evaluation.created_at)}.
      </p>
    </section>
  )
}

export function EvaluationTab({ runId }: { runId: string }) {
  const evaluations = useEvaluations(runId)
  if (evaluations.isPending) return <LoadingBlock rows={6} label="Loading evaluations" />
  if (evaluations.isError) return <ErrorBlock error={evaluations.error} onRetry={() => void evaluations.refetch()} />
  if (evaluations.data.length === 0) {
    return <EmptyState title="No evaluations recorded">This run stopped before any lesson was evaluated.</EmptyState>
  }
  return (
    <div className="space-y-10">
      {evaluations.data.map((evaluation) => (
        <AttemptReport key={evaluation.id} evaluation={evaluation} />
      ))}
    </div>
  )
}
