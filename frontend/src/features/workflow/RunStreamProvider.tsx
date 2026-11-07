import { useCallback, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { ApiError, SERVER_DOWN_MESSAGE, streamGenerate } from '@/lib/api'
import { invalidateRunData } from '@/lib/queries'
import type { GenerateLessonRequest } from '@/lib/types'
import { initialRunState, runReducer } from './runReducer'
import { RunStreamContext } from './runStreamContext'

/**
 * Owns the one active stream above the router. The backend closes a run as an error when its
 * client disconnects, so moving to another page must not end the fetch.
 */
export function RunStreamProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, initialRunState)
  const running = useRef(false)

  const start = useCallback((request: GenerateLessonRequest) => {
    if (running.current) return
    running.current = true
    dispatch({ type: 'begin', request })

    void (async () => {
      let started = false
      let ended = false
      try {
        for await (const event of streamGenerate(request)) {
          started = true
          ended = event.type === 'complete' || event.type === 'error'
          // The final event settles the run, even if the connection takes a moment longer to close.
          if (ended) running.current = false
          dispatch({ type: 'event', event })
        }
        if (!ended) {
          dispatch({ type: 'disconnected', message: 'The connection closed before the run finished.' })
        }
      } catch (error) {
        if (error instanceof ApiError) {
          dispatch({ type: 'refused', message: error.message })
        } else if (!started) {
          dispatch({ type: 'refused', message: SERVER_DOWN_MESSAGE })
        } else {
          dispatch({ type: 'disconnected', message: 'The connection was lost before the run finished.' })
        }
      } finally {
        running.current = false
        invalidateRunData()
      }
    })()
  }, [])

  const reset = useCallback(() => {
    if (!running.current) dispatch({ type: 'reset' })
  }, [])

  const value = useMemo(
    () => ({ state, active: state.phase === 'connecting' || state.phase === 'streaming', start, reset }),
    [state, start, reset],
  )

  return <RunStreamContext.Provider value={value}>{children}</RunStreamContext.Provider>
}
