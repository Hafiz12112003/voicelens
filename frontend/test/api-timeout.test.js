import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function reply(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

// A fetch that never answers, but rejects when the request is aborted.
function hangingFetch() {
  return vi.fn(
    (url, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      }),
  )
}

// api.js keeps its mode in module state, so every test gets a fresh copy.
async function load() {
  vi.resetModules()
  return import('@/services/api.js')
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('api client: mode and timeout', () => {
  it('reads the server mode from /mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { read_only: true }))
    vi.stubGlobal('fetch', fetchMock)
    const api = await load()
    const mode = await api.getMode()
    expect(mode).toEqual({ read_only: true })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/mode')
  })

  it('passes an abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { calls_analysed: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const api = await load()
    await api.getSummary()
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('clears its timer once the response arrives', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { calls_analysed: 1 })))
    const api = await load()
    await api.getSummary()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives up on a read after 8 seconds and uses the snapshot', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const api = await load()
    let settled = false
    const pending = api.getSummary().then((value) => {
      settled = true
      return value
    })
    await vi.advanceTimersByTimeAsync(7999)
    expect(settled).toBe(false)
    expect(api.isSnapshotMode()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const summary = await pending
    expect(summary.calls_analysed).toBe(5)
    expect(api.isSnapshotMode()).toBe(true)
  })

  it('uses VITE_API_TIMEOUT_MS when it is set', async () => {
    vi.stubEnv('VITE_API_TIMEOUT_MS', '200')
    vi.stubGlobal('fetch', hangingFetch())
    const api = await load()
    const pending = api.getSummary()
    await vi.advanceTimersByTimeAsync(200)
    const summary = await pending
    expect(summary.calls_analysed).toBe(5)
    expect(api.isSnapshotMode()).toBe(true)
  })

  it('falls back to 8 seconds when VITE_API_TIMEOUT_MS is not a number', async () => {
    vi.stubEnv('VITE_API_TIMEOUT_MS', 'abc')
    vi.stubGlobal('fetch', hangingFetch())
    const api = await load()
    let settled = false
    const pending = api.getSummary().then((value) => {
      settled = true
      return value
    })
    await vi.advanceTimersByTimeAsync(7999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(api.isSnapshotMode()).toBe(true)
  })

  it('fails a slow write with a timeout error and switches to the snapshot', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const api = await load()
    const assertion = expect(api.updateFinding(1, { status: 'confirmed' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: expect.stringContaining('too long'),
    })
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    expect(api.isSnapshotMode()).toBe(true)
  })
})
