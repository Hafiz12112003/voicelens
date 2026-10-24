import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useSnapshotMode } from '@/hooks/useSnapshotMode.js'
import { retryLive } from '@/services/api.js'
import Sidebar from './Sidebar.jsx'
import SnapshotBanner from './SnapshotBanner.jsx'
import TopBar from './TopBar.jsx'

const STORAGE_KEY = 'voicelens.sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const snapshot = useSnapshotMode()

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  }

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={closeMobile} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          snapshot={snapshot}
          onToggleCollapsed={toggleCollapsed}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <SnapshotBanner visible={snapshot} onRetry={retryLive} />
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-[1280px] p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
