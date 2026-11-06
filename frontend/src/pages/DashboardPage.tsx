import { Link, useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { RunsTable } from '@/features/runs/RunsTable'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { DEMO_REQUEST } from '@/lib/constants'
import { useHealth, useStats } from '@/lib/queries'
import { CRITERIA } from '@/lib/rubric'
import type { Health, Stats } from '@/lib/types'

function headline(stats: Stats): string {
  if (stats.total_runs === 0) return 'No lessons have been evaluated yet.'
  const runs = `${stats.total_runs} run${stats.total_runs === 1 ? '' : 's'}`
  return `${stats.passing_lessons} of ${runs} published a lesson.`
}

function StatRow({ stats }: { stats: Stats }) {
  const items: [string, string | number][] = [
    ['Total runs', stats.total_runs],
    ['Passing lessons', stats.passing_lessons],
    ['Rejected lessons', stats.rejected_lessons],
    ['Errored runs', stats.errored_runs],
    ['Average attempts', stats.average_attempts ?? 'None yet'],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** All ten criteria stay listed so a zero reads as "checked and never failed". */
function FailureFrequency({ stats }: { stats: Stats }) {
  const counts = new Map(stats.rubric_failures.map((item) => [item.criterion_id, item.failures]))
  const highest = Math.max(1, ...counts.values())
  return (
    <section aria-labelledby="failures-heading" className="space-y-3">
      <SectionHeading id="failures-heading">Rubric failure frequency</SectionHeading>
      <p className="text-sm text-muted-foreground">
        {counts.size === 0
          ? 'No criterion has failed yet. Bars appear here as evaluations fail.'
          : 'Failed checks per criterion, across all attempts. A single failure rejects that attempt.'}
      </p>
      <ol className="space-y-1.5">
        {CRITERIA.map(({ id, name }) => {
          const failures = counts.get(id) ?? 0
          return (
            <li key={id} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-sm sm:grid-cols-[2.5rem_11rem_1fr_2rem]">
              <span className="font-semibold tabular-nums">{id}</span>
              <span className="col-span-2 row-start-2 text-muted-foreground sm:col-span-1 sm:row-start-auto">{name}</span>
              <span className="h-4 rounded-sm bg-muted" aria-hidden>
                {failures > 0 && (
                  <span className="block h-full rounded-sm bg-fail" style={{ width: `${(failures / highest) * 100}%` }} />
                )}
              </span>
              <span className="text-right tabular-nums">
                {failures}
                <span className="sr-only"> failures</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function SystemHealth() {
  const health = useHealth()
  return (
    <section aria-labelledby="health-heading" className="space-y-3">
      <SectionHeading id="health-heading">System health</SectionHeading>
      {health.isPending && <LoadingBlock rows={4} label="Loading system health" />}
      {health.isError && <ErrorBlock error={health.error} onRetry={() => void health.refetch()} />}
      {health.data && <HealthList health={health.data} />}
    </section>
  )
}

function HealthList({ health }: { health: Health }) {
  const rows: [string, React.ReactNode][] = [
    ['API', <StatusBadge key="api" status={health.status === 'ok' ? 'PASS' : 'ERROR'} className="uppercase" />],
    ['Database', health.database === 'ok' ? 'Connected' : 'Unavailable'],
    ['Environment', health.environment],
    ['Generator', `${health.generator_provider} (${health.generator_model})`],
    ['Evaluator', `${health.evaluator_provider} (${health.evaluator_model})`],
    ['Demo mode', health.demo_allowed ? 'Allowed' : 'Disabled in this environment'],
  ]
  return (
    <dl className="divide-y rounded-lg border bg-card text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3 py-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
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
  const demoButton = health.data?.demo_allowed ? (
    <Button size="lg" onClick={runDemo} disabled={active}>
      <Play aria-hidden />
      Run assessment demo
    </Button>
  ) : null

  return (
    <div className="space-y-8">
      <PageHeader title={stats.data ? headline(stats.data) : 'Dashboard'} actions={demoButton}>
        Each lesson must pass all 10 rubric criteria to be published. No score can outvote a failed criterion.
        {health.data?.demo_allowed && (
          <> The demo injects a known defect, so you can watch the evaluator catch it and the generator repair it.</>
        )}
      </PageHeader>

      {stats.isPending && <LoadingBlock rows={6} label="Loading statistics" />}
      {stats.isError && <ErrorBlock error={stats.error} onRetry={() => void stats.refetch()} />}
      {stats.data && (
        <>
          <StatRow stats={stats.data} />
          <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
            <FailureFrequency stats={stats.data} />
            <SystemHealth />
          </div>
          <section aria-labelledby="recent-heading" className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <SectionHeading id="recent-heading">Recent runs</SectionHeading>
              {stats.data.recent_runs.length > 0 && (
                <Link to="/runs" className="rounded-sm text-sm text-primary underline underline-offset-4">
                  All runs
                </Link>
              )}
            </div>
            {stats.data.recent_runs.length === 0 ? (
              <EmptyState title="No runs yet" action={demoButton}>
                Run the assessment demo, or{' '}
                <Link to="/generate" className="text-primary underline underline-offset-4">
                  generate your own lesson
                </Link>
                .
              </EmptyState>
            ) : (
              <RunsTable runs={stats.data.recent_runs} />
            )}
          </section>
        </>
      )}
    </div>
  )
}
