import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TopBar from '@/components/layout/TopBar.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar
        collapsed={false}
        mobileOpen={false}
        snapshot={false}
        onToggleCollapsed={vi.fn()}
        onOpenMobile={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('top bar breadcrumb', () => {
  it('titles the workbench route "Try it", and unknown routes still say Not found', () => {
    const { unmount } = renderAt('/workbench')
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(nav).getByText('Try it')).toHaveAttribute('aria-current', 'page')
    expect(within(nav).queryByText('Not found')).not.toBeInTheDocument()
    unmount()
    renderAt('/nope')
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })
})
