import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell.jsx'
import PageHeader from '@/components/PageHeader.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import CallInspectorPage from '@/pages/CallInspectorPage.jsx'
import CallsPage from '@/pages/CallsPage.jsx'
import NotFoundPage from '@/pages/NotFoundPage.jsx'

// Summary pulls in the charting library, so it loads only when it is opened.
const SummaryPage = lazy(() => import('@/pages/SummaryPage.jsx'))

function SummaryFallback() {
  return (
    <>
      <PageHeader title="Summary" />
      <div
        aria-busy="true"
        aria-label="Loading summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} className="h-28 rounded-xl" />
        ))}
      </div>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/calls" replace />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="calls/:callId" element={<CallInspectorPage />} />
        <Route
          path="summary"
          element={
            <Suspense fallback={<SummaryFallback />}>
              <SummaryPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
