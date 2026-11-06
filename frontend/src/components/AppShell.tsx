import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle, ServerCog, TriangleAlert, Unplug } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { useHealth } from '@/lib/queries'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/generate', label: 'Generate', end: false },
  { to: '/runs', label: 'Runs', end: false },
  { to: '/memory', label: 'Memory', end: false },
  { to: '/evolution', label: 'Evolution', end: false },
]

/** Always visible, so nobody takes mock output for real model judgement. */
function ProviderBanner() {
  const health = useHealth()

  if (health.isError) {
    return (
      <div className="border-b border-fail bg-fail-soft text-fail">
        <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm font-medium sm:px-6">
          <Unplug className="mt-0.5 size-4 shrink-0" aria-hidden />
          The API can't be reached, so provider status is unknown. Check that the backend is running.
        </p>
      </div>
    )
  }
  if (!health.data) return <div className="h-9 border-b" aria-hidden />

  const { mock_mode, generator_provider, generator_model, evaluator_provider, evaluator_model } = health.data
  if (mock_mode) {
    const bothMock = generator_provider === 'mock' && evaluator_provider === 'mock'
    return (
      <div role="note" className="bg-caution text-background">
        <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm font-medium sm:px-6">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {bothMock
              ? 'Mock provider active with a rule-based evaluator. '
              : `Partly mock: generator is ${generator_provider}, evaluator is ${evaluator_provider}. `}
            Output demonstrates the pipeline, not real model judgement.
          </span>
        </p>
      </div>
    )
  }
  return (
    <div role="note" className="border-b bg-card">
      <p className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
        <ServerCog className="size-4 shrink-0" aria-hidden />
        <span>
          Generator: <span className="text-foreground">{generator_provider} {generator_model}</span>
        </span>
        <span>
          Evaluator: <span className="text-foreground">{evaluator_provider} {evaluator_model}</span>
        </span>
      </p>
    </div>
  )
}

export function AppShell() {
  const { active } = useRunStream()
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
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <Link to="/" className="flex items-center gap-2 rounded-sm py-1 font-semibold tracking-tight">
            <BrandMark className="h-4 w-auto" />
            <span>Self-Evaluating Lesson Generator</span>
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
                        'block rounded-sm px-2 py-1.5 text-sm hover:bg-muted',
                        isActive ? 'font-semibold text-primary underline underline-offset-4' : 'text-muted-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              {active && pathname !== '/generate' && (
                <li className="ml-2">
                  <Link to="/generate" className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm text-primary">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                    Run in progress
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <ProviderBanner />
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
