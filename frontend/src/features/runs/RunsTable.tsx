import { Link } from 'react-router-dom'
import { DemoTag, StatusBadge } from '@/components/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import type { RunSummary } from '@/lib/types'

/** On a phone the attempts and date move under the topic rather than forcing the table wider. */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Attempts</TableHead>
            <TableHead className="hidden md:table-cell">Date</TableHead>
            <TableHead>
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.run_id}>
              <TableCell className="whitespace-normal">
                <span className="flex flex-wrap items-center gap-2">
                  {run.topic}
                  {run.demo_mode && <DemoTag />}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                  <span className="sm:hidden">
                    {run.attempts} of {run.max_attempts} attempts.{' '}
                  </span>
                  {formatDate(run.created_at)}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">
                {run.attempts} of {run.max_attempts}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(run.created_at)}</TableCell>
              <TableCell className="text-right">
                <Link to={`/runs/${run.run_id}`} className="rounded-sm text-sm text-primary underline underline-offset-4">
                  View<span className="sr-only"> run: {run.topic}</span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
