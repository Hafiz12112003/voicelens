import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Lanes from '@/components/calls/Lanes.jsx'

// No two turns overlap, so the only red or orange rects are the gap bars.
const TURNS = [
  { i: 0, speaker: 'agent', text: 'a', start_ms: 0, end_ms: 2000, latency_ms: null },
  { i: 1, speaker: 'customer', text: 'b', start_ms: 2500, end_ms: 4500, latency_ms: null },
  { i: 2, speaker: 'agent', text: 'c', start_ms: 9000, end_ms: 10000, latency_ms: 4500 },
  { i: 3, speaker: 'customer', text: 'd', start_ms: 10200, end_ms: 10500, latency_ms: null },
  { i: 4, speaker: 'agent', text: 'e', start_ms: 10600, end_ms: 11500, latency_ms: 100 },
]

describe('Lanes thresholds', () => {
  it('names the thresholds it was given in the legend and the screen reader text', () => {
    render(<Lanes turns={TURNS} thresholds={{ slowMs: 2000, highMs: 4000 }} />)
    expect(
      screen.getByText(/Dashed ticks in a gap mark 2 s and 4 s, the thresholds used for this analysis/),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 response slower than 2,000 ms/)).toBeInTheDocument()
  })

  it('colours the gap and draws the ticks by the thresholds it was given', () => {
    const first = render(<Lanes turns={TURNS} thresholds={{ slowMs: 2000, highMs: 4000 }} />)
    expect(first.container.querySelector('rect.text-high')).not.toBeNull()
    expect(first.container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(2)
    first.unmount()
    const second = render(<Lanes turns={TURNS} thresholds={{ slowMs: 5000, highMs: 6000 }} />)
    expect(second.container.querySelector('rect.text-high')).toBeNull()
    expect(second.container.querySelector('rect.text-medium')).toBeNull()
    expect(second.container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(0)
  })

  it('says the ticks are the defaults, and may not match, when no thresholds are given', () => {
    render(<Lanes turns={TURNS} />)
    expect(
      screen.getByText(/Dashed ticks in a gap mark 1.5 s and 3 s, the default rule thresholds/),
    ).toBeInTheDocument()
    expect(screen.getByText(/the ticks will not match/)).toBeInTheDocument()
  })
})
