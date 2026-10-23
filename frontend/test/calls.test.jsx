import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallsPage from '@/pages/CallsPage.jsx'
import { listCalls } from '@/services/api.js'

vi.mock('@/services/api.js', () => ({
  listCalls: vi.fn(),
  isSnapshotMode: () => false,
  subscribeMode: () => () => {},
}))

const AGENTS = ['flight-demo', 'hotel-demo', 'restaurant-demo']

const ITEMS = [
  {
    call_id: 'restaurant-001',
    agent: 'restaurant-demo',
    source: 'real',
    started_at: '2026-10-25T10:12:00Z',
    duration_ms: 125000,
    outcome: 'completed',
    findings_count: 3,
    max_severity: 'high',
    review_status: 'unreviewed',
  },
  {
    call_id: 'flight-001',
    agent: 'flight-demo',
    source: 'synthetic',
    started_at: '2026-10-24T09:00:00Z',
    duration_ms: 4000,
    outcome: 'completed',
    findings_count: 0,
    max_severity: null,
    review_status: 'clean',
  },
]

function makePage(overrides = {}) {
  return {
    items: ITEMS,
    agents: AGENTS,
    page: 1,
    page_size: 20,
    total: 2,
    total_pages: 1,
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(path = '/calls') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/calls" element={<CallsPage />} />
        <Route path="/calls/:callId" element={<p>Inspector page</p>} />
        <Route path="/summary" element={<p>Summary page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const where = () => screen.getByTestId('location').textContent

beforeEach(() => {
  listCalls.mockReset()
})

describe('calls page', () => {
  it('shows a loading state and then the calls', async () => {
    listCalls.mockResolvedValue(makePage())
    renderPage()
    expect(screen.getByText('Loading calls')).toBeInTheDocument()
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: 'restaurant-001' })).toBeInTheDocument()
    expect(screen.queryByText('Loading calls')).not.toBeInTheDocument()
  })

  it('renders each call with its badges, counts and status', async () => {
    listCalls.mockResolvedValue(makePage())
    renderPage()
    const table = await screen.findByRole('table')

    const restaurant = within(table).getByRole('row', { name: /restaurant-001/ })
    expect(within(restaurant).getByText('restaurant-demo')).toBeInTheDocument()
    expect(within(restaurant).getByText('real')).toBeInTheDocument()
    expect(within(restaurant).getByText('2:05')).toBeInTheDocument()
    expect(within(restaurant).getByText('3')).toBeInTheDocument()
    expect(within(restaurant).getByText('High')).toBeInTheDocument()
    expect(within(restaurant).getByText('Unreviewed')).toBeInTheDocument()

    const flight = within(table).getByRole('row', { name: /flight-001/ })
    expect(within(flight).getByText('synthetic')).toBeInTheDocument()
    expect(within(flight).getByText('0:04')).toBeInTheDocument()
    expect(within(flight).getByText('0')).toBeInTheDocument()
    expect(within(flight).getByText('No findings')).toBeInTheDocument()
    expect(within(flight).getByText('Clean')).toBeInTheDocument()
  })

  it('links each call to its own URL', async () => {
    listCalls.mockResolvedValue(makePage())
    renderPage()
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: 'flight-001' })).toHaveAttribute(
      'href',
      '/calls/flight-001',
    )
  })

  it('opens a call when its row is clicked', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage())
    renderPage()
    const table = await screen.findByRole('table')
    await user.click(within(table).getByText('restaurant-demo'))
    expect(where()).toBe('/calls/restaurant-001')
    expect(screen.getByText('Inspector page')).toBeInTheDocument()
  })

  it('reads filters, sort and page from the URL and sends them to the API', async () => {
    listCalls.mockResolvedValue(makePage())
    renderPage(
      '/calls?q=veg&agent=hotel-demo&source=real&severity=high&sort=findings&order=asc&page=2',
    )
    await screen.findByRole('table')
    expect(listCalls).toHaveBeenCalledWith({
      q: 'veg',
      agent: 'hotel-demo',
      source: 'real',
      severity: 'high',
      sort: 'findings',
      order: 'asc',
      page: 2,
      pageSize: 20,
    })
    expect(screen.getByRole('searchbox', { name: 'Search calls' })).toHaveValue('veg')
    expect(screen.getByLabelText('Agent')).toHaveValue('hotel-demo')
    expect(screen.getByLabelText('Source')).toHaveValue('real')
    expect(screen.getByLabelText('Severity')).toHaveValue('high')
  })

  it('falls back to defaults when the URL has invalid values', async () => {
    listCalls.mockResolvedValue(makePage())
    renderPage('/calls?page=abc&sort=bogus&order=up&source=demo')
    await screen.findByRole('table')
    expect(listCalls).toHaveBeenCalledWith({
      q: '',
      agent: '',
      source: '',
      severity: '',
      sort: 'started_at',
      order: 'desc',
      page: 1,
      pageSize: 20,
    })
    expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument()
  })

  it('changing a filter updates the URL, resets to page 1 and refetches', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage({ page: 2, total: 45, total_pages: 3 }))
    renderPage('/calls?agent=flight-demo&page=2')
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Source'), 'real')
    expect(where()).toBe('/calls?agent=flight-demo&source=real')
    await waitFor(() =>
      expect(listCalls).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'real', agent: 'flight-demo', page: 1 }),
      ),
    )
  })

  it('debounces the search box and writes it to the URL', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage())
    renderPage()
    await screen.findByRole('table')
    await user.type(screen.getByRole('searchbox', { name: 'Search calls' }), 'delhi')
    await waitFor(() => expect(where()).toBe('/calls?q=delhi'))
    await waitFor(() =>
      expect(listCalls).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'delhi', page: 1 }),
      ),
    )
    expect(listCalls).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'd' }))
  })

  it('sorts numeric columns descending first and then toggles', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage())
    renderPage()
    const table = await screen.findByRole('table')
    await user.click(within(table).getByRole('button', { name: 'Findings' }))
    await waitFor(() => expect(where()).toBe('/calls?sort=findings&order=desc'))
    expect(screen.getByRole('columnheader', { name: /Findings/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Findings' }))
    await waitFor(() => expect(where()).toBe('/calls?sort=findings&order=asc'))
    expect(screen.getByRole('columnheader', { name: /Findings/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
  })

  it('sorts text columns ascending first', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage())
    renderPage()
    const table = await screen.findByRole('table')
    await user.click(within(table).getByRole('button', { name: 'Agent' }))
    await waitFor(() => expect(where()).toBe('/calls?sort=agent&order=asc'))
    expect(listCalls).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'agent', order: 'asc' }),
    )
  })

  it('paginates with Previous and Next', async () => {
    const user = userEvent.setup()
    listCalls.mockImplementation(async (args) =>
      makePage({ page: args.page, total: 45, total_pages: 3 }),
    )
    renderPage()
    expect(await screen.findByText('Page 1 of 3 \u00b7 45 calls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 2 of 3 \u00b7 45 calls')).toBeInTheDocument()
    expect(where()).toBe('/calls?page=2')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 3 of 3 \u00b7 45 calls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('shows an empty state with an import link when there are no calls', async () => {
    listCalls.mockResolvedValue(makePage({ items: [], total: 0, total_pages: 0 }))
    renderPage()
    expect(
      await screen.findByText('No calls yet. Import transcripts to get started.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Import transcripts' })).toHaveAttribute(
      'href',
      '/summary',
    )
  })

  it('shows a no-match state and clears the filters from it', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage({ items: [], total: 0, total_pages: 0 }))
    renderPage('/calls?q=zzz')
    expect(await screen.findByText('No calls match these filters.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(where()).toBe('/calls')
    await waitFor(() =>
      expect(listCalls).toHaveBeenLastCalledWith(expect.objectContaining({ q: '' })),
    )
  })

  it('handles a page past the end', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage({ items: [], total: 5, total_pages: 1, page: 9 }))
    renderPage('/calls?page=9')
    expect(await screen.findByText('That page has no calls.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to first page' }))
    expect(where()).toBe('/calls')
  })

  it('shows an error state and retries', async () => {
    const user = userEvent.setup()
    listCalls.mockRejectedValueOnce(new Error('Cannot reach the server'))
    listCalls.mockResolvedValue(makePage())
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(listCalls).toHaveBeenCalledTimes(2)
  })

  it('keeps the current rows on screen while refetching', async () => {
    const user = userEvent.setup()
    let release
    listCalls.mockResolvedValueOnce(makePage())
    listCalls.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(makePage())
        }),
    )
    renderPage()
    const table = await screen.findByRole('table')
    const wrapper = table.closest('[aria-busy]')
    expect(wrapper).toHaveAttribute('aria-busy', 'false')
    await user.click(within(table).getByRole('button', { name: 'Findings' }))
    await waitFor(() => expect(wrapper).toHaveAttribute('aria-busy', 'true'))
    expect(screen.getByRole('table')).toBe(table)
    release()
    await waitFor(() => expect(wrapper).toHaveAttribute('aria-busy', 'false'))
  })

  it('resets all filters with the Reset button', async () => {
    const user = userEvent.setup()
    listCalls.mockResolvedValue(makePage())
    renderPage('/calls?agent=hotel-demo&source=real')
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(where()).toBe('/calls')
    expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument()
  })
})
