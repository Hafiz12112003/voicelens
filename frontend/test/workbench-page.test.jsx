import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkbenchPage from '@/pages/WorkbenchPage.jsx'
import { ApiError, analyzeCall } from '@/services/api.js'
import { EXAMPLE_CALL } from '@/lib/workbench.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, analyzeCall: vi.fn() }
})

const SLOW = { timeout: 3000 }

const RESULT = {
  call_id: 'example-1',
  agent: 'restaurant-demo',
  source: 'synthetic',
  started_at: null,
  outcome: 'escalated',
  stats: {
    duration_ms: 18000,
    turn_count: 4,
    finding_count: 2,
    response_count: 1,
    avg_latency_ms: 4000,
    max_latency_ms: 4000,
  },
  turns: [
    { i: 0, speaker: 'agent', text: 'Welcome', start_ms: 0, end_ms: 1000, latency_ms: null },
    { i: 1, speaker: 'customer', text: 'A table please', start_ms: 1500, end_ms: 3000, latency_ms: null },
    { i: 2, speaker: 'agent', text: 'Slow reply', start_ms: 7000, end_ms: 8000, latency_ms: 4000 },
    { i: 3, speaker: 'agent', text: 'Slow reply', start_ms: 8200, end_ms: 9000, latency_ms: null },
  ],
  tool_events: [],
  findings: [
    {
      id: 1,
      call_id: 'example-1',
      turn_index: 2,
      rule: 'high_latency',
      severity: 'high',
      evidence: 'gap 4000 ms',
      explanation: 'The agent took 4.0 seconds to respond.',
      status: 'open',
      note: null,
    },
    {
      id: 2,
      call_id: 'example-1',
      turn_index: 3,
      rule: 'repeated_agent_turn',
      severity: 'medium',
      evidence: 'repeats turn 2',
      explanation: 'The agent said the same thing again.',
      status: 'open',
      note: null,
    },
  ],
}

function activeCards() {
  return document.querySelectorAll('[data-finding-id][aria-current="true"]')
}

async function loadExampleAndWait(user) {
  await user.click(screen.getByRole('button', { name: 'Load example' }))
  return screen.findByRole('region', { name: 'Findings' }, SLOW)
}

beforeEach(() => {
  analyzeCall.mockReset()
  analyzeCall.mockResolvedValue(RESULT)
  Element.prototype.scrollIntoView = vi.fn()
})

describe('workbench page', () => {
  it('starts with an empty state and does not call the API', () => {
    render(<WorkbenchPage />)
    expect(screen.getByText(/Paste a call as JSON/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Findings' })).not.toBeInTheDocument()
    expect(analyzeCall).not.toHaveBeenCalled()
  })

  it('analyses the example and lists its findings', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    const panel = await loadExampleAndWait(user)
    expect(analyzeCall).toHaveBeenCalledTimes(1)
    expect(analyzeCall).toHaveBeenCalledWith(EXAMPLE_CALL)
    expect(within(panel).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByText('Slow reply').length).toBeGreaterThan(0)
  })

  it('reports invalid JSON without calling the API', async () => {
    render(<WorkbenchPage />)
    fireEvent.change(screen.getByLabelText('Call JSON'), { target: { value: '{"turns": [' } })
    expect(await screen.findByText(/Not valid JSON/, {}, SLOW)).toBeInTheDocument()
    expect(analyzeCall).not.toHaveBeenCalled()
  })

  it('shows the validation details from a 422', async () => {
    analyzeCall.mockRejectedValue(
      new ApiError('Invalid transcript: 1 problem(s) found, nothing was analysed', {
        status: 422,
        details: ['x: agent is required'],
      }),
    )
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await user.click(screen.getByRole('button', { name: 'Load example' }))
    const list = await screen.findByRole('list', { name: 'Validation problems' }, SLOW)
    expect(within(list).getByText('x: agent is required')).toBeInTheDocument()
    expect(screen.getByText(/nothing was analysed/)).toBeInTheDocument()
  })

  it('shows Retry when the server is unreachable and recovers on retry', async () => {
    analyzeCall.mockRejectedValueOnce(new ApiError('Cannot reach the server', { status: 0 }))
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await user.click(screen.getByRole('button', { name: 'Load example' }))
    const alert = await screen.findByRole('alert', {}, SLOW)
    expect(alert).toHaveTextContent('Cannot reach the server')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('region', { name: 'Findings' }, SLOW)
    expect(analyzeCall).toHaveBeenCalledTimes(2)
  })

  it('highlights and scrolls to the turn when Go to turn is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await loadExampleAndWait(user)
    await user.click(screen.getByRole('button', { name: 'Go to turn 2' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(document.querySelector('[data-turn="2"]')).toHaveClass('border-primary')
  })

  it('is read-only: no review buttons, and says nothing is saved', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await loadExampleAndWait(user)
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Note' })).not.toBeInTheDocument()
    expect(screen.getByText(/Nothing you paste is saved/)).toBeInTheDocument()
  })

  it('steps through findings with j and k', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await loadExampleAndWait(user)
    await user.keyboard('j')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '1')
    await user.keyboard('j')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '2')
    await user.keyboard('k')
    expect(activeCards()[0]).toHaveAttribute('data-finding-id', '1')
  })
})
