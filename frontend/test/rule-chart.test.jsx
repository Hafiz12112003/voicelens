import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import RuleChart from '@/components/summary/RuleChart.jsx'

const PER_RULE = [
  { rule: 'high_latency', total: 1, open: 1, confirmed: 0, dismissed: 0 },
  { rule: 'repeated_agent_turn', total: 3, open: 1, confirmed: 1, dismissed: 1 },
  { rule: 'ignored_constraint', total: 0, open: 0, confirmed: 0, dismissed: 0 },
]

function renderChart(perRule) {
  return render(
    <MemoryRouter>
      <RuleChart perRule={perRule} />
    </MemoryRouter>,
  )
}

describe('rule chart', () => {
  it('lists every rule with its counts in an accessible table', () => {
    renderChart(PER_RULE)
    const table = screen.getByRole('table', { name: 'Findings per rule by review status' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('Repeated agent turn')
    expect(within(rows[2]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '1',
      '1',
      '1',
      '3',
    ])
    expect(within(rows[3]).getByRole('rowheader')).toHaveTextContent('Ignored constraint')
    expect(within(rows[3]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '0',
      '0',
      '0',
      '0',
    ])
  })

  it('shows a legend naming the three review states', () => {
    renderChart(PER_RULE)
    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Open',
      'Confirmed',
      'Dismissed',
    ])
  })

  it('shows an empty state when no rule has findings', () => {
    renderChart(PER_RULE.map((item) => ({ ...item, total: 0, open: 0, confirmed: 0, dismissed: 0 })))
    expect(screen.getByText('No findings for this source.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View calls' })).toHaveAttribute('href', '/calls')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('treats a missing per-rule list as no findings', () => {
    renderChart(undefined)
    expect(screen.getByText('No findings for this source.')).toBeInTheDocument()
  })
})
