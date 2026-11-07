import { Disclosure } from '@/components/Disclosure'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { StatusBadge } from '@/components/StatusBadge'
import { pluralise, plainText } from '@/lib/format'
import { useEvaluations } from '@/lib/queries'
import { criterionLabel } from '@/lib/rubric'
import type { Check, Evaluation } from '@/lib/types'

function Field({ label, text }: { label: string; text: string | null }) {
  if (!text) return null
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="mt-0.5 text-muted-foreground">{plainText(text)}</dd>
    </div>
  )
}

function CheckFields({ check }: { check: Check }) {
  return (
    <dl className="max-w-[72ch] space-y-3">
      <Field label="Failure reason" text={check.failure_reason} />
      <Field label="Suggested correction" text={check.suggested_correction} />
      <Field label="Evidence" text={check.evidence} />
    </dl>
  )
}

function CheckRow({ check, open }: { check: Check; open: boolean }) {
  return (
    <Disclosure
      defaultOpen={open}
      summary={
        <span className="flex flex-wrap items-center justify-between gap-x-4">
          <span className="font-medium">{criterionLabel(check.criterion_id)}</span>
          <StatusBadge status={check.status} />
        </span>
      }
    >
      <CheckFields check={check} />
    </Disclosure>
  )
}

function Attempt({ evaluation }: { evaluation: Evaluation }) {
  const failed = evaluation.checks.filter((check) => check.status === 'FAIL')
  const passed = evaluation.checks.filter((check) => check.status === 'PASS')
  return (
    <section aria-label={`Attempt ${evaluation.attempt_number}`} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-xl font-semibold tracking-tight">Attempt {evaluation.attempt_number}</h2>
        <p className="text-muted-foreground">
          {failed.length ? `${pluralise(failed.length, 'check')} failed` : 'All 10 checks passed'}
        </p>
      </div>
      <div className="divide-y">
        {failed.map((check) => (
          <CheckRow key={check.criterion_id} check={check} open />
        ))}
        {passed.map((check) => (
          <CheckRow key={check.criterion_id} check={check} open={false} />
        ))}
      </div>
    </section>
  )
}

export function EvaluationTab({ runId }: { runId: string }) {
  const evaluations = useEvaluations(runId)
  if (evaluations.isPending) return <LoadingBlock rows={6} label="Loading evaluation report" />
  if (evaluations.isError) {
    return (
      <ErrorBlock
        error={evaluations.error}
        title="The evaluation report couldn't be loaded"
        onRetry={() => void evaluations.refetch()}
      />
    )
  }
  if (evaluations.data.length === 0) {
    return <EmptyState title="Nothing was evaluated">The run stopped before the lesson was checked.</EmptyState>
  }
  return (
    <div className="space-y-10">
      {evaluations.data.map((evaluation) => (
        <Attempt key={evaluation.id} evaluation={evaluation} />
      ))}
    </div>
  )
}
