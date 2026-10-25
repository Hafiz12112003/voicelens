import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FindingsPanel from '@/components/calls/FindingsPanel.jsx'
import { updateFinding } from '@/services/api.js'

vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, updateFinding: vi.fn() }
})

const REPEAT = {
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
const FALSE_SUCCESS = {
  id: 2,
  call_id: 'c1',
  turn_index: 4,
  rule: 'false_success_claim',
  severity: 'high',
  evidence: 'Booked right after a failed tool call',
  explanation: 'The agent claimed success after a failure.',
  status: 'open',
  note: '',
}

function setup(findings = [REPEAT], props = {}) {
  const onChanged = vi.fn()
  const onGoToTurn = vi.fn()
  render(
    <FindingsPanel
      findings={findings}
      readOnly={false}
      onGoToTurn={onGoToTurn}
      onChanged={onChanged}
      {...props}
    />,
  )
  return { onChanged, onGoToTurn, user: userEvent.setup() }
}

beforeEach(() => {
  updateFinding.mockReset()
  updateFinding.mockResolvedValue({})
})

describe('FindingsPanel', () => {
  it('lists findings in reading order with rule, explanation and evidence', () => {
    setup([FALSE_SUCCESS, REPEAT])
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Repeated agent turn')).toBeInTheDocument()
    expect(within(items[0]).getByText('The agent said it again.')).toBeInTheDocument()
    expect(within(items[0]).getByText('Repeats turn 0')).toBeInTheDocument()
    expect(within(items[1]).getByText('False success claim')).toBeInTheDocument()
  })

  it('shows an empty state when there are no findings', () => {
    setup([])
    expect(screen.getByText('No findings on this call.')).toBeInTheDocument()
  })

  it('confirms a finding and asks the page to reload', async () => {
    const { user, onChanged } = setup()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(updateFinding).toHaveBeenCalledWith(1, { status: 'confirmed' })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  it('dismisses a finding', async () => {
    const { user, onChanged } = setup()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(updateFinding).toHaveBeenCalledWith(1, { status: 'dismissed' })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  it('reopens a confirmed finding when Confirm is clicked again', async () => {
    const { user } = setup([{ ...REPEAT, status: 'confirmed' }])
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toHaveAttribute('aria-pressed', 'true')
    await user.click(confirm)
    expect(updateFinding).toHaveBeenCalledWith(1, { status: 'open' })
  })

  it('saves a note', async () => {
    const { user, onChanged } = setup()
    await user.click(screen.getByRole('button', { name: 'Note' }))
    await user.type(screen.getByLabelText('Note for this finding'), 'Checked the audio')
    await user.click(screen.getByRole('button', { name: 'Save note' }))
    expect(updateFinding).toHaveBeenCalledWith(1, { note: 'Checked the audio' })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  it('goes to the turn of a finding', async () => {
    const { user, onGoToTurn } = setup()
    await user.click(screen.getByRole('button', { name: 'Go to turn 2' }))
    expect(onGoToTurn).toHaveBeenCalledWith(2)
  })

  it('disables review actions in read-only mode', () => {
    setup([REPEAT], { readOnly: true })
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Note' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/unavailable/)
    expect(screen.getByRole('button', { name: 'Go to turn 2' })).toBeEnabled()
  })

  it('shows an error and does not reload when saving fails', async () => {
    updateFinding.mockRejectedValue(new Error('Server error'))
    const { user, onChanged } = setup()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save: Server error')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('hides review buttons and the snapshot banner when reviewActions is false', () => {
    setup([REPEAT], { readOnly: true, reviewActions: false })
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Note' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to turn 2' })).toBeEnabled()
  })

  it('hides the status chip when showStatus is false and shows it by default', () => {
    const { unmount } = render(
      <FindingsPanel findings={[REPEAT]} readOnly={false} onGoToTurn={vi.fn()} onChanged={vi.fn()} />,
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
    unmount()
    render(
      <FindingsPanel
        findings={[REPEAT]}
        readOnly={false}
        showStatus={false}
        reviewActions={false}
        onGoToTurn={vi.fn()}
        onChanged={vi.fn()}
      />,
    )
    expect(screen.queryByText('Open')).not.toBeInTheDocument()
  })
})
