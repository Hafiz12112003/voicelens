import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallInspectorPage from '@/pages/CallInspectorPage.jsx'
import WorkbenchPage from '@/pages/WorkbenchPage.jsx'
import { analyzeCall, getCall } from '@/services/api.js'

vi.mock('@/hooks/useSnapshotMode.js', () => ({ useSnapshotMode: () => false }))
vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getCall: vi.fn(), analyzeCall: vi.fn() }
})

const SLOW = { timeout: 3000 }

const TURNS = [
  { i: 0, speaker: 'agent', text: 'Hello', start_ms: 0, end_ms: 1000, latency_ms: null },
  { i: 1, speaker: 'customer', text: 'Hi there', start_ms: 3000, end_ms: 4000, latency_ms: null },
  { i: 2, speaker: 'agent', text: 'Slow reply', start_ms: 8000, end_ms: 9000, latency_ms: 4000 },
]

const FINDING = {
  id: 10,
  call_id: 'call-1',
  turn_index: 2,
  rule: 'high_latency',
  severity: 'high',
  evidence: 'Gap of 4000 ms',
  explanation: 'The agent took too long.',
  status: 'open',
  note: '',
}

const DETAIL = {
  call_id: 'call-1',
  agent: 'reservation-demo',
  source: 'synthetic',
  started_at: null,
  outcome: 'escalated',
  review_status: 'unreviewed',
  stats: {
    duration_ms: 9000,
    turn_count: 3,
    finding_count: 1,
    response_count: 1,
    avg_latency_ms: 4000,
    max_latency_ms: 4000,
  },
  turns: TURNS,
  tool_events: [],
  findings: [FINDING],
}

beforeEach(() => {
  getCall.mockReset()
  analyzeCall.mockReset()
  getCall.mockResolvedValue(DETAIL)
  analyzeCall.mockResolvedValue(DETAIL)
  Element.prototype.scrollIntoView = vi.fn()
})

describe('lanes wiring', () => {
  it('inspector: clicking a lane bar scrolls to and highlights that turn', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/calls/call-1']}>
        <Routes>
          <Route path="/calls/:callId" element={<CallInspectorPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    await user.click(screen.getByRole('button', { name: 'Turn 2, agent, 8 s to 9 s' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(document.querySelector('[data-turn="2"]')).toHaveClass('border-primary')
  })

  it('workbench: clicking a lane bar scrolls to and highlights that turn', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await user.click(screen.getByRole('button', { name: 'Load example' }))
    await screen.findByRole('region', { name: 'Conversation lanes' }, SLOW)
    await user.click(screen.getByRole('button', { name: 'Turn 2, agent, 8 s to 9 s' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(document.querySelector('[data-turn="2"]')).toHaveClass('border-primary')
  })
})
