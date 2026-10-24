import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallInspectorPage from '@/pages/CallInspectorPage.jsx'
import { getCall, updateFinding } from '@/services/api.js'

const mode = vi.hoisted(() => ({ snapshot: false }))
vi.mock('@/hooks/useSnapshotMode.js', () => ({ useSnapshotMode: () => mode.snapshot }))
vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getCall: vi.fn(), updateFinding: vi.fn() }
})

function makeCall(overrides = {}) {
  return {
    call_id: 'call-1',
    agent: 'reservation-demo',
    source: 'synthetic',
    started_at: '2026-01-01T10:00:00Z',
    outcome: 'escalated',
    review_status: 'unreviewed',
    stats: {
      duration_ms: 11000,
      turn_count: 5,
      finding_count: 2,
      response_count: 2,
      avg_latency_ms: 2250,
      max_latency_ms: 4000,
    },
    turns: [
      { i: 0, speaker: 'agent', text: 'Hello', start_ms: 0, end_ms: 1000, latency_ms: null },
      { i: 1, speaker: 'customer', text: 'Hi there', start_ms: 3000, end_ms: 4000, latency_ms: null },
      { i: 2, speaker: 'agent', text: 'Slow reply', start_ms: 8000, end_ms: 9000, latency_ms: 4000 },
      { i: 3, speaker: 'customer', text: 'Okay', start_ms: 9500, end_ms: 10000, latency_ms: null },
      { i: 4, speaker: 'agent', text: 'Fast reply', start_ms: 10500, end_ms: 11000, latency_ms: 500 },
    ],
    tool_events: [],
    findings: [
      {
        id: 10,
        call_id: 'call-1',
        turn_index: 2,
        rule: 'high_latency',
        severity: 'high',
        evidence: 'Gap of 4000 ms',
        explanation: 'The agent took too long.',
        status: 'open',
        note: '',
      },
      {
        id: 11,
        call_id: 'call-1',
        turn_index: 4,
        rule: 'repeated_agent_turn',
        severity: 'medium',
        evidence: 'Repeats turn 0',
        explanation: 'The agent repeated itself.',
        status: 'open',
        note: '',
      },
    ],
    ...overrides,
  }
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

function activeCards() {
  return document.querySelectorAll('[data-finding-id][aria-current="true"]')
}

function stat(label) {
  return screen.getByText(label).closest('div')
}

beforeEach(() => {
  mode.snapshot = false
  getCall.mockReset()
  updateFinding.mockReset()
  getCall.mockResolvedValue(makeCall())
  updateFinding.mockResolvedValue({})
  Element.prototype.scrollIntoView = vi.fn()
})

describe('call inspector page', () => {
  it('shows the header and stats', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'call-1' })).toBeInTheDocument()
    expect(screen.getByText('reservation-demo')).toBeInTheDocument()
    expect(screen.getByText('escalated')).toBeInTheDocument()
    expect(within(stat('Duration')).getByText('0:11')).toBeInTheDocument()
    expect(within(stat('Avg latency')).getByText('2,250 ms')).toBeInTheDocument()
    expect(within(stat('Max latency')).getByText('4,000 ms')).toBeInTheDocument()
  })

  it('shows one clickable timeline segment per finding turn', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    const group = screen.getByRole('group', { name: 'Call timeline' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAccessibleName('Turn 2: 1 finding, high severity')
    expect(buttons[1]).toHaveAccessibleName('Turn 4: 1 finding, medium severity')
  })

  it('scrolls to the turn when a timeline segment is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    await user.click(screen.getByRole('button', { name: 'Turn 2: 1 finding, high severity' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    const row = document.querySelector('[data-turn="2"]')
    expect(row).toHaveClass('border-primary')
  })

  it('steps through findings with j and k and stops at the ends', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    await user.keyboard('j')
    expect(activeCards()).toHaveLength(1)
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '10')
    await user.keyboard('j')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '11')
    await user.keyboard('j')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '11')
    await user.keyboard('k')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '10')
    await user.keyboard('k')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '10')
  })

  it('clears the active finding with Escape', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    await user.keyboard('j')
    expect(activeCards()).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(activeCards()).toHaveLength(0)
  })

  it('ignores j and k while typing in a note', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    await user.click(screen.getAllByRole('button', { name: 'Note' })[0])
    const box = screen.getByLabelText('Note for this finding')
    await user.type(box, 'jk')
    expect(box).toHaveValue('jk')
    expect(activeCards()).toHaveLength(0)
  })

  it('labels a slow gap as slow and a normal gap as not slow', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    expect(screen.getByText(/response time, slow/)).toBeInTheDocument()
    expect(screen.getAllByText(/response time/)).toHaveLength(2)
  })

  it('shows the new status after a confirm and reload', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'call-1' })
    const confirmed = makeCall()
    confirmed.findings[0].status = 'confirmed'
    getCall.mockResolvedValue(confirmed)
    await user.click(screen.getAllByRole('button', { name: 'Confirm' })[0])
    expect(updateFinding).toHaveBeenCalledWith(10, { status: 'confirmed' })
    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument())
  })
})
