import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RunStreamProvider } from '@/features/workflow/RunStreamProvider'
import { queryClient } from '@/lib/queries'
import { DashboardPage } from '@/pages/DashboardPage'
import { EvolutionPage } from '@/pages/EvolutionPage'
import { GeneratePage } from '@/pages/GeneratePage'
import { MemoryPage } from '@/pages/MemoryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { RunHistoryPage } from '@/pages/RunHistoryPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RunStreamProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="generate" element={<GeneratePage />} />
              <Route path="runs" element={<RunHistoryPage />} />
              <Route path="runs/:id" element={<RunDetailPage />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="evolution" element={<EvolutionPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </RunStreamProvider>
    </QueryClientProvider>
  )
}
