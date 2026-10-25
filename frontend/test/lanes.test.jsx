import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Lanes from '@/components/calls/Lanes.jsx'

const TURNS = [
  { i: 0, speaker: 'agent', text: 'a', start_ms: 0, end_ms: 2000, latency_ms: null },
  { i: 1, speaker: 'customer', text: 'b', start_ms: 2500, end_ms: 4500, latency_ms: null },
  { i: 2, speaker: 'agent', text: 'c', start_ms: 9000, end_ms: 10000, latency_ms: 4500 },
  { i: 3, speaker: 'customer', text: 'd', start_ms: 10200, end_ms: 10500, latency_ms: null },
  { i: 4, speaker: 'agent', text: 'e', start_ms: 10600, end_ms: 11500, latency_ms: 100 },
]

describe('Lanes', () => {
  it('draws one button per turn and a titled gap', () => {
    render(<Lanes turns={TURNS} />)
    expect(screen.getAllByRole('button', { name: /^Turn \d/ })).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Turn 2, agent, 9 s to 10 s' })).toBeInTheDocument()
    expect(screen.getByText('Response gap before turn 2: 4,500 ms')).toBeInTheDocument()
    expect(screen.queryByText(/no timestamps and/)).not.toBeInTheDocument()
  })

  it('says so when no turn has timestamps', () => {
    const turns = [{ i: 0, speaker: 'agent', text: 'x', start_ms: null, end_ms: null, latency_ms: null }]
    render(<Lanes turns={turns} />)
    expect(screen.getByText(/No timestamps/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Turn \d/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument()
  })

  it('selects a turn with a click and with Enter', async () => {
    const onSelectTurn = vi.fn()
    const user = userEvent.setup()
    render(<Lanes turns={TURNS} onSelectTurn={onSelectTurn} />)
    await user.click(screen.getByRole('button', { name: 'Turn 2, agent, 9 s to 10 s' }))
    expect(onSelectTurn).toHaveBeenCalledWith(2)
    screen.getByRole('button', { name: 'Turn 4, agent, 10.6 s to 11.5 s' }).focus()
    await user.keyboard('{Enter}')
    expect(onSelectTurn).toHaveBeenCalledWith(4)
  })

  it('zooms in with the button and resets, enabling and disabling controls', async () => {
    const user = userEvent.setup()
    render(<Lanes turns={TURNS} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Showing 0 s to 11.5 s')
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(status).toHaveTextContent('Showing 2.9 s to 8.6 s')
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Reset view' }))
    expect(status).toHaveTextContent('Showing 0 s to 11.5 s')
  })

  it('zooms, pans and resets from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Lanes turns={TURNS} />)
    const status = screen.getByRole('status')
    screen.getByRole('group', { name: /Plus and minus/ }).focus()
    await user.keyboard('+')
    expect(status).toHaveTextContent('Showing 2.9 s to 8.6 s')
    await user.keyboard('{ArrowRight}')
    expect(status).toHaveTextContent('Showing 4.3 s to 10.1 s')
    await user.keyboard('0')
    expect(status).toHaveTextContent('Showing 0 s to 11.5 s')
  })
})
