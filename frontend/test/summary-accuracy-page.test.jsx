import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryPage from '@/pages/SummaryPage.jsx'
import { getSummary } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getSummary: vi.fn() }
})

const BASIS = 'Real demo calls only, hand-labeled, small sample. Synthetic calls are never included.'

const SUMMARY = {
  calls_analysed: 5,
  calls_with_latency: 5,
  escalated_calls: 0,
  findings: { total: 1, open: 1, confirmed: 0, dismissed: 0 },
  failure: { calls_with_confirmed_high: 0, rate: 0 },
  latency: { count: 2, avg_ms: 500, p95_ms: 600, max_ms: 600 },
  per_rule: [{ rule: 'high_latency', total: 1, open: 1, confirmed: 0, dismissed: 0 }],
  daily: [],
  scope: { source: 'real', calls_by_source: { real: 5, synthetic: 0 } },
  accuracy: {
    status: 'no_labels',
    basis: BASIS,
    labeled_calls: 0,
    n_items: 0,
    per_rule: [],
    errors: [],
  },
}

beforeEach(() => {
  getSummary.mockReset()
  getSummary.mockResolvedValue(SUMMARY)
})

describe('summary page accuracy section', () => {
  it('shows the accuracy section with the honest no-labels message', async () => {
    render(
      <MemoryRouter initialEntries={['/summary']}>
        <Routes>
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Accuracy' })).toBeInTheDocument()
    expect(screen.getByText(BASIS)).toBeInTheDocument()
    expect(screen.getByText(/No labels yet/)).toBeInTheDocument()
  })
})
