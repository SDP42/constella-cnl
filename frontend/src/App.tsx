import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import Landing from '@/pages/Landing'

const AppRoutes = lazy(() => import('@/app/AppRoutes'))

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Suspense fallback={<div className="grid min-h-dvh place-items-center caps">Assembling…</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app/*" element={<AppRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{ className: 'border-2 border-ink rounded-none shadow-[4px_4px_0_0_#121212]' }} />
    </QueryClientProvider>
  )
}
