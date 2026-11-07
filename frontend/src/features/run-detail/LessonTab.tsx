import { EmptyState } from '@/components/QueryState'
import { LessonSections } from '@/features/lesson/LessonSections'
import type { RunDetail } from '@/lib/types'

export function LessonTab({ run }: { run: RunDetail }) {
  const lesson = run.final_lesson ?? run.latest_lesson

  if (!lesson) {
    return run.status === 'RUNNING' ? (
      <EmptyState title="The lesson is still being written">This page updates by itself.</EmptyState>
    ) : (
      <EmptyState title="There is no lesson to show">The run stopped before a lesson was written.</EmptyState>
    )
  }

  return (
    <div className="space-y-3">
      {!run.final_lesson && (
        <div className="rounded-lg bg-fail-soft px-5 py-4 shadow-rest">
          <p className="font-bold text-fail">NOT PUBLISHED</p>
          <p className="mt-1">This is the latest version. It did not pass the checks, so it should not be used for teaching.</p>
        </div>
      )}
      <article className="panel">
        <div className="mx-auto max-w-[68ch]">
          <LessonSections lesson={lesson} topic={run.topic} />
        </div>
      </article>
    </div>
  )
}
