import { Check, X } from 'lucide-react'
import { CRITERIA } from '@/lib/rubric'
import { cn } from '@/lib/utils'

type CellState = 'pass' | 'fail' | 'waiting'

/**
 * The product's signature: ten cells, one per criterion. One failed cell rejects the lesson,
 * so a failure is drawn as a solid block that can't be averaged away by its neighbours.
 */
export function RubricStrip({
  failed,
  waiting = false,
  label,
}: {
  failed: string[]
  waiting?: boolean
  label: string
}) {
  const stateOf = (id: string): CellState => (waiting ? 'waiting' : failed.includes(id) ? 'fail' : 'pass')
  return (
    <ul className="grid grid-cols-5 gap-1 sm:grid-cols-10" aria-label={label}>
      {CRITERIA.map(({ id, name }) => {
        const state = stateOf(id)
        const word = state === 'pass' ? 'PASS' : state === 'fail' ? 'FAIL' : 'not checked yet'
        return (
          <li
            key={id}
            title={`${id} ${name}: ${word}`}
            className={cn(
              'flex items-center justify-center gap-1 rounded-sm border px-1 py-1.5 text-xs tabular-nums',
              state === 'pass' && 'border-pass/40 bg-pass-soft text-pass',
              state === 'fail' && 'border-fail bg-fail font-semibold text-fail-contrast',
              state === 'waiting' && 'border-dashed text-muted-foreground',
            )}
          >
            <span className="sr-only">
              {id} {name}: {word}.
            </span>
            <span aria-hidden>{id}</span>
            {state === 'pass' && <Check className="size-3" aria-hidden />}
            {state === 'fail' && <X className="size-3" aria-hidden />}
          </li>
        )
      })}
    </ul>
  )
}
