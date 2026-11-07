import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The top of a page, holding its title and main actions. */
export function PageBand({ children }: { children: ReactNode }) {
  return <div className="page-band">{children}</div>
}

export function PageHeader({
  title,
  children,
  actions,
}: {
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <PageBand>
      <h1 className="page-title">{title}</h1>
      {children && <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">{children}</p>}
      {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
    </PageBand>
  )
}

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-xl font-bold">
      {children}
    </h2>
  )
}

export function Panel({
  id,
  title,
  aside,
  children,
  className,
}: {
  id: string
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn('panel', className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionHeading id={id}>{title}</SectionHeading>
        {aside}
      </div>
      {children}
    </section>
  )
}
