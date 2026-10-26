import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkbenchPage from '@/pages/WorkbenchPage.jsx'
import { EXAMPLE_CALL } from '@/lib/workbench.js'
import { ApiError, analyzeCall, getRules } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, analyzeCall: vi.fn(), getRules: vi.fn() }
})

const SLOW = { timeout: 3000 }

const CATALOG = {
  rules: [
    {
      id: 'high_latency',
      name: 'High latency',
      thresholds: [
        {
          key: 'threshold_ms',
          label: 'Flag gaps above',
          unit: 'ms',
          type: 'integer',
          default: 1500,
          min: 100,
          max: 60000,
        },
        {
          key: 'high_ms',
          label: 'High severity above',
          unit: 'ms',
          type: 'integer',
          default: 3000,
          min: 100,
          max: 120000,
        },
      ],
    },
    {
      id: 'repeated_agent_turn',
      name: 'Repeated agent turn',
      thresholds: [
        {
          key: 'jaccard_threshold',
          label: 'Word overlap needed',
          unit: 'ratio',
          type: 'number',
          default: 0.8,
          min: 0.5,
          max: 1,
        },
      ],
    },
    { id: 'ignored_constraint', name: 'Ignored constraint', thresholds: [] },
  ],
  languages: [{ id: 'en', name: 'English' }],
}

const RESULT = {
  call_id: 'example-1',
  agent: 'restaurant-demo',
  source: 'synthetic',
  started_at: null,
  outcome: 'escalated',
  settings: { threshold_ms: 2000, high_ms: 4000, jaccard_threshold: 0.8 },
  stats: {
    duration_ms: 8000,
    turn_count: 3,
    finding_count: 0,
    response_count: 1,
    avg_latency_ms: 4000,
    max_latency_ms: 4000,
  },
  turns: [
    { i: 0, speaker: 'agent', text: 'Welcome', start_ms: 0, end_ms: 1000, latency_ms: null },
    { i: 1, speaker: 'customer', text: 'A table please', start_ms: 1500, end_ms: 3000, latency_ms: null },
    { i: 2, speaker: 'agent', text: 'Slow reply', start_ms: 7000, end_ms: 8000, latency_ms: 4000 },
  ],
  tool_events: [],
  findings: [],
}

beforeEach(() => {
  analyzeCall.mockReset()
  getRules.mockReset()
  analyzeCall.mockResolvedValue(RESULT)
  getRules.mockResolvedValue(CATALOG)
  Element.prototype.scrollIntoView = vi.fn()
})

async function loadExample(user) {
  await user.click(screen.getByRole('button', { name: 'Load example' }))
  await screen.findByRole('region', { name: 'Findings' }, SLOW)
}

describe('workbench settings', () => {
  it('shows one field per setting with its default and range', async () => {
    render(<WorkbenchPage />)
    const field = await screen.findByLabelText('High latency: Flag gaps above')
    expect(field).toHaveAttribute('type', 'number')
    expect(field).toHaveAttribute('placeholder', '1500')
    expect(screen.getByText('Default 1,500 ms, range 100 ms to 60,000 ms')).toBeInTheDocument()
    expect(screen.getByLabelText('Repeated agent turn: Word overlap needed')).toHaveAttribute(
      'placeholder',
      '0.8',
    )
    expect(screen.getByText('Default 0.8, range 0.5 to 1')).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled()
  })

  it('sends only the changed settings with the call and runs the rules again', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    const field = await screen.findByLabelText('High latency: Flag gaps above')
    await loadExample(user)
    expect(analyzeCall).toHaveBeenCalledTimes(1)
    expect(analyzeCall).toHaveBeenNthCalledWith(1, EXAMPLE_CALL)
    fireEvent.change(field, { target: { value: '2000' } })
    await waitFor(() => expect(analyzeCall).toHaveBeenCalledTimes(2), SLOW)
    expect(analyzeCall).toHaveBeenLastCalledWith({
      ...EXAMPLE_CALL,
      settings: { threshold_ms: 2000 },
    })
  })

  it('shows the settings the server used, and the lanes follow them', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    await loadExample(user)
    expect(
      screen.getByText('Settings used: threshold_ms 2000, high_ms 4000, jaccard_threshold 0.8'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/mark 2 s and 4 s, the thresholds used for this analysis/),
    ).toBeInTheDocument()
  })

  it('resets every field to its default and runs the rules again', async () => {
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    const field = await screen.findByLabelText('High latency: Flag gaps above')
    await loadExample(user)
    fireEvent.change(field, { target: { value: '2000' } })
    await waitFor(() => expect(analyzeCall).toHaveBeenCalledTimes(2), SLOW)
    const reset = screen.getByRole('button', { name: 'Reset to defaults' })
    expect(field).toHaveDisplayValue('2000')
    expect(reset).toBeEnabled()
    await user.click(reset)
    expect(field).toHaveDisplayValue('')
    expect(reset).toBeDisabled()
    await waitFor(() => expect(analyzeCall).toHaveBeenCalledTimes(3), SLOW)
    expect(analyzeCall).toHaveBeenLastCalledWith(EXAMPLE_CALL)
  })

  it('shows why the settings are missing and loads them on retry', async () => {
    getRules.mockRejectedValueOnce(new ApiError('Cannot reach the server', { status: 0 }))
    const user = userEvent.setup()
    render(<WorkbenchPage />)
    expect(
      await screen.findByText('Settings are unavailable: Cannot reach the server'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry loading settings' }))
    expect(await screen.findByLabelText('High latency: Flag gaps above')).toBeInTheDocument()
    expect(getRules).toHaveBeenCalledTimes(2)
  })
})
