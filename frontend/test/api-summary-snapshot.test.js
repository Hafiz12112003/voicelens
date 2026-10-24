import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('getSummary in snapshot mode', () => {
  it('passes the chosen source to the snapshot', async () => {
    vi.stubEnv('VITE_API_MODE', 'snapshot')
    vi.resetModules()
    const api = await import('@/services/api.js')
    expect(api.isSnapshotMode()).toBe(true)
    expect((await api.getSummary({ source: 'real' })).calls_analysed).toBe(0)
    expect((await api.getSummary({ source: 'synthetic' })).scope.source).toBe('synthetic')
    expect((await api.getSummary({ source: 'all' })).calls_analysed).toBe(5)
  })
})
