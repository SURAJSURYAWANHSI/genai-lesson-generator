import { Link } from 'react-router-dom'
import { Disclosure } from '@/components/Disclosure'
import { PageHeader, SectionHeading } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { plainText, pluralise, topicLabel } from '@/lib/format'
import { useMemoryPatterns, useMemoryRecords } from '@/lib/queries'
import { criterionLabel } from '@/lib/rubric'
import type { MemoryRecord } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  failure_pattern: 'Failure pattern',
  correction_strategy: 'Correction strategy',
  topic_pattern: 'Topic guidance',
  human_feedback: 'Reviewer feedback',
  run_summary: 'Run summary',
}

function recordTitle(record: MemoryRecord): string {
  return record.criterion_id ? criterionLabel(record.criterion_id) : (TYPE_LABELS[record.memory_type] ?? 'Note')
}

function RecordList({ records, showType = false }: { records: MemoryRecord[]; showType?: boolean }) {
  return (
    <div className="divide-y">
      {records.map((record) => (
        <Disclosure
          key={record.id}
          summary={
            <span className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium">
                {recordTitle(record)}
                {showType && record.criterion_id && (
                  <span className="font-normal text-muted-foreground">, {TYPE_LABELS[record.memory_type]}</span>
                )}
              </span>
              <span className="text-sm text-muted-foreground">
                {topicLabel(record.topic_key)}, seen {pluralise(record.occurrences, 'time')}
              </span>
            </span>
          }
        >
          <p className="max-w-[72ch] text-muted-foreground">{plainText(record.content)}</p>
        </Disclosure>
      ))}
    </div>
  )
}

function RecordGroup({
  id,
  title,
  records,
  showType = false,
}: {
  id: string
  title: string
  records: MemoryRecord[]
  showType?: boolean
}) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <SectionHeading id={id}>{title}</SectionHeading>
      {records.length === 0 ? (
        <p className="text-muted-foreground">None yet.</p>
      ) : (
        <RecordList records={records} showType={showType} />
      )}
    </section>
  )
}

function AllRecords() {
  const records = useMemoryRecords()
  return (
    <section aria-labelledby="records-heading" className="space-y-2">
      <SectionHeading id="records-heading">Memory records</SectionHeading>
      {records.isPending && <LoadingBlock rows={2} label="Loading memory records" />}
      {records.isError && (
        <ErrorBlock error={records.error} title="Memory records couldn't be loaded" onRetry={() => void records.refetch()} />
      )}
      {records.data && (
        <Disclosure summary={`Show all ${pluralise(records.data.length, 'record')}`}>
          <RecordList records={records.data} showType />
        </Disclosure>
      )}
    </section>
  )
}

export function MemoryPage() {
  const patterns = useMemoryPatterns()
  const records = useMemoryRecords()
  const nothingYet = records.data?.length === 0

  return (
    <div className="space-y-10">
      <PageHeader title="Memory">What the system has learned from earlier lessons, so it can do better next time.</PageHeader>
      {patterns.isPending && <LoadingBlock rows={6} label="Loading memory" />}
      {patterns.isError && (
        <ErrorBlock error={patterns.error} title="Memory couldn't be loaded" onRetry={() => void patterns.refetch()} />
      )}
      {patterns.data &&
        (nothingYet ? (
          <EmptyState
            title="Nothing learned yet"
            action={
              <Button asChild>
                <Link to="/generate">Generate a lesson</Link>
              </Button>
            }
          >
            Memory fills up as lessons are generated and checked.
          </EmptyState>
        ) : (
          <>
            <RecordGroup id="failure-patterns" title="Learned failure patterns" records={patterns.data.failure_patterns} />
            <RecordGroup
              id="correction-strategies"
              title="Successful correction strategies"
              records={patterns.data.correction_strategies}
            />
            <RecordGroup id="topic-patterns" title="Topic-specific patterns" records={patterns.data.topic_patterns} showType />
            <AllRecords />
          </>
        ))}
    </div>
  )
}
