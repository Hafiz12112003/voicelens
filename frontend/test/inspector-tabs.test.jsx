import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallInspectorPage from '@/pages/CallInspectorPage.jsx'
import { getCall } from '@/services/api.js'

vi.mock('@/hooks/useSnapshotMode.js', () => ({ useSnapshotMode: () => false }))
vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getCall: vi.fn(), updateFinding: vi.fn() }
})

const CALL = {
  call_id: 'call-1',
  agent: 'reservation-demo',
  source: 'synthetic',
  started_at: '2026-01-01T10:00:00Z',
  outcome: 'escalated',
  review_status: 'unreviewed',
  stats: {
    duration_ms: 5000,
    turn_count: 3,
    finding_count: 1,
    response_count: 1,
    avg_latency_ms: 500,
    max_latency_ms: 500,
  },
  turns: [
    { i: 0, speaker: 'agent', text: 'Hello', start_ms: 0, end_ms: 1000, latency_ms: null },
    { i: 1, speaker: 'customer', text: 'Hi', start_ms: 2000, end_ms: 3000, latency_ms: null },
    { i: 2, speaker: 'agent', text: 'Hello', start_ms: 3500, end_ms: 4000, latency_ms: 500 },
  ],
  tool_events: [],
  findings: [
    {
      id: 10,
      call_id: 'call-1',
      turn_index: 2,
      rule: 'repeated_agent_turn',
      severity: 'medium',
      evidence: 'Repeats turn 0',
      explanation: 'The agent repeated itself.',
      status: 'open',
      note: '',
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/calls/call-1']}>
      <Routes>
        <Route path="/calls/:callId" element={<CallInspectorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getCall.mockReset()
  getCall.mockResolvedValue(CALL)
  Element.prototype.scrollIntoView = vi.fn()
})

// jsdom applies no Tailwind CSS, so these tests check state and class names only.
// Whether a panel really hides at 768-1279px has to be checked in a browser.
describe('inspector tabs (768-1279px)', () => {
  it('switches the visible panel with the Transcript and Findings buttons', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    const transcript = document.querySelector('[data-view="transcript"]')
    const findings = document.querySelector('[data-view="findings"]')
    expect(screen.getByRole('button', { name: 'Transcript' })).toHaveAttribute('aria-pressed', 'true')
    expect(transcript).not.toHaveClass('md:max-xl:hidden')
    expect(findings).toHaveClass('md:max-xl:hidden')

    await user.click(screen.getByRole('button', { name: 'Findings 1' }))
    expect(screen.getByRole('button', { name: 'Findings 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(transcript).toHaveClass('md:max-xl:hidden')
    expect(findings).not.toHaveClass('md:max-xl:hidden')
  })

  it('returns to the transcript and scrolls when Go to turn is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    await user.click(screen.getByRole('button', { name: 'Findings 1' }))
    Element.prototype.scrollIntoView.mockClear()
    await user.click(screen.getByRole('button', { name: 'Go to turn 2' }))
    expect(screen.getByRole('button', { name: 'Transcript' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
  })
})
