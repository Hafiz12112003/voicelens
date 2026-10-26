import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RulesPage from '@/pages/RulesPage.jsx'
import { ApiError, getRules } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getRules: vi.fn() }
})

const CATALOG = {
  rules: [
    {
      id: 'high_latency',
      name: 'High latency',
      description: 'Flags slow agent turns.',
      severity: 'Medium above the base threshold, high above the high threshold.',
      applies_to: 'All agents',
      needs: ['start_ms and end_ms on both turns of a customer-to-agent pair'],
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
      ],
      known_limits: ['Only as accurate as the timestamps you supply.'],
      validated: false,
    },
    {
      id: 'false_success_claim',
      name: 'False success claim',
      description: 'Flags a success claim after a failed tool call.',
      severity: 'High',
      applies_to: 'All agents',
      needs: ['tool_events in the call'],
      thresholds: [],
      known_limits: ['Needs tool_events, so it cannot run on CSV imports.'],
      validated: false,
    },
  ],
  languages: [{ id: 'en', name: 'English' }],
}

beforeEach(() => {
  getRules.mockReset()
  getRules.mockResolvedValue(CATALOG)
})

describe('rules page', () => {
  it('shows a loading state and then every rule with its limits and a not-validated badge', async () => {
    render(<RulesPage />)
    expect(screen.getByLabelText('Loading rules')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'High latency' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'False success claim' })).toBeInTheDocument()
    expect(screen.getAllByText('Not validated')).toHaveLength(2)
    expect(screen.getByText('Only as accurate as the timestamps you supply.')).toBeInTheDocument()
    expect(screen.getByText('Needs tool_events, so it cannot run on CSV imports.')).toBeInTheDocument()
    expect(screen.getByText('tool_events in the call')).toBeInTheDocument()
  })

  it('shows settings with their default and range, or says there are none', async () => {
    render(<RulesPage />)
    const table = await screen.findByRole('table', { name: 'Settings for High latency' })
    expect(within(table).getByText('Flag gaps above')).toBeInTheDocument()
    expect(within(table).getByText('threshold_ms')).toBeInTheDocument()
    expect(within(table).getByText('1,500 ms')).toBeInTheDocument()
    expect(within(table).getByText('100 ms to 60,000 ms')).toBeInTheDocument()
    expect(screen.getAllByText('No settings.')).toHaveLength(1)
  })

  it('states which languages have phrase lists', async () => {
    render(<RulesPage />)
    expect(await screen.findByText(/Phrase lists: English/)).toBeInTheDocument()
  })

  it('shows an error with Retry and recovers', async () => {
    getRules.mockRejectedValueOnce(new ApiError('Cannot reach the server', { status: 0 }))
    const user = userEvent.setup()
    render(<RulesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'High latency' })).toBeInTheDocument()
    expect(getRules).toHaveBeenCalledTimes(2)
  })
})
