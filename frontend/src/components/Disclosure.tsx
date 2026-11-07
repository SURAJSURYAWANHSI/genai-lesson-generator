import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

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
  const [opened, setOpened] = useState(defaultOpen)
  return (
    <details
      open={defaultOpen}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
      className={className}
    >
      <summary className="-mx-2 flex items-start gap-2 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-subtle">
        <ChevronRight className="disclosure-mark mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">{summary}</div>
      </summary>
      {/* The body renders once opened, because some of these hold long lesson text. */}
      <div className="pt-1 pb-4 pl-6">{opened && children}</div>
    </details>
  )
}
