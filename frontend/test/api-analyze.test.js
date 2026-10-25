import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeCall, isSnapshotMode } from '@/services/api.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('analyzeCall', () => {
  it('posts the call as JSON and returns the result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ call_id: 'c1' }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await analyzeCall({ call_id: 'c1' })
    expect(result).toEqual({ call_id: 'c1' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/analyze$/)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ call_id: 'c1' })
  })

  it('throws an ApiError with the details list on a 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: { message: 'Invalid transcript', details: ['x: agent is required'] },
        }),
      }),
    )
    await expect(analyzeCall({})).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'Invalid transcript',
      details: ['x: agent is required'],
    })
  })

  it('reports an unreachable server without switching to snapshot mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(analyzeCall({})).rejects.toMatchObject({
      status: 0,
      message: 'Cannot reach the server',
    })
    expect(isSnapshotMode()).toBe(false)
  })
})
