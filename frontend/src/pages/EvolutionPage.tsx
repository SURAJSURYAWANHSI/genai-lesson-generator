import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProposalCard } from '@/features/evolution/ProposalCard'
import { PromptVersions } from '@/features/evolution/PromptVersions'
import { useProposals } from '@/lib/queries'
import type { ProposalStatus } from '@/lib/types'

const ORDER: Record<ProposalStatus, number> = { PENDING: 0, APPROVED: 1, ROLLED_BACK: 2, REJECTED: 3 }

export function EvolutionPage() {
  const proposals = useProposals()
  const [reviewer, setReviewer] = useState('')
  const sorted = [...(proposals.data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Self-Evolution">
        Improvements the system suggests from past results, which only take effect once a person approves them.
      </PageHeader>
      <div className="page-body space-y-5">
      <Panel id="proposals-heading" title="Proposed improvements">
        {proposals.isPending && <LoadingBlock rows={3} label="Loading proposed improvements" />}
        {proposals.isError && (
          <ErrorBlock
            error={proposals.error}
            title="Proposed improvements couldn't be loaded"
            onRetry={() => void proposals.refetch()}
          />
        )}
        {proposals.data?.length === 0 && (
          <EmptyState
            title="No improvements proposed yet"
            action={
              <Button asChild>
                <Link to="/generate">Generate a lesson</Link>
              </Button>
            }
          >
            Suggestions appear once the same problem has come up a few times.
          </EmptyState>
        )}
        {sorted.length > 0 && (
          <>
            <div className="mb-6 max-w-xs space-y-1.5">
              <Label htmlFor="reviewer">Your name</Label>
              <Input
                id="reviewer"
                maxLength={120}
                value={reviewer}
                autoComplete="name"
                onChange={(event) => setReviewer(event.target.value)}
              />
            </div>
            <ul className="divide-y">
              {sorted.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} reviewer={reviewer} />
              ))}
            </ul>
          </>
        )}
      </Panel>
      <PromptVersions />
      </div>
    </div>
  )
}
