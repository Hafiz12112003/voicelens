import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.jsx'
import { getSummary } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getSummary: vi.fn() }
})

const SUMMARY = {
  calls_analysed: 3,
  calls_with_latency: 3,
  escalated_calls: 0,
  findings: { total: 0, open: 0, confirmed: 0, dismissed: 0 },
  failure: { calls_with_confirmed_high: 0, rate: 0 },
  latency: { count: 3, avg_ms: 500, p95_ms: 600, max_ms: 600 },
  per_rule: [],
  daily: [],
  scope: { source: 'real', calls_by_source: { real: 3, synthetic: 0 } },
  accuracy: { status: 'no_labels', basis: 'Real demo calls only.', per_rule: [], errors: [] },
}

beforeEach(() => {
  getSummary.mockReset()
  getSummary.mockResolvedValue(SUMMARY)
})

describe('lazy summary route', () => {
  it('shows the heading at once and then loads the real page', async () => {
    render(
      <MemoryRouter initialEntries={['/summary']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Summary' })).toBeInTheDocument()
    expect(await screen.findByText('Calls analysed', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Summary' })).toBeInTheDocument()
  }, 15000)
})
