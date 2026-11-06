import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionHeading } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, sectionLabel, topicLabel } from '@/lib/format'
import { useMemoryPatterns, useMemoryRecords } from '@/lib/queries'
import type { MemoryRecord } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  failure_pattern: 'Failure pattern',
  correction_strategy: 'Correction strategy',
  topic_pattern: 'Approved topic guidance',
  human_feedback: 'Human feedback',
  run_summary: 'Run summary',
}
const ALL_TYPES = 'all'

function RecordItem({ record, showType = false }: { record: MemoryRecord; showType?: boolean }) {
  const sections = record.details?.affected_sections ?? record.details?.target_sections ?? []
  const organic = record.occurrences - record.demo_occurrences
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {record.criterion_id && (
          <span className="font-semibold tabular-nums">
            {record.criterion_id}
            {record.details?.criterion_name && ` ${record.details.criterion_name}`}
          </span>
        )}
        {showType && <span className="text-sm font-medium">{TYPE_LABELS[record.memory_type] ?? record.memory_type}</span>}
        <span className="text-sm text-muted-foreground">{topicLabel(record.topic_key)}</span>
        {!record.is_active && <span className="text-sm font-medium text-caution">Inactive (rolled back)</span>}
      </div>
      <p className="max-w-[80ch] text-sm">{record.content}</p>
      {sections.length > 0 && (
        <p className="text-sm text-muted-foreground">Sections: {sections.map(sectionLabel).join(', ')}</p>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        Seen {record.occurrences} time{record.occurrences === 1 ? '' : 's'}: {record.demo_occurrences} demo, {organic}{' '}
        organic.
        {record.success_count > 0 && ` Worked ${record.success_count} time${record.success_count === 1 ? '' : 's'}.`}{' '}
        Updated {formatDate(record.updated_at)}.{' '}
        {record.source_run_id && (
          <Link to={`/runs/${record.source_run_id}`} className="text-primary underline underline-offset-4">
            Latest source run
          </Link>
        )}
      </p>
    </li>
  )
}

function RecordGroup({
  id,
  title,
  description,
  empty,
  records,
}: {
  id: string
  title: string
  description: string
  empty: string
  records: MemoryRecord[]
}) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <SectionHeading id={id}>{title}</SectionHeading>
      <p className="text-sm text-muted-foreground">{description}</p>
      {records.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {records.map((record) => (
            <RecordItem key={record.id} record={record} />
          ))}
        </ul>
      )}
    </section>
  )
}

function AllRecords() {
  const [type, setType] = useState(ALL_TYPES)
  const records = useMemoryRecords(type === ALL_TYPES ? null : type)
  return (
    <section aria-labelledby="records-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading id="records-heading">Memory records</SectionHeading>
        <div className="flex items-center gap-2">
          <Label htmlFor="memory-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="memory-type" size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>All types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {records.isPending && <LoadingBlock rows={4} label="Loading memory records" />}
      {records.isError && <ErrorBlock error={records.error} onRetry={() => void records.refetch()} />}
      {records.data?.length === 0 && (
        <EmptyState title="No records">Memory fills up as runs finish.</EmptyState>
      )}
      {records.data && records.data.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {records.data.map((record) => (
            <RecordItem key={record.id} record={record} showType />
          ))}
        </ul>
      )}
    </section>
  )
}

export function MemoryPage() {
  const patterns = useMemoryPatterns()
  return (
    <div className="space-y-8">
      <PageHeader title="Memory">
        What the system has learned across runs. Memory only adds guidance for the generator and evaluator. It's never
        consulted when deciding PASS or FAIL, so it can't relax the rubric.
      </PageHeader>
      {patterns.isPending && <LoadingBlock rows={6} label="Loading memory" />}
      {patterns.isError && <ErrorBlock error={patterns.error} onRetry={() => void patterns.refetch()} />}
      {patterns.data && (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y py-3 text-sm">
            {Object.entries(patterns.data.active_prompt_versions).map(([name, version]) => (
              <div key={name}>
                <dt className="text-muted-foreground capitalize">{name} prompt</dt>
                <dd className="font-medium tabular-nums">Version {version}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted-foreground">Rubric</dt>
              <dd className="font-medium tabular-nums">Version {patterns.data.active_rubric_version ?? 'unknown'}</dd>
            </div>
          </dl>
          <RecordGroup
            id="failure-patterns"
            title="Learned failure patterns"
            description="Criteria that have failed, across all topics, most frequent first."
            empty="No failures recorded yet"
            records={patterns.data.failure_patterns}
          />
          <RecordGroup
            id="correction-strategies"
            title="Successful correction strategies"
            description="Feedback that made a failed criterion pass on the next attempt."
            empty="No corrections have succeeded yet"
            records={patterns.data.correction_strategies}
          />
          <RecordGroup
            id="topic-patterns"
            title="Topic-specific patterns"
            description="The same learning for one topic, plus topic guidance that a reviewer approved."
            empty="No topic-specific patterns yet"
            records={patterns.data.topic_patterns}
          />
          <RecordGroup
            id="human-feedback"
            title="Human feedback"
            description="Changes requested by reviewers on a run's feedback tab."
            empty="No human feedback yet"
            records={patterns.data.human_feedback}
          />
          <AllRecords />
        </>
      )}
    </div>
  )
}
