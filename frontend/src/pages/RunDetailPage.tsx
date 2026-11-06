import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { DemoTag, StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EvaluationTab } from '@/features/run-detail/EvaluationTab'
import { FeedbackTab } from '@/features/run-detail/FeedbackTab'
import { LessonTab } from '@/features/run-detail/LessonTab'
import { RejectionTab } from '@/features/run-detail/RejectionTab'
import { VersionsTab } from '@/features/run-detail/VersionsTab'
import { ApiError } from '@/lib/api'
import { formatCost, formatDate, formatNumber } from '@/lib/format'
import { useRun } from '@/lib/queries'
import type { RunDetail } from '@/lib/types'

const TABS = ['lesson', 'evaluation', 'rejections', 'versions', 'feedback']

function RunFacts({ run }: { run: RunDetail }) {
  const facts: [string, string][] = [
    ['Attempts', `${run.attempts} of ${run.max_attempts}`],
    ['Generator', `${run.model_provider} (${run.model_name})`],
    ['Evaluator', `${run.evaluator_provider} (${run.evaluator_model})`],
    ['Tokens', `${formatNumber(run.input_tokens)} in, ${formatNumber(run.output_tokens)} out`],
    ['Estimated cost', formatCost(run.estimated_cost_usd)],
    ['Memory used', run.memory_used ? 'Yes' : 'No'],
    ['Reference', run.reference_source === 'none' ? 'None' : `${run.reference_source}, ${formatNumber(run.reference_chars)} characters`],
    [
      'Versions used',
      `Generator prompt ${run.prompt_version ?? 'unknown'}, evaluator prompt ${run.evaluator_prompt_version ?? 'unknown'}, rubric ${run.rubric_version ?? 'unknown'}`,
    ],
    ['Started', formatDate(run.created_at)],
    ['Finished', formatDate(run.completed_at)],
  ]
  return (
    <dl className="grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RunDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const run = useRun(id)
  const tabParam = params.get('tab') ?? ''
  const tab = TABS.includes(tabParam) ? tabParam : 'lesson'

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link to="/runs">
        <ArrowLeft aria-hidden />
        Run history
      </Link>
    </Button>
  )

  if (run.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <LoadingBlock rows={6} label="Loading run" />
      </div>
    )
  }
  if (run.isError) {
    const missing = run.error instanceof ApiError && (run.error.status === 404 || run.error.status === 422)
    return (
      <div className="space-y-4">
        {back}
        {missing ? (
          <EmptyState title="This run doesn't exist">Check the address, or pick a run from the history.</EmptyState>
        ) : (
          <ErrorBlock error={run.error} onRetry={() => void run.refetch()} />
        )}
      </div>
    )
  }

  const data = run.data
  return (
    <div className="space-y-5">
      {back}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{data.topic}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          {data.demo_mode && <DemoTag />}
        </div>
      </header>
      {data.error_message && (
        <Alert variant="destructive" className="border-fail/50">
          <AlertTitle>The run ended with an error</AlertTitle>
          <AlertDescription>{data.error_message}</AlertDescription>
        </Alert>
      )}
      <RunFacts run={data} />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="lesson" className="flex-none">
            Lesson
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="flex-none">
            Evaluation report
          </TabsTrigger>
          <TabsTrigger value="rejections" className="flex-none">
            Rejection log ({data.rejection_count})
          </TabsTrigger>
          <TabsTrigger value="versions" className="flex-none">
            Versions
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex-none">
            Human feedback
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lesson" className="pt-4">
          <LessonTab run={data} />
        </TabsContent>
        <TabsContent value="evaluation" className="pt-4">
          <EvaluationTab runId={id} />
        </TabsContent>
        <TabsContent value="rejections" className="pt-4">
          <RejectionTab runId={id} topic={data.topic} />
        </TabsContent>
        <TabsContent value="versions" className="pt-4">
          <VersionsTab run={data} />
        </TabsContent>
        <TabsContent value="feedback" className="pt-4">
          <FeedbackTab runId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
