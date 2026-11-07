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

const STYLES: Record<string, { icon: LucideIcon; label: string; className?: string; spin?: boolean }> = {
  PASS: { icon: CircleCheck, label: 'Passed', className: 'text-pass' },
  FAIL: { icon: CircleX, label: 'Failed', className: 'text-fail' },
  REJECTED: { icon: Ban, label: 'Rejected', className: 'text-fail' },
  ERROR: { icon: TriangleAlert, label: 'Stopped with an error', className: 'text-fail' },
  RUNNING: { icon: LoaderCircle, label: 'Still running', spin: true },
  PENDING: { icon: CircleDashed, label: 'Waiting for review' },
  APPROVED: { icon: Check, label: 'Approved' },
  ROLLED_BACK: { icon: Undo2, label: 'Rolled back' },
}

/** Status is always icon plus text, so it survives without colour. */
export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? { icon: CircleDashed, label: status }
  const Icon = style.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', style.className)}>
      <Icon className={cn('size-4', style.spin && 'animate-spin')} aria-hidden />
      {style.label}
    </span>
  )
}

/** A proposal's REJECTED is a decision by a person, not a failed lesson, so it isn't drawn in red. */
export function DecisionStatus({ status }: { status: string }) {
  if (status !== 'REJECTED') return <StatusBadge status={status} />
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
      <Ban className="size-4" aria-hidden />
      Rejected
    </span>
  )
}
