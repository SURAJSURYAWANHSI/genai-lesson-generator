import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Undo2, X } from 'lucide-react'
import { ErrorBlock } from '@/components/QueryState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, type ProposalAction } from '@/lib/api'
import { formatDate, formatPercent } from '@/lib/format'
import { invalidateRunData } from '@/lib/queries'
import type { Proposal, ProposalEvidence } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  generator_prompt: 'Generator prompt change',
  instructional_strategy: 'Instructional strategy',
  topic_guidance: 'Topic guidance',
  rubric_improvement: 'Rubric guidance',
}

/** The API records a demo split for some proposal types only, so a missing split is said out loud. */
function demoSplit(evidence: ProposalEvidence): { demo: number; organic: number } | null {
  const demo = evidence.demo_failures ?? evidence.demo_occurrences
  if (demo === undefined || evidence.count === undefined) return null
  return { demo, organic: evidence.organic_failures ?? Math.max(0, evidence.count - demo) }
}

function Evidence({ evidence }: { evidence: ProposalEvidence }) {
  const split = demoSplit(evidence)
  const items: [string, string | number][] = []
  if (evidence.count !== undefined) items.push(['Observations', evidence.count])
  if (split) {
    items.push(['Demo', split.demo], ['Organic', split.organic])
  }
  if (evidence.runs_affected !== undefined) items.push(['Runs affected', evidence.runs_affected])
  if (evidence.runs !== undefined) items.push(['Runs on topic', evidence.runs])
  if (evidence.failure_rate !== undefined) items.push(['First-attempt failure rate', formatPercent(evidence.failure_rate)])
  if (evidence.top_criterion) items.push(['Most failed', evidence.top_criterion])
  if (evidence.rejected_runs !== undefined) items.push(['Rejected runs', evidence.rejected_runs])
  return (
    <div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {!split && (
        <p className="mt-1 text-sm text-muted-foreground">The API doesn't record a demo and organic split for this type.</p>
      )}
    </div>
  )
}

export function ProposalCard({ proposal, reviewer }: { proposal: Proposal; reviewer: string }) {
  const [note, setNote] = useState('')
  const [missingReviewer, setMissingReviewer] = useState(false)
  const mutation = useMutation({
    mutationFn: (action: ProposalAction) =>
      api.decideProposal(proposal.id, action, reviewer.trim(), note.trim() || null),
    onSuccess: () => {
      setNote('')
      invalidateRunData()
    },
  })

  const decide = (action: ProposalAction) => {
    const named = reviewer.trim().length > 0
    setMissingReviewer(!named)
    if (named) mutation.mutate(action)
  }

  const canDecide = proposal.status === 'PENDING'
  const canRollBack = proposal.status === 'APPROVED'

  return (
    <li className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{proposal.title}</h3>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABELS[proposal.proposal_type] ?? proposal.proposal_type}, targets {proposal.target}.{' '}
            Proposed {formatDate(proposal.created_at)}.
          </p>
        </div>
        <StatusBadge status={proposal.status} />
      </div>
      <p className="text-sm">{proposal.rationale}</p>
      <blockquote className="border-l-4 border-primary pl-3 text-sm">
        <span className="font-medium">Proposed change: </span>
        {proposal.proposed_change}
      </blockquote>
      <Evidence evidence={proposal.evidence} />

      {proposal.decided_by && (
        <p className="text-sm text-muted-foreground">
          Decided by {proposal.decided_by}, {formatDate(proposal.decided_at)}.
          {proposal.decision_note && ` Note: ${proposal.decision_note}`}
          {proposal.previous_version !== null &&
            proposal.resulting_version !== null &&
            ` Version ${proposal.previous_version} became version ${proposal.resulting_version}.`}
          {proposal.baseline_metrics &&
            ` At approval: ${proposal.baseline_metrics.criterion_failures} failures in ${proposal.baseline_metrics.total_runs} runs.`}
        </p>
      )}

      {(canDecide || canRollBack) && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label htmlFor={`note-${proposal.id}`}>Decision note (optional)</Label>
            <Input
              id={`note-${proposal.id}`}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {canDecide && (
              <>
                <Button size="sm" disabled={mutation.isPending} onClick={() => decide('approve')}>
                  <Check aria-hidden />
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => decide('reject')}>
                  <X aria-hidden />
                  Reject
                </Button>
              </>
            )}
            {canRollBack && (
              <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => decide('rollback')}>
                <Undo2 aria-hidden />
                Roll back
              </Button>
            )}
          </div>
          {missingReviewer && !reviewer.trim() && (
            <p role="alert" className="text-sm font-medium text-fail">
              Enter a reviewer name at the top of this list first. The API records who made each decision.
            </p>
          )}
          {mutation.isError && <ErrorBlock error={mutation.error} title="The decision was not applied" />}
        </div>
      )}
    </li>
  )
}
