import { Disclosure } from '@/components/Disclosure'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { SectionBody } from '@/features/lesson/LessonSections'
import { isRagTopic } from '@/lib/constants'
import { changedSections, plainText, sectionLabel } from '@/lib/format'
import { useRejections } from '@/lib/queries'
import { criterionLabel, criterionList } from '@/lib/rubric'
import type { Lesson, Rejection } from '@/lib/types'

function ChangedSections({ entry, topic, revised }: { entry: Rejection; topic: string; revised: Lesson }) {
  const changed = changedSections(entry.previous_lesson, revised)
  const rag = isRagTopic(topic)
  if (changed.length === 0) return <p className="text-muted-foreground">The rewrite changed nothing.</p>
  return (
    <div className="space-y-6">
      {changed.map((section) => (
        <section key={section} className="space-y-3">
          <h5 className="font-semibold">{sectionLabel(section)}</h5>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg bg-fail-soft/60 p-4">
              <p className="mb-2 text-sm font-bold text-fail">Before</p>
              <SectionBody lesson={entry.previous_lesson} section={section} rag={rag} />
            </div>
            <div className="min-w-0 rounded-lg bg-pass-soft/60 p-4">
              <p className="mb-2 text-sm font-bold text-pass">After</p>
              <SectionBody lesson={revised} section={section} rag={rag} />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

function RejectionCard({ entry, topic }: { entry: Rejection; topic: string }) {
  const feedback = entry.generator_feedback
  return (
    <li className="panel">
      <h3 className="text-lg font-bold">
        Attempt {entry.attempt} failed {criterionList(entry.failed_criterion_ids)}.
      </h3>
      <p className="mt-1 text-muted-foreground">
        {entry.revised_lesson
          ? `It was sent back and rewritten as version ${entry.revised_version}.`
          : 'No attempts were left, so it was not rewritten.'}
      </p>
      <Disclosure className="mt-2" summary={<span className="text-sm">Show details</span>}>
        <div className="space-y-6">
          <section className="space-y-2">
            <h4 className="font-semibold">What went wrong</h4>
            {entry.failed_checks.map((check) => (
              <p key={check.criterion_id} className="max-w-[72ch]">
                <span className="font-semibold">{criterionLabel(check.criterion_id)}: </span>
                <span className="text-muted-foreground">{plainText(check.failure_reason ?? 'No reason recorded.')}</span>
              </p>
            ))}
          </section>
          {feedback && (
            <section className="space-y-2">
              <h4 className="font-semibold">Revision feedback</h4>
              {feedback.failed_criteria.map((item) => (
                <p key={item.criterion_id} className="max-w-[72ch] text-muted-foreground">
                  {plainText(`${item.instruction} ${item.suggested_correction}`)}
                </p>
              ))}
            </section>
          )}
          {entry.revised_lesson && (
            <section className="space-y-3">
              <h4 className="font-semibold">What changed in the lesson</h4>
              <ChangedSections entry={entry} topic={topic} revised={entry.revised_lesson} />
            </section>
          )}
        </div>
      </Disclosure>
    </li>
  )
}

export function RejectionTab({ runId, topic }: { runId: string; topic: string }) {
  const rejections = useRejections(runId)
  if (rejections.isPending) return <LoadingBlock rows={3} label="Loading rejection log" />
  if (rejections.isError) {
    return (
      <ErrorBlock
        error={rejections.error}
        title="The rejection log couldn't be loaded"
        onRetry={() => void rejections.refetch()}
      />
    )
  }
  if (rejections.data.length === 0) {
    return <EmptyState title="Nothing was rejected">Every attempt in this run passed its checks.</EmptyState>
  }
  return (
    <ul className="space-y-3">
      {rejections.data.map((entry) => (
        <RejectionCard key={entry.id} entry={entry} topic={topic} />
      ))}
    </ul>
  )
}
