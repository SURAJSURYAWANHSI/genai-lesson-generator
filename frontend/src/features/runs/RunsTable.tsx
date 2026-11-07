import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate, pluralise } from '@/lib/format'
import type { RunSummary } from '@/lib/types'

/** A plain list rather than a table, so it reads the same at phone width. Each row opens its run. */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <ul className="-mx-2 divide-y">
      {runs.map((run) => (
        <li key={run.run_id}>
          <Link
            to={`/runs/${run.run_id}`}
            className="group my-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-subtle"
          >
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-semibold">{run.topic}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pluralise(run.attempts, 'attempt')}, {formatDate(run.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={run.status} />
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors duration-150 group-hover:text-primary">
                {run.status === 'PASS' ? 'View lesson' : 'View run'}
                <ChevronRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
