import { CircleCheck, CircleHelp, CircleX, FlaskConical } from 'lucide-react'
import { Disclosure } from '@/components/Disclosure'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { SectionHeading } from '@/components/PageHeader'
import { LessonSections } from '@/features/lesson/LessonSections'
import { formatCost, formatDate, formatNumber, sectionLabel } from '@/lib/format'
import { useVersions } from '@/lib/queries'
import type { ErrorInjectionRecord, RunDetail } from '@/lib/types'

function YesNo({ value, yes, no, unknown }: { value: boolean | null; yes: string; no: string; unknown: string }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1">
        <CircleHelp className="size-4" aria-hidden />
        {unknown}
      </span>
    )
  }
  const Icon = value ? CircleCheck : CircleX
  return (
    <span className={`inline-flex items-center gap-1 ${value ? 'text-pass' : 'text-fail'}`}>
      <Icon className="size-4" aria-hidden />
      {value ? yes : no}
    </span>
  )
}

function Injection({ record }: { record: ErrorInjectionRecord }) {
  return (
    <section aria-labelledby="injection-heading" className="space-y-3 rounded-lg border border-caution p-4">
      <h3 id="injection-heading" className="flex items-center gap-2 font-semibold">
        <FlaskConical className="size-4 text-caution" aria-hidden />
        Injected error: {record.label}
      </h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium">{record.type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected to fail</dt>
          <dd className="font-medium">{record.expected_criteria.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Detected by the evaluator</dt>
          <dd className="font-medium">
            <YesNo value={record.detected} yes="Detected" no="Not detected" unknown="Not evaluated" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Corrected by revision</dt>
          <dd className="font-medium">
            <YesNo
              value={record.corrected}
              yes="Corrected"
              no={record.persistent ? 'Not corrected (re-injected each attempt)' : 'Not corrected'}
              unknown="Not evaluated"
            />
          </dd>
        </div>
      </dl>
      <div className="space-y-1.5">
        <h4 className="text-sm font-semibold">Modifications</h4>
        {record.modifications.length === 0 && (
          <p className="text-sm text-muted-foreground">No modification was made before the run ended.</p>
        )}
        {record.modifications.map((item) => (
          <Disclosure
            key={item.attempt}
            summary={
              <span className="text-sm">
                Attempt {item.attempt}, {sectionLabel(item.section)}: {item.description}
              </span>
            }
          >
            <div className="grid gap-2 lg:grid-cols-2">
              {(['before', 'after'] as const).map((side) => (
                <div key={side} className="min-w-0">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {side === 'before' ? 'Before' : 'After'}
                  </p>
                  <pre className="max-h-72 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                    {typeof item[side] === 'string' ? (item[side] as string) || '(empty)' : JSON.stringify(item[side], null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </Disclosure>
        ))}
      </div>
      {record.evaluator_results.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">What the evaluator found</h4>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {record.evaluator_results.map((item) => (
              <li key={item.attempt}>
                Attempt {item.attempt} ({item.lesson_had_injected_error ? 'contained the defect' : 'no defect injected'}):{' '}
                {item.failed_criteria.length ? `failed ${item.failed_criteria.join(', ')}` : 'passed all 10'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export function VersionsTab({ run }: { run: RunDetail }) {
  const versions = useVersions(run.run_id)
  return (
    <div className="space-y-6">
      {run.error_injection && <Injection record={run.error_injection} />}
      <section aria-labelledby="versions-heading" className="space-y-3">
        <SectionHeading id="versions-heading">Lesson versions</SectionHeading>
        {versions.isPending && <LoadingBlock rows={3} label="Loading versions" />}
        {versions.isError && <ErrorBlock error={versions.error} onRetry={() => void versions.refetch()} />}
        {versions.data?.length === 0 && (
          <EmptyState title="No versions stored">This run stopped before a lesson was written.</EmptyState>
        )}
        <div className="space-y-2">
          {versions.data?.map((version) => (
            <div key={version.id} className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">Version {version.version}</h4>
                {version.is_final && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-pass">
                    <CircleCheck className="size-4" aria-hidden />
                    Published
                  </span>
                )}
                {version.is_injected && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-caution">
                    <FlaskConical className="size-4" aria-hidden />
                    Contains injected defect
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Attempt {version.attempt_number}, {version.source === 'revision' ? 'revised from the previous version' : 'first draft'}.{' '}
                {version.model_provider} ({version.model_name}), prompt version {version.prompt_version ?? 'unknown'}.{' '}
                Tokens: {formatNumber(version.input_tokens)} in, {formatNumber(version.output_tokens)} out. Estimated cost:{' '}
                {formatCost(version.estimated_cost_usd)}. {formatDate(version.created_at)}.
              </p>
              <div>
                <p className="text-sm font-medium">
                  Changed sections ({version.changed_sections.length})
                  {version.source !== 'revision' && <span className="font-normal text-muted-foreground">: all new in the first draft</span>}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {version.changed_sections.map((section) => (
                    <li key={section} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                      {sectionLabel(section)}
                    </li>
                  ))}
                </ul>
              </div>
              <Disclosure summary={<span className="text-sm">Read version {version.version}</span>}>
                <LessonSections lesson={version.content} topic={run.topic} idPrefix={`v${version.version}`} />
              </Disclosure>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
