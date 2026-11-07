import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Disclosure } from '@/components/Disclosure'
import { ErrorBlock } from '@/components/QueryState'
import { DecisionStatus } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { api, type ProposalAction } from '@/lib/api'
import { formatDate, plainText, pluralise } from '@/lib/format'
import { invalidateRunData } from '@/lib/queries'
import type { Proposal } from '@/lib/types'

/** Only some proposal types carry a demo count, so the split appears only when the API sends it. */
function evidenceSentence({ count, demo_failures, demo_occurrences, organic_failures }: Proposal['evidence']): string {
  if (count === undefined) return ''
  const demo = demo_failures ?? demo_occurrences
  const seen = `Evidence: seen ${pluralise(count, 'time')}`
  if (demo === undefined) return `${seen}.`
  return `${seen}, ${demo} in demo runs and ${organic_failures ?? Math.max(0, count - demo)} in real runs.`
}

export function ProposalCard({ proposal, reviewer }: { proposal: Proposal; reviewer: string }) {
  const [missingReviewer, setMissingReviewer] = useState(false)
  const mutation = useMutation({
    mutationFn: (action: ProposalAction) => api.decideProposal(proposal.id, action, reviewer.trim()),
    onSuccess: invalidateRunData,
  })

  const decide = (action: ProposalAction) => {
    const named = reviewer.trim().length > 0
    setMissingReviewer(!named)
    if (named) mutation.mutate(action)
  }

  return (
    <li className="space-y-2 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 font-medium">{plainText(proposal.title)}</h3>
        <DecisionStatus status={proposal.status} />
      </div>
      <p className="text-muted-foreground">{plainText(proposal.rationale)}</p>
      <p className="text-muted-foreground">{evidenceSentence(proposal.evidence)}</p>
      <Disclosure summary={<span className="text-sm">Show the proposed change</span>}>
        <p className="max-w-[72ch]">{plainText(proposal.proposed_change)}</p>
      </Disclosure>
      {proposal.decided_by && proposal.decided_at && (
        <p className="text-sm text-muted-foreground">
          Decided by {proposal.decided_by}, {formatDate(proposal.decided_at)}
        </p>
      )}
      <div className="flex flex-wrap gap-2 empty:hidden">
        {proposal.status === 'PENDING' && (
          <>
            <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => decide('approve')}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => decide('reject')}>
              Reject
            </Button>
          </>
        )}
        {proposal.status === 'APPROVED' && (
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => decide('rollback')}>
            Roll back
          </Button>
        )}
      </div>
      {missingReviewer && !reviewer.trim() && (
        <p role="alert" className="text-sm font-medium text-fail">
          Enter your name above first, so the decision can be recorded.
        </p>
      )}
      {mutation.isError && <ErrorBlock error={mutation.error} title="That decision wasn't saved" />}
    </li>
  )
}
