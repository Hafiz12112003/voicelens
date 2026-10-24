import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AccuracyTable from '@/components/summary/AccuracyTable.jsx'

const BASIS = 'Real demo calls only, hand-labeled, small sample. Synthetic calls are never included.'

const NO_LABELS = {
  status: 'no_labels',
  basis: BASIS,
  labeled_calls: 0,
  n_items: 0,
  per_rule: [],
  errors: [],
}

const LABELED = {
  status: 'ok',
  basis: BASIS,
  labeled_calls: 2,
  n_items: 14,
  per_rule: [
    { rule: 'high_latency', items: 10, tp: 3, fp: 1, fn: 0, tn: 6, precision: 0.75, recall: 1 },
    {
      rule: 'repeated_agent_turn',
      items: 4,
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 4,
      precision: null,
      recall: null,
    },
  ],
  errors: [{ call_id: 'real-001', turn_index: 2, rule: 'high_latency', kind: 'false_positive' }],
}

function renderTable(accuracy) {
  return render(
    <MemoryRouter>
      <AccuracyTable accuracy={accuracy} />
    </MemoryRouter>,
  )
}

describe('accuracy table', () => {
  it('says there are no labels yet and still states the basis', () => {
    renderTable(NO_LABELS)
    expect(screen.getByRole('heading', { name: 'Accuracy' })).toBeInTheDocument()
    expect(screen.getByText(BASIS)).toBeInTheDocument()
    expect(
      screen.getByText('No labels yet. Accuracy appears once real calls are hand-labeled.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows counts and ratios per rule, with a dash for undefined ratios', () => {
    renderTable(LABELED)
    const table = screen.getByRole('table', {
      name: 'Precision and recall per rule, from hand labels',
    })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('High latency')
    expect(within(rows[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '10',
      '3',
      '1',
      '0',
      '6',
      '75%',
      '100%',
    ])
    expect(within(rows[2]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '4',
      '0',
      '0',
      '0',
      '4',
      '\u2014Not defined',
      '\u2014Not defined',
    ])
  })

  it('draws a bar only for ratios that are defined', () => {
    renderTable(LABELED)
    const bars = document.querySelectorAll('[data-bar]')
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveStyle({ width: '75%' })
    expect(bars[1]).toHaveStyle({ width: '100%' })
  })

  it('lists rule mistakes with a link to the call', () => {
    renderTable(LABELED)
    expect(screen.getByRole('heading', { name: 'Where the rules were wrong' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Rule mistakes' })
    expect(within(list).getByRole('link', { name: 'real-001' })).toHaveAttribute(
      'href',
      '/calls/real-001',
    )
    expect(within(list).getByText('Turn 2')).toBeInTheDocument()
    expect(within(list).getByText('High latency')).toBeInTheDocument()
    expect(within(list).getByText('False positive')).toBeInTheDocument()
  })

  it('states the sample size with correct singular and plural words', () => {
    const { rerender } = renderTable(LABELED)
    expect(screen.getByText('14 labeled items across 2 calls.')).toBeInTheDocument()
    expect(screen.getByText(/Small sample: treat these numbers as indicative/)).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <AccuracyTable accuracy={{ ...LABELED, n_items: 1, labeled_calls: 1 }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('1 labeled item across 1 call.')).toBeInTheDocument()
  })
})
