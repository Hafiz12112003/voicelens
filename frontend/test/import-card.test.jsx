import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportCard from '@/components/summary/ImportCard.jsx'
import { ApiError, importTranscripts } from '@/services/api.js'

const mode = vi.hoisted(() => ({ snapshot: false }))
vi.mock('@/hooks/useSnapshotMode.js', () => ({ useSnapshotMode: () => mode.snapshot }))
vi.mock('@/services/api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, importTranscripts: vi.fn() }
})

function renderCard(onImported = vi.fn()) {
  render(
    <MemoryRouter>
      <ImportCard onImported={onImported} />
    </MemoryRouter>,
  )
  return { onImported, user: userEvent.setup() }
}

function file(name = 'calls.json') {
  return new File(['[]'], name, { type: 'application/json' })
}

function drop(files) {
  fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files } })
}

beforeEach(() => {
  mode.snapshot = false
  importTranscripts.mockReset()
})

describe('import card', () => {
  it('imports a chosen file and reports what happened', async () => {
    importTranscripts.mockResolvedValue({ imported: ['a'], skipped: [], findings: 2 })
    const { user, onImported } = renderCard()
    const chosen = file()
    await user.upload(screen.getByLabelText('Transcript file'), chosen)
    expect(importTranscripts).toHaveBeenCalledWith(chosen)
    expect(await screen.findByText('Imported 1 call and 2 findings.')).toBeInTheDocument()
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'View calls' })).toHaveAttribute('href', '/calls')
  })

  it('says so when every call was already imported', async () => {
    importTranscripts.mockResolvedValue({ imported: [], skipped: ['a', 'b'], findings: 0 })
    const { user, onImported } = renderCard()
    await user.upload(screen.getByLabelText('Transcript file'), file())
    expect(
      await screen.findByText('No new calls imported: 2 calls already existed.'),
    ).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'View calls' })).not.toBeInTheDocument()
  })

  it('lists skipped duplicates when some calls were new', async () => {
    importTranscripts.mockResolvedValue({ imported: ['a'], skipped: ['b'], findings: 1 })
    const { user } = renderCard()
    await user.upload(screen.getByLabelText('Transcript file'), file())
    expect(await screen.findByText('Imported 1 call and 1 finding.')).toBeInTheDocument()
    expect(screen.getByText('Skipped 1 duplicate: b')).toBeInTheDocument()
  })

  it('shows the validation problems from a 422', async () => {
    const details = ['call-1: agent is required', 'call-1: turns must be a non-empty list']
    importTranscripts.mockRejectedValue(
      new ApiError('Invalid transcript: 2 problem(s) found, nothing was imported', {
        status: 422,
        details,
      }),
    )
    const { user, onImported } = renderCard()
    await user.upload(screen.getByLabelText('Transcript file'), file())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('nothing was imported')
    const list = within(alert).getByRole('list', { name: 'Validation problems' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(details)
    expect(onImported).not.toHaveBeenCalled()
    expect(screen.queryByText(/Showing the first 50 problems/)).not.toBeInTheDocument()
  })

  it('says when only the first 50 problems are shown', async () => {
    const details = Array.from({ length: 50 }, (_, index) => `call-1: problem ${index}`)
    importTranscripts.mockRejectedValue(
      new ApiError('Invalid transcript: 80 problem(s) found, nothing was imported', {
        status: 422,
        details,
      }),
    )
    const { user } = renderCard()
    await user.upload(screen.getByLabelText('Transcript file'), file())
    expect(await screen.findByText(/Showing the first 50 problems/)).toBeInTheDocument()
  })

  it('rejects other file types without calling the API', async () => {
    renderCard()
    drop([file('notes.txt')])
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a .json or .csv file.')
    expect(importTranscripts).not.toHaveBeenCalled()
  })

  it('asks for one file at a time', async () => {
    renderCard()
    drop([file('a.json'), file('b.json')])
    expect(await screen.findByRole('alert')).toHaveTextContent('Drop one file at a time.')
    expect(importTranscripts).not.toHaveBeenCalled()
  })

  it('imports a dropped file', async () => {
    importTranscripts.mockResolvedValue({ imported: ['a'], skipped: [], findings: 0 })
    const { onImported } = renderCard()
    const dropped = file('dropped.csv')
    drop([dropped])
    expect(await screen.findByText('Imported 1 call and 0 findings.')).toBeInTheDocument()
    expect(importTranscripts).toHaveBeenCalledWith(dropped)
    expect(onImported).toHaveBeenCalledTimes(1)
  })

  it('is disabled while viewing a saved snapshot', () => {
    mode.snapshot = true
    renderCard()
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeDisabled()
    expect(
      screen.getByText('Importing is unavailable while you view a saved snapshot.'),
    ).toBeInTheDocument()
    drop([file()])
    expect(importTranscripts).not.toHaveBeenCalled()
  })

  it('links to a sample file', () => {
    renderCard()
    expect(screen.getByRole('link', { name: 'Download a sample file' })).toHaveAttribute(
      'href',
      '/sample-calls.json',
    )
  })

  it('shows a plain error message for other failures', async () => {
    importTranscripts.mockRejectedValue(new ApiError('Server exploded', { status: 500 }))
    const { user } = renderCard()
    await user.upload(screen.getByLabelText('Transcript file'), file())
    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
