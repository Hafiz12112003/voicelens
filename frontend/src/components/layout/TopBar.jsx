import { Menu, PanelLeft } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils.js'

const ICON_BUTTON =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--dur) ease-(--ease) hover:bg-accent hover:text-foreground'

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function crumbsFor(pathname) {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first) return [{ label: 'Calls' }]
  if (first === 'calls' && second) {
    return [{ label: 'Calls', to: '/calls' }, { label: safeDecode(second), mono: true }]
  }
  if (first === 'calls') return [{ label: 'Calls' }]
  if (first === 'summary') return [{ label: 'Summary' }]
  if (first === 'workbench') return [{ label: 'Try it' }]
  return [{ label: 'Not found' }]
}

export default function TopBar({
  collapsed,
  mobileOpen,
  snapshot,
  onToggleCollapsed,
  onOpenMobile,
}) {
  const { pathname } = useLocation()
  const crumbs = crumbsFor(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <button
        type="button"
        aria-label="Open menu"
        aria-controls="sidebar"
        aria-expanded={mobileOpen}
        onClick={onOpenMobile}
        className={cn(ICON_BUTTON, 'md:hidden')}
      >
        <Menu aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-controls="sidebar"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
        className={cn(ICON_BUTTON, 'hidden md:inline-flex')}
      >
        <PanelLeft aria-hidden="true" className="size-4" />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-2 text-base">
          {crumbs.map((crumb, index) => (
            <li key={crumb.label} className="flex min-w-0 items-center gap-2">
              {index > 0 && (
                <span aria-hidden="true" className="text-faint">
                  /
                </span>
              )}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="text-muted-foreground transition-colors duration-(--dur) ease-(--ease) hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className={cn('truncate', crumb.mono ? 'mono text-sm' : 'font-medium')}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className={cn('size-2 rounded-full', snapshot ? 'bg-medium' : 'bg-success')}
        />
        <span className="sr-only md:not-sr-only">{snapshot ? 'Snapshot' : 'Live API'}</span>
      </span>
    </header>
  )
}
