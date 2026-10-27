import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App.jsx'

describe('design route', () => {
  it('opens the design page from /design and marks it in the sidebar and the top bar', async () => {
    render(
      <MemoryRouter initialEntries={['/design']}>
        <App />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Colour tokens' }, { timeout: 10000 }),
    ).toBeInTheDocument()
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getByRole('link', { name: 'Design' })).toHaveAttribute('aria-current', 'page')
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    expect(crumbs.getByText('Design')).toHaveAttribute('aria-current', 'page')
  })
})
