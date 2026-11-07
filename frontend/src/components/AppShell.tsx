import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BadgeCheck, TriangleAlert } from 'lucide-react'
import { useHealth } from '@/lib/queries'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/generate', label: 'Generate', end: false },
  { to: '/runs', label: 'History', end: false },
  { to: '/memory', label: 'Memory', end: false },
  { to: '/evolution', label: 'Self-Evolution', end: false },
]

/** Always visible in mock mode, so nobody takes mock output for real model judgement. */
function MockBanner() {
  const { data } = useHealth()
  if (!data?.mock_mode) return null
  const bothMock = data.generator_provider === 'mock' && data.evaluator_provider === 'mock'
  return (
    <div role="note" className="border-b bg-caution-soft text-caution">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-sm font-semibold sm:px-6">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {bothMock
            ? 'Mock provider active, with a rule-based evaluator. '
            : `Partly mock: the writer is ${data.generator_provider} and the checker is ${data.evaluator_provider}. `}
          Results show how the system works, not real model judgement.
        </span>
      </p>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <MockBanner />
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-md font-display text-lg font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <BadgeCheck className="size-5" aria-hidden />
            </span>
            Self-Evaluating Lesson Generator
          </Link>
          <nav aria-label="Main" className="w-full md:ml-auto md:w-auto">
            <ul className="flex flex-wrap items-center gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200',
                        isActive ? 'bg-lime-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
