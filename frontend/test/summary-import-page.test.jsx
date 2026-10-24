import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryPage from '@/pages/SummaryPage.jsx'
import { getSummary, importTranscripts } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getSummary: vi.fn(), importTranscripts: vi.fn() }
})

function makeSummary(overrides = {}) {
  return {
    calls_analysed: 1,
    calls_with_latency: 1,
    escalated_calls: 0,
    findings: { total: 0, open: 0, confirmed: 0, dismissed: 0 },
    failure: { calls_with_confirmed_high: 0, rate: 0 },
    latency: { count: 1, avg_ms: 500, p95_ms: 500, max_ms: 500 },
    per_rule: [],
    daily: [],
    scope: { source: 'real', calls_by_source: { real: 1, synthetic: 0 } },
    accuracy: { status: 'no_labels', basis: 'Real demo calls only.', per_rule: [], errors: [] },
    ...overrides,
  }
}

beforeEach(() => {
  getSummary.mockReset()
  importTranscripts.mockReset()
})

describe('summary page import', () => {
  it('offers import when there are no real calls and reloads after an import', async () => {
    getSummary.mockResolvedValueOnce(makeSummary({ calls_analysed: 0 }))
    getSummary.mockResolvedValue(makeSummary())
    importTranscripts.mockResolvedValue({ imported: ['real-1'], skipped: [], findings: 0 })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/summary']}>
        <Routes>
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(
      await screen.findByText('No real calls imported yet. Synthetic calls are kept separate.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Import calls' })).toBeInTheDocument()
    const chosen = new File(['[]'], 'calls.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Transcript file'), chosen)
    expect(await screen.findByText('Calls analysed')).toBeInTheDocument()
    expect(getSummary).toHaveBeenCalledTimes(2)
  })
})
