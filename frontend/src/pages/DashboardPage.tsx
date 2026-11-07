import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { PageHeader, Panel } from '@/components/PageHeader'
import { ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { RunsTable } from '@/features/runs/RunsTable'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { DEMO_REQUEST } from '@/lib/constants'
import { pluralise } from '@/lib/format'
import { useHealth, useStats } from '@/lib/queries'
import { criterionLabel } from '@/lib/rubric'
import type { Stats } from '@/lib/types'
import { cn } from '@/lib/utils'

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="sm:px-6 sm:first:pl-0 sm:last:pr-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl', tone)}>{value}</dd>
    </div>
  )
}

function StatBand({ stats }: { stats: Stats }) {
  return (
    <dl className="panel grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x">
      <Stat label="Total runs" value={stats.total_runs} />
      <Stat label="Passing lessons" value={stats.passing_lessons} tone={stats.passing_lessons > 0 ? 'text-pass' : undefined} />
      <Stat label="Rejected lessons" value={stats.rejected_lessons} tone={stats.rejected_lessons > 0 ? 'text-fail' : undefined} />
      <Stat label="Average attempts" value={stats.average_attempts ?? 0} />
    </dl>
  )
}

function FailureFrequency({ stats }: { stats: Stats }) {
  const failures = [...stats.rubric_failures].sort((a, b) => b.failures - a.failures)
  const highest = Math.max(1, ...failures.map((item) => item.failures))
  return (
    <Panel id="failures-heading" title="Rubric failure frequency">
      {failures.length === 0 ? (
        <p className="text-muted-foreground">No lesson has failed a quality check yet.</p>
      ) : (
        <ol className="space-y-4">
          {failures.map((item) => (
            <li key={item.criterion_id}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="font-semibold">{criterionLabel(item.criterion_id)}</span>
                <span className="whitespace-nowrap text-muted-foreground tabular-nums">{pluralise(item.failures, 'failure')}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted" aria-hidden>
                <div
                  className="bar-grow h-full rounded-full bg-primary"
                  style={{ width: `${(item.failures / highest) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function HealthValue({ good, label }: { good: boolean; label: string }) {
  const Icon = good ? CircleCheck : TriangleAlert
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', good ? 'text-pass' : 'text-fail')}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  )
}

function SystemHealth() {
  const health = useHealth()
  return (
    <Panel id="health-heading" title="System health">
      {health.isPending && <p className="text-muted-foreground">Checking...</p>}
      {health.isError && <HealthValue good={false} label="The server isn't responding" />}
      {health.data && (
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">API</dt>
            <dd>
              <HealthValue good={health.data.status === 'ok'} label={health.data.status === 'ok' ? 'Healthy' : 'Having problems'} />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Database</dt>
            <dd>
              <HealthValue good={health.data.database === 'ok'} label={health.data.database === 'ok' ? 'Connected' : 'Unavailable'} />
            </dd>
          </div>
        </dl>
      )}
    </Panel>
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
    <div>
      <PageHeader
        title="Write a lesson and have it checked"
        actions={
          <>
            <Button asChild size="lg">
              <Link to="/generate">Generate a lesson</Link>
            </Button>
            {health.data?.demo_allowed && (
              <Button variant="outline" size="lg" onClick={runDemo} disabled={active}>
                Run the demo
              </Button>
            )}
          </>
        }
      >
        The system writes a beginner lesson, checks it against 10 quality rules, and rewrites it if it fails.
      </PageHeader>

      <div className="page-body space-y-5">
        {stats.isPending && <LoadingBlock rows={3} label="Loading results" />}
        {stats.isError && (
          <ErrorBlock error={stats.error} title="Your results couldn't be loaded" onRetry={() => void stats.refetch()} />
        )}
        {stats.data && <StatBand stats={stats.data} />}
        <div className="grid items-start gap-5 lg:grid-cols-5">
          {stats.data && (
            <Panel id="recent-heading" title="Recent runs" className="lg:col-span-3">
              {stats.data.recent_runs.length === 0 ? (
                <p className="text-muted-foreground">No lessons yet. Your first one will appear here.</p>
              ) : (
                <RunsTable runs={stats.data.recent_runs} />
              )}
            </Panel>
          )}
          <div className={cn('space-y-5', stats.data ? 'lg:col-span-2' : 'lg:col-span-5')}>
            {stats.data && <FailureFrequency stats={stats.data} />}
            <SystemHealth />
          </div>
        </div>
      </div>
    </div>
  )
}
