import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryPage from '@/pages/SummaryPage.jsx'
import { getSummary } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getSummary: vi.fn() }
})

function makeSummary(source = 'real', overrides = {}) {
  return {
    calls_analysed: 5,
    calls_with_latency: 5,
    escalated_calls: 1,
    findings: { total: 6, open: 5, confirmed: 1, dismissed: 0 },
    failure: { calls_with_confirmed_high: 0, rate: 0 },
    latency: { count: 7, avg_ms: 743, p95_ms: 2400, max_ms: 2400 },
    per_rule: [],
    daily: [
      { date: '2026-10-20', calls: 1, findings: 2, avg_latency_ms: 1400 },
      { date: '2026-10-21', calls: 1, findings: 1, avg_latency_ms: 600 },
      { date: '2026-10-22', calls: 2, findings: 1, avg_latency_ms: 450 },
      { date: '2026-10-23', calls: 1, findings: 2, avg_latency_ms: 450 },
    ],
    scope: { source, calls_by_source: { real: 0, synthetic: 5 } },
    accuracy: { status: 'no_labels', per_rule: [], errors: [] },
    ...overrides,
  }
}

function renderPage(path = '/summary') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/summary" element={<SummaryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function card(label) {
  return screen.getByText(label).closest('div')
}

beforeEach(() => {
  getSummary.mockReset()
  getSummary.mockImplementation(async ({ source }) => makeSummary(source))
})

describe('summary page', () => {
  it('shows the KPI cards with their values', async () => {
    renderPage()
    await screen.findByText('Calls analysed')
    expect(within(card('Calls analysed')).getByText('5')).toBeInTheDocument()
    expect(within(card('Findings')).getByText('6')).toBeInTheDocument()
    expect(within(card('Confirmed / dismissed')).getByText('1 / 0')).toBeInTheDocument()
    expect(within(card('Failure rate')).getByText('0%')).toBeInTheDocument()
    expect(within(card('Avg latency')).getByText('743 ms')).toBeInTheDocument()
    expect(within(card('P95 latency')).getByText('2,400 ms')).toBeInTheDocument()
  })

  it('draws a sparkline only for the cards that have a daily series', async () => {
    renderPage()
    await screen.findByText('Calls analysed')
    expect(document.querySelectorAll('polyline')).toHaveLength(3)
  })

  it('reports escalated calls separately from failures', async () => {
    renderPage()
    expect(await screen.findByText(/Escalated calls: 1\./)).toHaveTextContent(/not counted as failures/)
  })

  it('shows an honest empty state for real calls and can switch to synthetic', async () => {
    getSummary.mockImplementation(async ({ source }) =>
      source === 'real' ? makeSummary('real', { calls_analysed: 0, daily: [] }) : makeSummary(source),
    )
    const user = userEvent.setup()
    renderPage()
    expect(
      await screen.findByText('No real calls imported yet. Synthetic calls are kept separate.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show synthetic calls' }))
    expect(await screen.findByText('Calls analysed')).toBeInTheDocument()
    expect(getSummary).toHaveBeenLastCalledWith({ source: 'synthetic' })
  })

  it('switches the source, refetches and explains the combined view', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Calls analysed')
    expect(screen.getByRole('button', { name: 'Real' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(
      await screen.findByText(
        'Real and synthetic calls combined. Accuracy never includes synthetic calls.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(getSummary).toHaveBeenLastCalledWith({ source: 'all' })
  })

  it('shows an error state and retries', async () => {
    getSummary.mockRejectedValueOnce(new Error('Server error'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Calls analysed')).toBeInTheDocument()
  })
})
