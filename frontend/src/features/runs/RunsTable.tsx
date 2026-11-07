import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate, pluralise } from '@/lib/format'
import type { RunSummary } from '@/lib/types'

/** A plain list rather than a table, so it reads the same at phone width. */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <ul className="divide-y">
      {runs.map((run) => (
        <li key={run.run_id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-medium">{run.topic}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {pluralise(run.attempts, 'attempt')}, {formatDate(run.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <StatusBadge status={run.status} />
            <Link to={`/runs/${run.run_id}`} className="rounded-sm text-sm text-primary underline underline-offset-4">
              {run.status === 'PASS' ? 'View lesson' : 'View run'}
              <span className="sr-only">: {run.topic}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
