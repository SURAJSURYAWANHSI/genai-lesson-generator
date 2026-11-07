import { useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { GenerateForm } from '@/features/generate/GenerateForm'
import { useRunStream } from '@/features/workflow/runStreamContext'
import { WorkflowPanel } from '@/features/workflow/WorkflowPanel'

export function GeneratePage() {
  const { state, reset } = useRunStream()
  const running = state.phase !== 'idle' && !(state.phase === 'failed' && state.runId === null)

  // A finished run is in History, so coming back here always starts from a fresh form.
  useEffect(() => reset, [reset])

  useEffect(() => {
    if (running) window.scrollTo(0, 0)
  }, [running])

  return (
    <div className={running ? 'mx-auto max-w-6xl' : 'mx-auto max-w-3xl'}>
      {running ? (
        <WorkflowPanel />
      ) : (
        <PageHeader title="Generate a lesson">The defaults are ready to go. Change anything you like.</PageHeader>
      )}
      {/* Stays mounted during a run, so "Generate another lesson" returns to the same entries. */}
      <div hidden={running} className="page-body">
        <GenerateForm />
      </div>
    </div>
  )
}
