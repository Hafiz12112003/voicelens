import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.jsx'
import SnapshotBanner from '@/components/layout/SnapshotBanner.jsx'

const mode = vi.hoisted(() => ({ snapshot: false }))
vi.mock('@/hooks/useSnapshotMode.js', () => ({ useSnapshotMode: () => mode.snapshot }))

const STORAGE_KEY = 'voicelens.sidebar-collapsed'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function mainNav() {
  return within(screen.getByRole('navigation', { name: 'Main' }))
}

beforeEach(() => {
  mode.snapshot = false
})

describe('app shell', () => {
  it('redirects the root to the Calls page', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Calls' })).toBeInTheDocument()
  })

  it('marks the current page in the sidebar', () => {
    renderAt('/calls')
    expect(mainNav().getByRole('link', { name: 'Calls' })).toHaveAttribute('aria-current', 'page')
    expect(mainNav().getByRole('link', { name: 'Summary' })).not.toHaveAttribute('aria-current')
  })

  it('navigates between pages with the sidebar', async () => {
    const user = userEvent.setup()
    renderAt('/calls')
    await user.click(mainNav().getByRole('link', { name: 'Summary' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Summary' })).toBeInTheDocument()
    expect(mainNav().getByRole('link', { name: 'Summary' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the call id on the inspector route', () => {
    renderAt('/calls/synthetic-flight-001')
    expect(screen.getByRole('heading', { level: 1, name: 'Call Inspector' })).toBeInTheDocument()
    expect(screen.getAllByText('synthetic-flight-001').length).toBeGreaterThanOrEqual(2)
    expect(mainNav().getByRole('link', { name: 'Calls' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a not-found state for unknown pages', () => {
    renderAt('/nowhere')
    expect(screen.getByText('That page does not exist.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to calls' })).toHaveAttribute('href', '/calls')
  })

  it('offers a skip link to the main content', () => {
    renderAt('/calls')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('collapses and expands the sidebar and remembers the choice', async () => {
    const user = userEvent.setup()
    renderAt('/calls')
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
  })

  it('starts collapsed when the choice was saved', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    renderAt('/calls')
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('opens the mobile menu and closes it with Escape', async () => {
    const user = userEvent.setup()
    renderAt('/calls')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
  })

  it('closes the mobile menu after navigating', async () => {
    const user = userEvent.setup()
    renderAt('/calls')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(mainNav().getByRole('link', { name: 'Summary' }))
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Summary' })).toBeInTheDocument()
  })

  it('shows the snapshot banner and status when the API is down', () => {
    mode.snapshot = true
    renderAt('/calls')
    expect(screen.getByRole('status')).toHaveTextContent(/saved read-only snapshot/)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByText('Snapshot')).toBeInTheDocument()
  })

  it('hides the banner when the API is live', () => {
    renderAt('/calls')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Live API')).toBeInTheDocument()
  })
})

describe('SnapshotBanner', () => {
  it('calls onRetry when Retry is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<SnapshotBanner visible onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when not visible', () => {
    const { container } = render(<SnapshotBanner visible={false} onRetry={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
