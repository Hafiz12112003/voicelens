import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '@/components/layout/TopBar.jsx'
import { THEME_KEY, initTheme, setTheme } from '@/lib/theme.js'

const root = document.documentElement

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/calls']}>
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

beforeEach(() => {
  root.className = ''
})

describe('theme toggle', () => {
  it('switches between the themes and remembers the choice', async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(root).toHaveClass('light')
    expect(root).not.toHaveClass('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(root).toHaveClass('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })

  it('starts with the light theme when that choice was saved', () => {
    localStorage.setItem(THEME_KEY, 'light')
    initTheme()
    renderBar()
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })

  it('updates when the theme is changed from somewhere else', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
    act(() => {
      setTheme('light')
    })
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })
})
