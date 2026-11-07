import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, SERVER_DOWN_MESSAGE } from '@/lib/api'

export function LoadingBlock({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="panel space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function ErrorBlock({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="rounded-lg bg-fail-soft px-5 py-4 shadow-rest">
      <p className="font-semibold">{title ?? "This couldn't be loaded"}</p>
      <p className="mt-1 text-muted-foreground">{error instanceof ApiError ? error.message : SERVER_DOWN_MESSAGE}</p>
      {onRetry && (
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel">
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <p className="mt-1 text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
