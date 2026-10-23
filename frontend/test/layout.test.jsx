import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CallCards from '@/components/calls/CallCards.jsx'
import CallsFilters from '@/components/calls/CallsFilters.jsx'
import CallsTable from '@/components/calls/CallsTable.jsx'

const PARAMS = {
  q: '',
  agent: '',
  source: '',
  severity: '',
  sort: 'started_at',
  order: 'desc',
  page: 1,
}

const CALL = {
  call_id: 'restaurant-001',
  agent: 'restaurant-demo',
  source: 'real',
  started_at: '2026-10-25T10:12:00Z',
  duration_ms: 125000,
  outcome: 'completed',
  findings_count: 3,
  max_severity: 'high',
  review_status: 'unreviewed',
}

function renderFilters(overrides = {}) {
  const onChange = vi.fn()
  render(
    <CallsFilters
      params={{ ...PARAMS, ...overrides }}
      agents={['hotel-demo']}
      canReset={false}
      onChange={onChange}
      onReset={() => {}}
    />,
  )
  return onChange
}

function columnClasses(calls) {
  const { container, unmount } = render(
    <MemoryRouter>
      <CallsTable calls={calls} params={PARAMS} onSort={() => {}} />
    </MemoryRouter>,
  )
  const classes = [...container.querySelectorAll('col')].map((col) => col.className)
  const fixed = container.querySelector('table').classList.contains('table-fixed')
  unmount()
  return { classes, fixed }
}

describe('search box', () => {
  it('turns spellcheck off', () => {
    renderFilters()
    expect(screen.getByRole('searchbox', { name: 'Search calls' })).toHaveAttribute(
      'spellcheck',
      'false',
    )
  })

  it('has no clear button while empty', () => {
    renderFilters()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('clears the text, updates the URL and keeps focus', async () => {
    const user = userEvent.setup()
    const onChange = renderFilters({ q: 'delhi' })
    const box = screen.getByRole('searchbox', { name: 'Search calls' })
    expect(box).toHaveValue('delhi')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(box).toHaveValue('')
    expect(onChange).toHaveBeenCalledWith({ q: '' }, { replace: true })
    expect(box).toHaveFocus()
  })
})

describe('calls table layout', () => {
  it('uses a fixed layout with seven columns that add up to 100%', () => {
    const { classes, fixed } = columnClasses([CALL])
    expect(fixed).toBe(true)
    expect(classes).toHaveLength(7)
    const total = classes
      .map((name) => Number(/\[(\d+)%\]/.exec(name)[1]))
      .reduce((sum, value) => sum + value, 0)
    expect(total).toBe(100)
  })

  it('gives the skeleton the same column widths as the loaded table', () => {
    expect(columnClasses(null).classes).toEqual(columnClasses([CALL]).classes)
  })
})

describe('table and cards breakpoints', () => {
  it('shows the table only from the lg breakpoint', () => {
    const { container } = render(
      <MemoryRouter>
        <CallsTable calls={[CALL]} params={PARAMS} onSort={() => {}} />
      </MemoryRouter>,
    )
    expect(container.firstChild).toHaveClass('hidden', 'lg:block')
    expect(container.firstChild).not.toHaveClass('md:block')
  })

  it.each([
    ['skeleton', null],
    ['loaded', [CALL]],
  ])('hides the %s cards from the lg breakpoint', (_name, calls) => {
    const { container } = render(
      <MemoryRouter>
        <CallCards calls={calls} />
      </MemoryRouter>,
    )
    const list = container.querySelector('ul')
    expect(list).toHaveClass('lg:hidden', 'md:grid', 'md:grid-cols-2')
    expect(list).not.toHaveClass('md:hidden')
  })
})
