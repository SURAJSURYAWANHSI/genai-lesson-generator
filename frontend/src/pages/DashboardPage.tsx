import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { RunsTable } from '@/features/runs/RunsTable'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { DEMO_REQUEST } from '@/lib/constants'
import { pluralise } from '@/lib/format'
import { useHealth, useStats } from '@/lib/queries'
import { criterionLabel } from '@/lib/rubric'
import type { Stats } from '@/lib/types'

function StatRow({ stats }: { stats: Stats }) {
  const items: [string, string | number][] = [
    ['Total runs', stats.total_runs],
    ['Passing lessons', stats.passing_lessons],
    ['Rejected lessons', stats.rejected_lessons],
    ['Average attempts', stats.average_attempts ?? 'None yet'],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function FailureFrequency({ stats }: { stats: Stats }) {
  const failures = [...stats.rubric_failures].sort((a, b) => b.failures - a.failures)
  const highest = Math.max(1, ...failures.map((item) => item.failures))
  return (
    <section aria-labelledby="failures-heading" className="space-y-4">
      <SectionHeading id="failures-heading">Rubric failure frequency</SectionHeading>
      {failures.length === 0 ? (
        <p className="text-muted-foreground">No lesson has failed a quality check yet.</p>
      ) : (
        <ol className="space-y-3">
          {failures.map((item) => (
            <li key={item.criterion_id}>
              <div className="flex justify-between gap-4">
                <span>{criterionLabel(item.criterion_id)}</span>
                <span className="text-muted-foreground tabular-nums">{pluralise(item.failures, 'failure')}</span>
              </div>
              <div className="mt-1 h-2 rounded-sm bg-muted" aria-hidden>
                <div className="h-full rounded-sm bg-fail" style={{ width: `${(item.failures / highest) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function HealthValue({ good, label }: { good: boolean; label: string }) {
  const Icon = good ? CircleCheck : TriangleAlert
  return (
    <span className={`inline-flex items-center gap-1.5 ${good ? 'text-pass' : 'text-fail'}`}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  )
}

function SystemHealth() {
  const health = useHealth()
  return (
    <section aria-labelledby="health-heading" className="space-y-4">
      <SectionHeading id="health-heading">System health</SectionHeading>
      {health.isPending && <LoadingBlock rows={1} label="Loading system health" />}
      {health.isError && (
        <p className="flex">
          <HealthValue good={false} label="The server isn't responding" />
        </p>
      )}
      {health.data && (
        <dl className="flex flex-wrap gap-x-10 gap-y-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">API</dt>
            <dd>
              <HealthValue good={health.data.status === 'ok'} label={health.data.status === 'ok' ? 'Healthy' : 'Having problems'} />
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Database</dt>
            <dd>
              <HealthValue good={health.data.database === 'ok'} label={health.data.database === 'ok' ? 'Connected' : 'Unavailable'} />
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}

export function DashboardPage() {
  const stats = useStats()
  const health = useHealth()
  const { start, active } = useRunStream()
  const navigate = useNavigate()

  const runDemo = () => {
    start(DEMO_REQUEST)
    void navigate('/generate')
  }

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <PageHeader title="Write a lesson and have it checked">
          The system writes a beginner lesson, checks it against 10 quality rules, and rewrites it if it fails.
        </PageHeader>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/generate">Generate a lesson</Link>
          </Button>
          {health.data?.demo_allowed && (
            <Button size="lg" variant="outline" onClick={runDemo} disabled={active}>
              Run the demo
            </Button>
          )}
        </div>
      </div>

      {stats.isPending && <LoadingBlock rows={4} label="Loading results" />}
      {stats.isError && (
        <ErrorBlock error={stats.error} title="Your results couldn't be loaded" onRetry={() => void stats.refetch()} />
      )}
      {stats.data && (
        <>
          <StatRow stats={stats.data} />
          <section aria-labelledby="recent-heading" className="space-y-3">
            <SectionHeading id="recent-heading">Recent runs</SectionHeading>
            {stats.data.recent_runs.length === 0 ? (
              <p className="text-muted-foreground">No lessons yet. Your first one will appear here.</p>
            ) : (
              <RunsTable runs={stats.data.recent_runs} />
            )}
          </section>
          <FailureFrequency stats={stats.data} />
        </>
      )}
      <SystemHealth />
    </div>
  )
}
