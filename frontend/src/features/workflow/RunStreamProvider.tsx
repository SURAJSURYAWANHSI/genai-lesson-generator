import { useCallback, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { ApiError, streamGenerate } from '@/lib/api'
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
  const controller = useRef<AbortController | null>(null)

  const start = useCallback((request: GenerateLessonRequest) => {
    if (controller.current) return
    const abort = new AbortController()
    controller.current = abort
    dispatch({ type: 'begin', request, at: Date.now() })

    void (async () => {
      let started = false
      let ended = false
      try {
        for await (const event of streamGenerate(request, abort.signal)) {
          started = true
          ended = event.type === 'complete' || event.type === 'error'
          dispatch({ type: 'event', event, at: Date.now() })
        }
        if (!ended) {
          dispatch({ type: 'disconnected', message: 'The connection closed before the run finished.' })
        }
      } catch (error) {
        if (abort.signal.aborted) {
          dispatch({ type: 'stopped' })
        } else if (error instanceof ApiError || !started) {
          const message = error instanceof Error ? error.message : 'The request failed.'
          dispatch({
            type: 'refused',
            message: error instanceof ApiError ? message : `The API could not be reached. ${message}`,
          })
        } else {
          dispatch({ type: 'disconnected', message: 'The connection was lost before the run finished.' })
        }
      } finally {
        controller.current = null
        invalidateRunData()
      }
    })()
  }, [])

  const stop = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  const value = useMemo(
    () => ({
      state,
      active: state.phase === 'connecting' || state.phase === 'streaming',
      start,
      stop,
      reset,
    }),
    [state, start, stop, reset],
  )

  return <RunStreamContext.Provider value={value}>{children}</RunStreamContext.Provider>
}
