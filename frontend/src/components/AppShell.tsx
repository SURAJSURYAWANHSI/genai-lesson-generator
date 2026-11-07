import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
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
    <div role="note" className="bg-caution-soft text-caution">
      <p className="mx-auto flex max-w-4xl items-start gap-2 px-4 py-2.5 text-sm font-medium sm:px-6">
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
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 sm:px-6">
          <Link to="/" className="rounded-sm font-semibold">
            Self-Evaluating Lesson Generator
          </Link>
          <nav aria-label="Main" className="w-full md:ml-auto md:w-auto">
            <ul className="-mx-2 flex flex-wrap items-center">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-sm px-2 py-1.5 text-sm hover:text-foreground',
                        isActive ? 'font-semibold text-foreground underline underline-offset-4' : 'text-muted-foreground',
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
      <MockBanner />
      <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>
    </div>
  )
}
