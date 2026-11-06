import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AnalysisPanel } from '@/features/evolution/AnalysisPanel'
import { PromptMetricsTable, PromptVersions } from '@/features/evolution/PromptPanels'
import { ProposalCard } from '@/features/evolution/ProposalCard'
import { api } from '@/lib/api'
import { invalidateRunData, useProposals } from '@/lib/queries'
import type { ProposalStatus } from '@/lib/types'

const ORDER: Record<ProposalStatus, number> = { PENDING: 0, APPROVED: 1, ROLLED_BACK: 2, REJECTED: 3 }

export function EvolutionPage() {
  const proposals = useProposals()
  const [reviewer, setReviewer] = useState('')
  const analyse = useMutation({ mutationFn: api.analyze, onSuccess: invalidateRunData })
  const sorted = [...(proposals.data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Self-evolution"
        actions={
          <Button onClick={() => analyse.mutate()} disabled={analyse.isPending}>
            <Search aria-hidden />
            Analyse history
          </Button>
        }
      >
        The system proposes changes from counted evidence. Nothing changes a prompt or the rubric until a named person
        approves it, and an approval can be rolled back.
      </PageHeader>

      {analyse.isError && <ErrorBlock error={analyse.error} title="The analysis failed" />}
      {analyse.isSuccess && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
          {analyse.data.length === 0
            ? 'Analysis finished. No new proposals: the evidence has not reached a threshold, or a matching proposal already exists.'
            : `Analysis finished. ${analyse.data.length} new proposal${analyse.data.length === 1 ? '' : 's'} added.`}
        </p>
      )}

      <section aria-labelledby="proposals-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading id="proposals-heading">Proposed improvements</SectionHeading>
          <div className="w-full space-y-1 sm:w-64">
            <Label htmlFor="reviewer">Reviewer name (required to decide)</Label>
            <Input
              id="reviewer"
              maxLength={120}
              value={reviewer}
              autoComplete="name"
              onChange={(event) => setReviewer(event.target.value)}
            />
          </div>
        </div>
        {proposals.isPending && <LoadingBlock rows={3} label="Loading proposals" />}
        {proposals.isError && <ErrorBlock error={proposals.error} onRetry={() => void proposals.refetch()} />}
        {proposals.data?.length === 0 && (
          <EmptyState title="No proposals yet">
            Proposals appear when evidence reaches a threshold, for example a criterion failing three times. Each
            finished run checks automatically, or use Analyse history.
          </EmptyState>
        )}
        <ul className="space-y-3">
          {sorted.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} reviewer={reviewer} />
          ))}
        </ul>
      </section>

      <AnalysisPanel />
      <PromptMetricsTable />
      <PromptVersions />
    </div>
  )
}
