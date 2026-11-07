import {
  Ban,
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GOOD = 'bg-pass-soft text-pass'
const BAD = 'bg-fail-soft text-fail'
const BUSY = 'bg-caution-soft text-caution'
const NEUTRAL = 'bg-muted text-muted-foreground'

const STYLES: Record<string, { icon: LucideIcon; label: string; className: string; spin?: boolean }> = {
  PASS: { icon: CircleCheck, label: 'Passed', className: GOOD },
  FAIL: { icon: CircleX, label: 'Failed', className: BAD },
  REJECTED: { icon: Ban, label: 'Rejected', className: BAD },
  ERROR: { icon: TriangleAlert, label: 'Stopped with an error', className: BAD },
  RUNNING: { icon: LoaderCircle, label: 'Still running', className: BUSY, spin: true },
  PENDING: { icon: CircleDashed, label: 'Waiting for review', className: BUSY },
  APPROVED: { icon: Check, label: 'Approved', className: GOOD },
  ROLLED_BACK: { icon: Undo2, label: 'Rolled back', className: NEUTRAL },
}

function Pill({ icon: Icon, label, className, spin }: { icon: LucideIcon; label: string; className: string; spin?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold whitespace-nowrap', className)}>
      <Icon className={cn('size-4', spin && 'animate-spin')} aria-hidden />
      {label}
    </span>
  )
}

/** Status is always icon plus text, so it survives without colour. */
export function StatusBadge({ status }: { status: string }) {
  return <Pill {...(STYLES[status] ?? { icon: CircleDashed, label: status, className: NEUTRAL })} />
}

/** A proposal's REJECTED is a decision by a person, not a failed lesson, so it isn't drawn in red. */
export function DecisionStatus({ status }: { status: string }) {
  if (status !== 'REJECTED') return <StatusBadge status={status} />
  return <Pill icon={Ban} label="Rejected" className={NEUTRAL} />
}

/** The large mark beside a run's outcome headline. */
export function OutcomeMark({ status }: { status: string }) {
  const { icon: Icon, className, spin } = STYLES[status] ?? { icon: CircleDashed, className: NEUTRAL, spin: false }
  return (
    <span className={cn('grid size-12 shrink-0 place-items-center rounded-full shadow-rest', className)}>
      <Icon className={cn('size-7', spin && 'animate-spin')} aria-hidden />
    </span>
  )
}
