import { CircleCheck, ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/QueryState'
import { LessonSections } from '@/features/lesson/LessonSections'
import { LESSON_SECTIONS, sectionLabel } from '@/lib/format'
import type { RunDetail } from '@/lib/types'

export function LessonTab({ run }: { run: RunDetail }) {
  const lesson = run.final_lesson ?? run.latest_lesson
  const published = run.final_lesson !== null
  const version = published ? run.final_version : run.latest_version

  if (!lesson) {
    return (
      <EmptyState title={run.status === 'RUNNING' ? 'No lesson written yet' : 'This run produced no lesson'}>
        {run.status === 'RUNNING'
          ? 'This page updates when the first version is stored.'
          : 'It stopped before generation finished. The reason is shown above.'}
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5">
      {published ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md bg-pass-soft px-3 py-2 text-sm font-medium text-pass">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Published lesson, version {version}. It passed all 10 criteria.
        </p>
      ) : (
        <div className="flex items-start gap-3 rounded-md bg-fail px-4 py-3 text-fail-contrast">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">NOT PUBLISHED</p>
            <p className="text-sm">
              This is the latest attempt, version {version}, kept for inspection. It did not pass the rubric and
              should not be taught.
            </p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Lesson sections" className="hidden lg:sticky lg:top-4 lg:block">
          <ol className="space-y-1 text-sm">
            {LESSON_SECTIONS.map((section) => (
              <li key={section}>
                <a
                  href={`#lesson-${section}`}
                  className="block rounded-sm px-1 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {sectionLabel(section)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0 rounded-lg border bg-card p-4 sm:p-6">
          <LessonSections lesson={lesson} topic={run.topic} idPrefix="lesson" />
        </article>
      </div>
    </div>
  )
}
