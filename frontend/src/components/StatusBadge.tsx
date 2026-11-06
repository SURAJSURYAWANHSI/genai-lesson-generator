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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STYLES: Record<string, { icon: LucideIcon; className: string; label?: string; spin?: boolean }> = {
  PASS: { icon: CircleCheck, className: 'bg-pass-soft text-pass' },
  FAIL: { icon: CircleX, className: 'bg-fail-soft text-fail' },
  REJECTED: { icon: Ban, className: 'bg-fail text-fail-contrast' },
  ERROR: { icon: TriangleAlert, className: 'bg-caution-soft text-caution' },
  RUNNING: { icon: LoaderCircle, className: 'bg-muted text-foreground', spin: true },
  PENDING: { icon: CircleDashed, className: 'bg-muted text-foreground' },
  APPROVED: { icon: Check, className: 'bg-pass-soft text-pass' },
  ROLLED_BACK: { icon: Undo2, className: 'bg-caution-soft text-caution', label: 'ROLLED BACK' },
}

/** Status is always icon plus text, so it survives without colour. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLES[status] ?? { icon: CircleDashed, className: 'bg-muted text-foreground' }
  const Icon = style.icon
  return (
    <Badge className={cn('gap-1 rounded-sm border-transparent font-semibold tabular-nums', style.className, className)}>
      <Icon className={cn('size-3.5', style.spin && 'animate-spin')} aria-hidden />
      {style.label ?? status}
    </Badge>
  )
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <Badge className={cn('rounded-sm border-caution bg-caution-soft font-medium text-caution', className)}>Demo</Badge>
  )
}
