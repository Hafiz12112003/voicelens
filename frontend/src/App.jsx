import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell.jsx'
import CallInspectorPage from '@/pages/CallInspectorPage.jsx'
import CallsPage from '@/pages/CallsPage.jsx'
import NotFoundPage from '@/pages/NotFoundPage.jsx'
import SummaryPage from '@/pages/SummaryPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/calls" replace />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="calls/:callId" element={<CallInspectorPage />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
