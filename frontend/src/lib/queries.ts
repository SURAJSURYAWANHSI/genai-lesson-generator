import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query'
import { api, ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      // Retrying a 4xx can't help, and only delays the error state.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
})

export function useHealth() {
  // Polled so the banner stays truthful if the backend restarts with another provider.
  return useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 30_000 })
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: api.stats })
}

export function useHistory(limit: number, offset: number) {
  return useQuery({
    queryKey: ['history', limit, offset],
    queryFn: () => api.history(limit, offset),
    placeholderData: keepPreviousData,
  })
}

export function useRun(id: string) {
  return useQuery({
    queryKey: ['run', id],
    queryFn: () => api.run(id),
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? 2_000 : false),
  })
}

export function useEvaluations(id: string) {
  return useQuery({ queryKey: ['run', id, 'evaluations'], queryFn: () => api.evaluations(id) })
}

export function useRejections(id: string) {
  return useQuery({ queryKey: ['run', id, 'rejections'], queryFn: () => api.rejections(id) })
}

export function useVersions(id: string) {
  return useQuery({ queryKey: ['run', id, 'versions'], queryFn: () => api.versions(id) })
}

export function useMemoryPatterns() {
  return useQuery({ queryKey: ['memory', 'patterns'], queryFn: api.memoryPatterns })
}

export function useMemoryRecords(memoryType: string | null) {
  return useQuery({ queryKey: ['memory', 'records', memoryType], queryFn: () => api.memoryRecords(memoryType) })
}

export function useProposals() {
  return useQuery({ queryKey: ['evolution', 'proposals'], queryFn: () => api.proposals() })
}

export function useAnalysis() {
  return useQuery({ queryKey: ['evolution', 'analysis'], queryFn: api.analysis })
}

export function useMetrics() {
  return useQuery({ queryKey: ['evolution', 'metrics'], queryFn: api.metrics })
}

export function usePrompts() {
  return useQuery({ queryKey: ['evolution', 'prompts'], queryFn: api.prompts })
}

/** Every view that a finished run or an approved proposal can change. */
export function invalidateRunData() {
  for (const key of ['stats', 'history', 'memory', 'evolution', 'run']) {
    void queryClient.invalidateQueries({ queryKey: [key] })
  }
}
