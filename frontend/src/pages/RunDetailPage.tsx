import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageBand } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { OutcomeMark } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EvaluationTab } from '@/features/run-detail/EvaluationTab'
import { LessonTab } from '@/features/run-detail/LessonTab'
import { RejectionTab } from '@/features/run-detail/RejectionTab'
import { ApiError } from '@/lib/api'
import { formatDate, outcomeSentence, plainText } from '@/lib/format'
import { useRun } from '@/lib/queries'

const TABS = ['lesson', 'evaluation', 'rejections']
const TRIGGER = 'h-auto flex-none rounded-md px-4 py-2'

function BackLink() {
  return (
    <Link
      to="/runs"
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      History
    </Link>
  )
}

export function RunDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const run = useRun(id)
  const tabParam = params.get('tab') ?? ''
  const tab = TABS.includes(tabParam) ? tabParam : 'lesson'

  if (run.isPending || run.isError) {
    const missing = run.error instanceof ApiError && (run.error.status === 404 || run.error.status === 422)
    return (
      <div className="mx-auto max-w-4xl">
        <PageBand>
          <BackLink />
        </PageBand>
        <div className="page-body">
          {run.isPending && <LoadingBlock rows={6} label="Loading run" />}
          {run.isError &&
            (missing ? (
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
            ))}
        </div>
      </div>
    )
  }

  const data = run.data
  const version = data.final_version ?? data.latest_version
  return (
    <div className="mx-auto max-w-4xl">
      <PageBand>
        <BackLink />
        <header className="mt-5 flex items-start gap-4">
          <OutcomeMark status={data.status} />
          <div className="min-w-0">
            <h1 className="page-title">{outcomeSentence(data.status, data.attempts)}</h1>
            <p className="mt-2 text-lg">{data.topic}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {version !== null && `Lesson version ${version}, `}
              {formatDate(data.created_at)}
            </p>
            {data.error_message && <p className="mt-3 text-muted-foreground">{plainText(data.error_message)}</p>}
          </div>
        </header>
      </PageBand>
      <div className="page-body">
        <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
          <TabsList className="w-full group-data-[orientation=horizontal]/tabs:h-auto flex-wrap justify-start gap-1 rounded-lg border bg-card p-1.5 sm:w-fit">
            <TabsTrigger value="lesson" className={TRIGGER}>
              Lesson
            </TabsTrigger>
            <TabsTrigger value="evaluation" className={TRIGGER}>
              Evaluation report
            </TabsTrigger>
            <TabsTrigger value="rejections" className={TRIGGER}>
              Rejection log ({data.rejection_count})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lesson" className="tab-enter pt-3">
            <LessonTab run={data} />
          </TabsContent>
          <TabsContent value="evaluation" className="tab-enter pt-3">
            <EvaluationTab runId={id} />
          </TabsContent>
          <TabsContent value="rejections" className="tab-enter pt-3">
            <RejectionTab runId={id} topic={data.topic} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
