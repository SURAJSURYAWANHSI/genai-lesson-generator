import { CircleCheck } from 'lucide-react'
import { Disclosure } from '@/components/Disclosure'
import { SectionHeading } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatPercent } from '@/lib/format'
import { useMetrics, usePrompts } from '@/lib/queries'
import type { PromptVersion } from '@/lib/types'

function PromptRow({ prompt }: { prompt: PromptVersion }) {
  return (
    <Disclosure
      summary={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium capitalize tabular-nums">
            {prompt.name} version {prompt.version}
          </span>
          {prompt.is_active && (
            <span className="inline-flex items-center gap-1 font-medium text-pass">
              <CircleCheck className="size-4" aria-hidden />
              Active
            </span>
          )}
          <span className="text-muted-foreground">{prompt.change_summary}</span>
        </span>
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        Created by {prompt.created_by}, {formatDate(prompt.created_at)}.
      </p>
      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
        {prompt.content}
      </pre>
    </Disclosure>
  )
}

export function PromptVersions() {
  const prompts = usePrompts()
  return (
    <section aria-labelledby="prompts-heading" className="space-y-3">
      <SectionHeading id="prompts-heading">Prompt versions</SectionHeading>
      {prompts.isPending && <LoadingBlock rows={2} label="Loading prompt versions" />}
      {prompts.isError && <ErrorBlock error={prompts.error} onRetry={() => void prompts.refetch()} />}
      {prompts.data?.length === 0 && <EmptyState title="No prompts stored" />}
      <div className="space-y-1.5">
        {prompts.data?.map((prompt) => (
          <PromptRow key={prompt.id} prompt={prompt} />
        ))}
      </div>
    </section>
  )
}

export function PromptMetricsTable() {
  const metrics = useMetrics()
  return (
    <section aria-labelledby="metrics-heading" className="space-y-3">
      <SectionHeading id="metrics-heading">Results per generator prompt version</SectionHeading>
      {metrics.isPending && <LoadingBlock rows={2} label="Loading metrics" />}
      {metrics.isError && <ErrorBlock error={metrics.error} onRetry={() => void metrics.refetch()} />}
      {metrics.data?.length === 0 && (
        <EmptyState title="No finished runs to compare">
          Results appear here per version, so you can see whether an approved change helped.
        </EmptyState>
      )}
      {metrics.data && metrics.data.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Demo runs</TableHead>
                <TableHead className="text-right">Pass rate</TableHead>
                <TableHead className="text-right">First-attempt pass</TableHead>
                <TableHead className="text-right">Average attempts</TableHead>
                <TableHead>Failures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.data.map((row) => (
                <TableRow key={row.prompt_version}>
                  <TableCell className="tabular-nums">{row.prompt_version}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.runs}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.demo_runs}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.pass_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.first_attempt_pass_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.average_attempts}</TableCell>
                  <TableCell className="tabular-nums">
                    {Object.entries(row.criterion_failures)
                      .map(([id, count]) => `${id}: ${count}`)
                      .join(', ') || 'None'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
