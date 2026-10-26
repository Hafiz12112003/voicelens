import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.jsx'
import TopBar from '@/components/layout/TopBar.jsx'
import { getRules } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getRules: vi.fn() }
})

beforeEach(() => {
  getRules.mockReset()
  getRules.mockResolvedValue({ rules: [], languages: [{ id: 'en', name: 'English' }] })
})

describe('rules navigation', () => {
  it('titles the rules route "Rules" in the top bar', () => {
    render(
      <MemoryRouter initialEntries={['/rules']}>
        <TopBar
          collapsed={false}
          mobileOpen={false}
          snapshot={false}
          onToggleCollapsed={vi.fn()}
          onOpenMobile={vi.fn()}
        />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(nav).getByText('Rules')).toHaveAttribute('aria-current', 'page')
  })

  it('opens the rules page from /rules and marks it in the sidebar', async () => {
    render(
      <MemoryRouter initialEntries={['/rules']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Rules' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveAttribute('aria-current', 'page')
  })
})
