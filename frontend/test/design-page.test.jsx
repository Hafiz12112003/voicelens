import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readThemeTokens } from '@/lib/designTokens.js'
import { setTheme } from '@/lib/theme.js'
import DesignPage from '@/pages/DesignPage.jsx'
import { DARK_TOKENS, LIGHT_TOKENS } from './palettes.js'

vi.mock('@/lib/designTokens.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, readThemeTokens: vi.fn() }
})

beforeEach(() => {
  document.documentElement.className = ''
  readThemeTokens.mockReset()
  readThemeTokens.mockReturnValue(LIGHT_TOKENS)
  Element.prototype.scrollIntoView = vi.fn()
})

function rowOf(table, label) {
  return within(table).getByText(label).closest('tr')
}

describe('design page', () => {
  it('shows every colour token with its value and role', () => {
    render(<DesignPage />)
    expect(screen.getByRole('heading', { level: 2, name: 'Colour tokens' })).toBeInTheDocument()
    const bg = screen.getByText('--bg').closest('li')
    expect(within(bg).getByText('#f6f7f9')).toBeInTheDocument()
    expect(within(bg).getByText('Page background')).toBeInTheDocument()
    const soft = screen.getByText('--accent-soft').closest('li')
    expect(within(soft).getByText('rgba(31,86,216,.10)')).toBeInTheDocument()
  })

  it('measures the contrast of the main pairs from the live values', () => {
    render(<DesignPage />)
    const table = screen.getByRole('table', { name: /Measured contrast/ })
    const body = rowOf(table, 'Body text on the page')
    expect(within(body).getByText('17.04:1')).toBeInTheDocument()
    expect(within(body).getByText('Passes')).toBeInTheDocument()
    const field = rowOf(table, 'Field and outline-button borders on a card')
    expect(within(field).getByText('3.60:1')).toBeInTheDocument()
    expect(within(table).queryByText(/^Below/)).not.toBeInTheDocument()
  })

  it('says plainly when a pair falls short', () => {
    readThemeTokens.mockReturnValue(DARK_TOKENS)
    render(<DesignPage />)
    const table = screen.getByRole('table', { name: /Measured contrast/ })
    const field = rowOf(table, 'Field and outline-button borders on a card')
    expect(within(field).getByText('1.50:1')).toBeInTheDocument()
    expect(within(field).getByText('Below 3:1')).toBeInTheDocument()
    const body = rowOf(table, 'Body text on the page')
    expect(within(body).getByText('15.99:1')).toBeInTheDocument()
    expect(within(body).getByText('Passes')).toBeInTheDocument()
  })

  it('reads the values again when the theme changes', () => {
    readThemeTokens.mockImplementation(() =>
      document.documentElement.classList.contains('light') ? LIGHT_TOKENS : DARK_TOKENS,
    )
    render(<DesignPage />)
    expect(screen.getByText('1.50:1')).toBeInTheDocument()
    act(() => {
      setTheme('light')
    })
    expect(screen.queryByText('1.50:1')).not.toBeInTheDocument()
    expect(screen.getByText('3.60:1')).toBeInTheDocument()
  })

  it('shows read-only samples of the real components', () => {
    render(<DesignPage />)
    expect(screen.getByText(/Sample data, not a real call/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Conversation lanes' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Findings' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Transcript' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Call timeline' })).toBeInTheDocument()
    expect(document.querySelector('[data-turn="1"]')).toHaveClass('border-primary')
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })

  it('lets the select sample change value', async () => {
    const user = userEvent.setup()
    render(<DesignPage />)
    const select = screen.getByRole('combobox', { name: 'Example select' })
    expect(select).toHaveValue('all')
    await user.selectOptions(select, 'hotel-demo')
    expect(select).toHaveValue('hotel-demo')
  })
})
