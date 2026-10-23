import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function reply(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
  }
}

// api.js keeps its mode in module state, so every test gets a fresh copy.
async function load() {
  vi.resetModules()
  return import('@/services/api.js')
}

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('api client: requests', () => {
  it('builds the URL from params and skips empty ones', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(200, { items: [] }))
    await api.listCalls({ agent: 'hotel-demo', q: '', pageSize: 5 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/calls?agent=hotel-demo&page_size=5')
    await api.listCalls()
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/calls')
    await api.getSummary({ source: 'all' })
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/summary?source=all')
  })

  it('encodes the call id', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(200, { call_id: 'a b' }))
    await api.getCall('a b')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/calls/a%20b')
  })

  it('sends a PATCH with a JSON body for finding updates', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(200, { id: 7, status: 'confirmed' }))
    const result = await api.updateFinding(7, { status: 'confirmed' })
    expect(result.status).toBe('confirmed')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/findings/7')
    expect(options.method).toBe('PATCH')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ status: 'confirmed' })
  })

  it('uploads a file as form data', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(201, { imported: ['x'] }))
    const file = new File(['[]'], 'calls.json', { type: 'application/json' })
    await api.importTranscripts(file)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/import')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file').name).toBe('calls.json')
    expect(options.headers).toBeUndefined()
  })

  it('imports a JSON array as a JSON body', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(201, { imported: ['x'] }))
    await api.importTranscripts([{ call_id: 'x' }])
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual([{ call_id: 'x' }])
  })
})

describe('api client: errors', () => {
  it('does not fall back on a 404', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(
      reply(404, { error: { code: 404, message: "Call 'nope' not found" } }),
    )
    await expect(api.getCall('nope')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: "Call 'nope' not found",
    })
    expect(api.isSnapshotMode()).toBe(false)
  })

  it('keeps the server error details on a 422', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(
      reply(422, {
        error: { code: 422, message: 'Invalid transcript', details: ['a: bad', 'b: bad'] },
      }),
    )
    await expect(api.importTranscripts([])).rejects.toMatchObject({
      status: 422,
      details: ['a: bad', 'b: bad'],
    })
    expect(api.isSnapshotMode()).toBe(false)
  })

  it('gives a generic message when the error body is unreadable', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(500))
    await expect(api.getSummary()).rejects.toMatchObject({
      status: 500,
      message: 'Request failed (500)',
    })
    expect(api.isSnapshotMode()).toBe(false)
  })
})

describe('api client: snapshot fallback', () => {
  it('falls back to the snapshot when the network fails', async () => {
    const api = await load()
    const listener = vi.fn()
    api.subscribeMode(listener)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const summary = await api.getSummary()
    expect(summary.calls_analysed).toBe(5)
    expect(api.isSnapshotMode()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('falls back to the snapshot on a 503', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(503, { error: { code: 503, message: 'sleeping' } }))
    const calls = await api.listCalls()
    expect(calls.total).toBe(5)
    expect(api.isSnapshotMode()).toBe(true)
  })

  it('keeps reading from the snapshot without calling the server again', async () => {
    const api = await load()
    fetchMock.mockRejectedValue(new TypeError('x'))
    await api.getSummary()
    await api.listCalls()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refuses writes in snapshot mode without calling the server', async () => {
    const api = await load()
    fetchMock.mockRejectedValue(new TypeError('x'))
    await api.getSummary()
    await expect(api.updateFinding(1, { status: 'confirmed' })).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('offline'),
    })
    await expect(api.importTranscripts([])).rejects.toThrow(/offline/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('switches to the snapshot when a write hits a 503', async () => {
    const api = await load()
    fetchMock.mockResolvedValue(reply(503, { error: { code: 503, message: 'sleeping' } }))
    await expect(api.updateFinding(1, { status: 'dismissed' })).rejects.toMatchObject({
      status: 503,
    })
    expect(api.isSnapshotMode()).toBe(true)
  })

  it('returns to the live API after retryLive', async () => {
    const api = await load()
    fetchMock.mockRejectedValueOnce(new TypeError('x'))
    await api.getSummary()
    expect(api.isSnapshotMode()).toBe(true)
    api.retryLive()
    expect(api.isSnapshotMode()).toBe(false)
    fetchMock.mockResolvedValueOnce(reply(200, { calls_analysed: 99 }))
    const summary = await api.getSummary()
    expect(summary.calls_analysed).toBe(99)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never calls the server when snapshot mode is forced', async () => {
    vi.stubEnv('VITE_API_MODE', 'snapshot')
    const api = await load()
    expect(api.isSnapshotMode()).toBe(true)
    const summary = await api.getSummary()
    expect(summary.calls_analysed).toBe(5)
    api.retryLive()
    expect(api.isSnapshotMode()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
