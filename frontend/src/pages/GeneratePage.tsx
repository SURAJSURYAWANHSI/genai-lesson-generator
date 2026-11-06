import { useEffect, useRef } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { GenerateForm } from '@/features/generate/GenerateForm'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { WorkflowPanel } from '@/features/workflow/WorkflowPanel'

export function GeneratePage() {
  const { state } = useRunStream()
  const panel = useRef<HTMLDivElement>(null)
  const connecting = state.phase === 'connecting'

  // On a phone the panel sits under a long form, so bring it into view when a run starts.
  useEffect(() => {
    if (connecting && window.matchMedia('(max-width: 1023px)').matches) {
      panel.current?.scrollIntoView({ block: 'start' })
    }
  }, [connecting])

  return (
    <div className="space-y-6">
      <PageHeader title="Generate a lesson">
        The lesson is written, checked against the rubric, and sent back with feedback if any criterion fails.
      </PageHeader>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
        <GenerateForm />
        <div ref={panel} className="scroll-mt-4">
          <WorkflowPanel />
        </div>
      </div>
    </div>
  )
}
