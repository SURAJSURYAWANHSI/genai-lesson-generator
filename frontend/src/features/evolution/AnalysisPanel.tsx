import { SectionHeading } from '@/components/PageHeader'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/QueryState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPercent, sectionLabel, topicLabel } from '@/lib/format'
import { useAnalysis } from '@/lib/queries'

export function AnalysisPanel() {
  const analysis = useAnalysis()
  return (
    <section aria-labelledby="analysis-heading" className="space-y-3">
      <SectionHeading id="analysis-heading">Historical evidence</SectionHeading>
      {analysis.isPending && <LoadingBlock rows={4} label="Loading analysis" />}
      {analysis.isError && <ErrorBlock error={analysis.error} onRetry={() => void analysis.refetch()} />}
      {analysis.data &&
        (analysis.data.total_runs === 0 ? (
          <EmptyState title="No history to analyse">Evidence appears here once runs have finished.</EmptyState>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Counted from {analysis.data.total_runs} run{analysis.data.total_runs === 1 ? '' : 's'}, of which{' '}
              {analysis.data.demo_runs} {analysis.data.demo_runs === 1 ? 'is a demo' : 'are demos'}.{' '}
              {analysis.data.includes_demo_runs
                ? 'Demo runs count here, because this environment includes them.'
                : 'Demo runs are left out in this environment.'}{' '}
              {analysis.data.regeneration_patterns.runs_needing_regeneration} of{' '}
              {analysis.data.regeneration_patterns.runs_finished} finished runs needed a regeneration.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead className="text-right">Failures</TableHead>
                      <TableHead className="text-right">Demo</TableHead>
                      <TableHead className="text-right">Organic</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.data.frequent_failures.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No criterion has failed.
                        </TableCell>
                      </TableRow>
                    )}
                    {analysis.data.frequent_failures.map((item) => (
                      <TableRow key={item.criterion_id}>
                        <TableCell className="whitespace-normal">
                          {item.criterion_id} {item.criterion_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.failures}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.demo_failures}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.failures - item.demo_failures}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">First-attempt failures</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.data.topic_failure_rates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          No topic has been evaluated.
                        </TableCell>
                      </TableRow>
                    )}
                    {analysis.data.topic_failure_rates.map((item) => (
                      <TableRow key={item.topic_key}>
                        <TableCell className="whitespace-normal">{topicLabel(item.topic_key)}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.runs}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.first_attempt_failures} ({formatPercent(item.failure_rate)})
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {analysis.data.content_weaknesses.length > 0 && (
              <p className="text-sm">
                <span className="font-medium">Weakest sections: </span>
                <span className="text-muted-foreground">
                  {analysis.data.content_weaknesses
                    .slice(0, 6)
                    .map((item) => `${sectionLabel(item.section)} (${item.failures})`)
                    .join(', ')}
                </span>
              </p>
            )}
          </div>
        ))}
    </section>
  )
}
