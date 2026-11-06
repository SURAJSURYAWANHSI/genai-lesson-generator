import { createContext, useContext } from 'react'
import type { GenerateLessonRequest } from '@/lib/types'
import type { RunStreamState } from './runReducer'

export interface RunStreamValue {
  state: RunStreamState
  active: boolean
  start: (request: GenerateLessonRequest) => void
  stop: () => void
  reset: () => void
}

export const RunStreamContext = createContext<RunStreamValue | null>(null)

export function useRunStream(): RunStreamValue {
  const value = useContext(RunStreamContext)
  if (!value) throw new Error('useRunStream must be used inside RunStreamProvider')
  return value
}
