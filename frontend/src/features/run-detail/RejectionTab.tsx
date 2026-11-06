import { Disclosure } from '@/components/Disclosure'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { StatusBadge } from '@/components/StatusBadge'
import { LessonSections, SectionBody } from '@/features/lesson/LessonSections'
import { isRagTopic } from '@/lib/constants'
import { changedSections, formatDate, sectionLabel } from '@/lib/format'
import { useRejections } from '@/lib/queries'
import type { Lesson, Rejection } from '@/lib/types'

function LessonComparison({ entry, topic, revised }: { entry: Rejection; topic: string; revised: Lesson }) {
  const changed = changedSections(entry.previous_lesson, revised)
  const rag = isRagTopic(topic)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {changed.length} of 15 sections changed between version {entry.lesson_version} and version{' '}
        {entry.revised_version}. Unchanged sections are left out.
      </p>
      {changed.length === 0 && <p className="text-sm">The revision did not change any section.</p>}
      {changed.map((section) => (
        <section key={section} className="space-y-2">
          <h5 className="text-sm font-semibold">{sectionLabel(section)}</h5>
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="min-w-0 rounded-md border border-l-4 border-l-fail p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Previous, version {entry.lesson_version}</p>
              <SectionBody lesson={entry.previous_lesson} section={section} rag={rag} />
            </div>
            <div className="min-w-0 rounded-md border border-l-4 border-l-pass p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Revised, version {entry.revised_version}</p>
              <SectionBody lesson={revised} section={section} rag={rag} />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

function RejectionEntry({ entry, topic, defaultOpen }: { entry: Rejection; topic: string; defaultOpen: boolean }) {
  const feedback = entry.generator_feedback
  return (
    <Disclosure
      defaultOpen={defaultOpen}
      summary={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Attempt {entry.attempt}</span>
          <StatusBadge status="FAIL" />
          <span className="text-sm text-muted-foreground">
            Failed {entry.failed_criterion_ids.join(', ')}. Version {entry.lesson_version}. {formatDate(entry.created_at)}
          </span>
        </span>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Failed criteria and reasons</h4>
          <ul className="space-y-2 text-sm">
            {entry.failed_checks.map((check) => (
              <li key={check.criterion_id}>
                <p className="font-medium">
                  {check.criterion_id} {check.criterion_name}
                </p>
                <p className="text-muted-foreground">{check.failure_reason ?? 'No reason recorded.'}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Revision feedback sent to the generator</h4>
          {feedback ? (
            <>
              <ul className="space-y-2 text-sm">
                {feedback.failed_criteria.map((item) => (
                  <li key={item.criterion_id} className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="font-medium">{item.instruction}</p>
                    <p className="mt-0.5 text-muted-foreground">{item.suggested_correction}</p>
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                <span className="font-medium">Revise: </span>
                {feedback.sections_to_revise.map(sectionLabel).join(', ') || 'None'}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Preserve: </span>
                {feedback.sections_to_preserve.map(sectionLabel).join(', ') || 'None'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              None. No retries were left after this attempt, so no feedback was prepared.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Previous and revised lesson</h4>
          {entry.revised_lesson ? (
            <LessonComparison entry={entry} topic={topic} revised={entry.revised_lesson} />
          ) : (
            <p className="text-sm text-muted-foreground">No revision was written after this attempt.</p>
          )}
          <div className="space-y-1.5 pt-1">
            <Disclosure summary={<span className="text-sm">Whole previous lesson, version {entry.lesson_version}</span>}>
              <LessonSections lesson={entry.previous_lesson} topic={topic} idPrefix={`prev-${entry.id}`} />
            </Disclosure>
            {entry.revised_lesson && (
              <Disclosure summary={<span className="text-sm">Whole revised lesson, version {entry.revised_version}</span>}>
                <LessonSections lesson={entry.revised_lesson} topic={topic} idPrefix={`rev-${entry.id}`} />
              </Disclosure>
            )}
          </div>
        </section>
      </div>
    </Disclosure>
  )
}

export function RejectionTab({ runId, topic }: { runId: string; topic: string }) {
  const rejections = useRejections(runId)
  if (rejections.isPending) return <LoadingBlock rows={3} label="Loading rejection log" />
  if (rejections.isError) return <ErrorBlock error={rejections.error} onRetry={() => void rejections.refetch()} />
  if (rejections.data.length === 0) {
    return <EmptyState title="No attempts were rejected">Every evaluated attempt in this run passed the rubric.</EmptyState>
  }
  return (
    <div className="space-y-2">
      {rejections.data.map((entry, index) => (
        <RejectionEntry key={entry.id} entry={entry} topic={topic} defaultOpen={index === 0} />
      ))}
    </div>
  )
}
