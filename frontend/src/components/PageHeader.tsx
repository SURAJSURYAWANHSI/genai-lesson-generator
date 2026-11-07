import type { ReactNode } from 'react'

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
      {children && <p className="mt-2 max-w-prose text-lg text-muted-foreground">{children}</p>}
    </header>
  )
}

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-xl font-semibold tracking-tight">
      {children}
    </h2>
  )
}
