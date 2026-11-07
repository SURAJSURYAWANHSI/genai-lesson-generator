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
    <div className="max-w-[68ch] space-y-8">
      {!run.final_lesson && (
        <div className="rounded-lg bg-fail-soft px-5 py-4">
          <p className="font-semibold text-fail">NOT PUBLISHED</p>
          <p className="mt-1">This is the latest version. It did not pass the checks, so it should not be used for teaching.</p>
        </div>
      )}
      <article>
        <LessonSections lesson={lesson} topic={run.topic} />
      </article>
    </div>
  )
}
