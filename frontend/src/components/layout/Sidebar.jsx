import { useEffect } from 'react'
import { AudioLines, FlaskConical, Gauge, Phone } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils.js'

const NAV = [
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/summary', label: 'Summary', icon: Gauge },
  { to: '/workbench', label: 'Try it', icon: FlaskConical },
]

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, onClose])

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-background/80 md:hidden"
        />
      )}
      <aside
        id="sidebar"
        aria-label="Sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-[transform,width,visibility] duration-(--dur) ease-(--ease) md:static md:z-auto md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full max-md:invisible',
          collapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <AudioLines aria-hidden="true" className="size-4" />
          </div>
          <span className={cn('text-md font-semibold', collapsed && 'md:hidden')}>VoiceLens</span>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-md px-3 text-base transition-colors duration-(--dur)ease-(--ease)',
                  isActive
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', isActive && 'text-primary')}
                  />
                  <span className={cn(collapsed && 'md:sr-only')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p
          className={cn(
            'mt-auto border-t border-border p-4 text-xs text-muted-foreground',
            collapsed && 'md:hidden',
          )}
        >
          Independent prototype inspired by Zudu&apos;s public product.
        </p>
      </aside>
    </>
  )
}
