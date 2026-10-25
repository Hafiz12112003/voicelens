import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkbenchPage from '@/pages/WorkbenchPage.jsx'
import { analyzeCall } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, analyzeCall: vi.fn() }
})

const RESULT = {
  call_id: 'example-1',
  agent: 'restaurant-demo',
  source: 'synthetic',
  started_at: null,
  outcome: 'escalated',
  stats: {
    duration_ms: 9000,
    turn_count: 3,
    finding_count: 0,
    response_count: 1,
    avg_latency_ms: 4000,
    max_latency_ms: 4000,
  },
  turns: [
    { i: 0, speaker: 'agent', text: 'Welcome', start_ms: 0, end_ms: 1000, latency_ms: null },
    { i: 1, speaker: 'customer', text: 'A table please', start_ms: 1500, end_ms: 3000, latency_ms: null },
    { i: 2, speaker: 'agent', text: 'Slow reply', start_ms: 7000, end_ms: 9000, latency_ms: 4000 },
  ],
  tool_events: [],
  findings: [],
}

beforeEach(() => {
  analyzeCall.mockReset()
  analyzeCall.mockResolvedValue(RESULT)
  Element.prototype.scrollIntoView = vi.fn()
})

describe('workbench lanes layout', () => {
  it('puts the lanes in a full-width row above the two columns', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    expect(screen.queryByRole('region', { name: 'Conversation lanes' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load example' }))
    const lanes = await screen.findByRole('region', { name: 'Conversation lanes' }, { timeout: 3000 })
    const grid = document.querySelector('.lg\\:grid-cols-2')
    expect(grid).not.toBeNull()
    expect(grid).not.toContainElement(lanes)
    expect(grid).toContainElement(screen.getByRole('region', { name: 'Findings' }))
  })
})
