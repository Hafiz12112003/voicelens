import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FindingsPanel from '@/components/calls/FindingsPanel.jsx'

const FINDING = {
  id: 1,
  call_id: 'c1',
  turn_index: 2,
  rule: 'repeated_agent_turn',
  severity: 'medium',
  evidence: 'Repeats turn 0',
  explanation: 'The agent said it again.',
  status: 'open',
  note: '',
}

describe('FindingsPanel sticky layout', () => {
  it('is sticky by default and drops the sticky classes when sticky is false', () => {
    const props = { findings: [FINDING], readOnly: false, onGoToTurn: vi.fn(), onChanged: vi.fn() }
    const { unmount } = render(<FindingsPanel {...props} />)
    expect(screen.getByRole('region', { name: 'Findings' })).toHaveClass('xl:sticky')
    unmount()
    render(<FindingsPanel {...props} sticky={false} />)
    const panel = screen.getByRole('region', { name: 'Findings' })
    expect(panel).not.toHaveClass('xl:sticky')
    expect(panel).not.toHaveClass('xl:self-start')
  })
})
