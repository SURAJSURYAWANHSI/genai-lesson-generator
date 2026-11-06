import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Native details/summary, so keyboard and screen reader behaviour come for free. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details open={defaultOpen} className={cn('rounded-md border bg-card', className)}>
      <summary className="flex items-start gap-2 rounded-md px-3 py-2.5 hover:bg-muted/60">
        <ChevronRight className="disclosure-mark mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">{summary}</div>
      </summary>
      <div className="border-t px-3 py-3">{children}</div>
    </details>
  )
}
