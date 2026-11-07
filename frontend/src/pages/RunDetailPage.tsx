import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EvaluationTab } from '@/features/run-detail/EvaluationTab'
import { LessonTab } from '@/features/run-detail/LessonTab'
import { RejectionTab } from '@/features/run-detail/RejectionTab'
import { ApiError } from '@/lib/api'
import { formatDate, outcomeSentence, plainText } from '@/lib/format'
import { useRun } from '@/lib/queries'
import { cn } from '@/lib/utils'

const TABS = ['lesson', 'evaluation', 'rejections']

export function RunDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const run = useRun(id)
  const tabParam = params.get('tab') ?? ''
  const tab = TABS.includes(tabParam) ? tabParam : 'lesson'

  const back = (
    <Link to="/runs" className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      History
    </Link>
  )

  if (run.isPending) return <LoadingBlock rows={6} label="Loading run" />
  if (run.isError) {
    const missing = run.error instanceof ApiError && (run.error.status === 404 || run.error.status === 422)
    return missing ? (
      <EmptyState
        title="This run doesn't exist"
        action={
          <Button asChild>
            <Link to="/runs">Go to History</Link>
          </Button>
        }
      >
        It may have been removed, or the address may be mistyped.
      </EmptyState>
    ) : (
      <ErrorBlock error={run.error} title="This run couldn't be loaded" onRetry={() => void run.refetch()} />
    )
  }

  const data = run.data
  const version = data.final_version ?? data.latest_version
  const failed = data.status === 'REJECTED' || data.status === 'ERROR'
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {back}
        <header>
          <h1
            className={cn(
              'text-3xl font-semibold tracking-tight',
              data.status === 'PASS' && 'text-pass',
              failed && 'text-fail',
            )}
          >
            {outcomeSentence(data.status, data.attempts)}
          </h1>
          <p className="mt-2 text-lg">{data.topic}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {version !== null && `Lesson version ${version}, `}
            {formatDate(data.created_at)}
          </p>
          {data.error_message && <p className="mt-3 text-muted-foreground">{plainText(data.error_message)}</p>}
        </header>
      </div>
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start border-b">
          <TabsTrigger value="lesson" className="flex-none">
            Lesson
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="flex-none">
            Evaluation report
          </TabsTrigger>
          <TabsTrigger value="rejections" className="flex-none">
            Rejection log ({data.rejection_count})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lesson" className="pt-6">
          <LessonTab run={data} />
        </TabsContent>
        <TabsContent value="evaluation" className="pt-6">
          <EvaluationTab runId={id} />
        </TabsContent>
        <TabsContent value="rejections" className="pt-6">
          <RejectionTab runId={id} topic={data.topic} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
