import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { RunsTable } from '@/features/runs/RunsTable'
import { useHistory } from '@/lib/queries'

export function RunHistoryPage() {
  const history = useHistory()

  return (
    <div className="space-y-8">
      <PageHeader title="History" />
      {history.isPending && <LoadingBlock rows={6} label="Loading runs" />}
      {history.isError && <ErrorBlock error={history.error} onRetry={() => void history.refetch()} />}
      {history.data &&
        (history.data.items.length === 0 ? (
          <EmptyState
            title="No lessons yet"
            action={
              <Button asChild>
                <Link to="/generate">Generate a lesson</Link>
              </Button>
            }
          >
            Every lesson you generate will be listed here.
          </EmptyState>
        ) : (
          <RunsTable runs={history.data.items} />
        ))}
    </div>
  )
}
