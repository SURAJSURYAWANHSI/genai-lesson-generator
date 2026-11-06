import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { RunsTable } from '@/features/runs/RunsTable'
import { useHistory } from '@/lib/queries'

const PAGE_SIZE = 25

export function RunHistoryPage() {
  const [offset, setOffset] = useState(0)
  const history = useHistory(PAGE_SIZE, offset)

  return (
    <div className="space-y-6">
      <PageHeader title="Run history">Every run is kept, including rejected and failed ones.</PageHeader>
      {history.isPending && <LoadingBlock rows={6} label="Loading runs" />}
      {history.isError && <ErrorBlock error={history.error} onRetry={() => void history.refetch()} />}
      {history.data &&
        (history.data.total === 0 ? (
          <EmptyState
            title="No runs yet"
            action={
              <Button asChild>
                <Link to="/generate">Generate a lesson</Link>
              </Button>
            }
          >
            Runs appear here once a lesson has been generated.
          </EmptyState>
        ) : (
          <>
            <RunsTable runs={history.data.items} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <p className="tabular-nums">
                Showing {offset + 1} to {offset + history.data.items.length} of {history.data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Newer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= history.data.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Older
                </Button>
              </div>
            </div>
          </>
        ))}
    </div>
  )
}
