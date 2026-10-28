import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FindingsPanel from '@/components/calls/FindingsPanel.jsx'
import ImportCard from '@/components/summary/ImportCard.jsx'
import { resetReadOnlyForTests, useReadOnly } from '@/hooks/useReadOnly.js'
import { getMode, importTranscripts, isSnapshotMode } from '@/services/api.js'

const mode = vi.hoisted(() => ({ snapshot: false }))
vi.mock('@/hooks/useSnapshotMode.js', () => ({ useSnapshotMode: () => mode.snapshot }))
vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getMode: vi.fn(),
    importTranscripts: vi.fn(),
    isSnapshotMode: vi.fn(() => false),
  }
})

const FINDING = {
  id: 1,
  rule: 'long_silence',
  severity: 'high',
  explanation: 'The agent went quiet.',
  evidence: null,
  turn_index: 2,
  status: 'open',
  note: '',
}

function renderPanel(props) {
  return render(
    <FindingsPanel findings={[FINDING]} onGoToTurn={vi.fn()} onChanged={vi.fn()} {...props} />,
  )
}

function file(name = 'calls.json') {
  return new File(['[]'], name, { type: 'application/json' })
}

beforeEach(() => {
  mode.snapshot = false
  getMode.mockReset()
  importTranscripts.mockReset()
  isSnapshotMode.mockReset()
  isSnapshotMode.mockReturnValue(false)
  resetReadOnlyForTests()
})

describe('useReadOnly', () => {
  it('is false until the server says it is read-only', async () => {
    getMode.mockResolvedValue({ read_only: true })
    const { result } = renderHook(() => useReadOnly())
    expect(result.current).toBe(false)
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('stays false when the mode request fails', async () => {
    getMode.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useReadOnly())
    await waitFor(() => expect(getMode).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current).toBe(false)
  })

  it('asks the server once for several components', async () => {
    getMode.mockResolvedValue({ read_only: true })
    const first = renderHook(() => useReadOnly())
    const second = renderHook(() => useReadOnly())
    await waitFor(() => expect(first.result.current).toBe(true))
    await waitFor(() => expect(second.result.current).toBe(true))
    expect(getMode).toHaveBeenCalledTimes(1)
  })

  it('does not ask while a saved snapshot is shown', async () => {
    isSnapshotMode.mockReturnValue(true)
    const { result } = renderHook(() => useReadOnly())
    await act(async () => {})
    expect(getMode).not.toHaveBeenCalled()
    expect(result.current).toBe(false)
  })
})

describe('import card on a read-only server', () => {
  function renderCard() {
    return render(
      <MemoryRouter>
        <ImportCard onImported={vi.fn()} />
      </MemoryRouter>,
    )
  }

  it('disables importing and explains why', async () => {
    getMode.mockResolvedValue({ read_only: true })
    renderCard()
    expect(await screen.findByText(/turned off on this public demo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeDisabled()
  })

  it('ignores a dropped file', async () => {
    getMode.mockResolvedValue({ read_only: true })
    renderCard()
    await screen.findByText(/turned off on this public demo/)
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [file()] } })
    expect(importTranscripts).not.toHaveBeenCalled()
  })

  it('shows only the snapshot message when both apply', async () => {
    mode.snapshot = true
    getMode.mockResolvedValue({ read_only: true })
    renderCard()
    await waitFor(() => expect(getMode).toHaveBeenCalled())
    await act(async () => {})
    expect(
      screen.getByText('Importing is unavailable while you view a saved snapshot.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/public demo/)).not.toBeInTheDocument()
  })
})

describe('findings panel read-only message', () => {
  it('shows the snapshot message by default', () => {
    renderPanel({ readOnly: true })
    expect(
      screen.getByText('Review actions are unavailable while you view a saved snapshot.'),
    ).toBeInTheDocument()
  })

  it('shows a custom message and disables the review buttons', () => {
    renderPanel({ readOnly: true, readOnlyMessage: 'Reviewing is off on this demo.' })
    expect(screen.getByText('Reviewing is off on this demo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Note' })).toBeDisabled()
  })

  it('shows no message and enables the buttons when not read-only', () => {
    renderPanel({ readOnly: false, readOnlyMessage: 'Reviewing is off on this demo.' })
    expect(screen.queryByText('Reviewing is off on this demo.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  })
})
