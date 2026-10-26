import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRules, isSnapshotMode } from '@/services/api.js'
import * as snapshot from '@/services/snapshot.js'

const RULE_IDS = [
  'high_latency',
  'repeated_agent_turn',
  'ignored_constraint',
  'false_success_claim',
  'agent_talking_over_customer',
  'customer_repeated_themselves',
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rules api', () => {
  it('reads the live /rules endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rules: [{ id: 'x' }], languages: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await getRules()
    expect(result.rules).toEqual([{ id: 'x' }])
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/rules$/)
    expect(isSnapshotMode()).toBe(false)
  })

  it('bundles all six rules, English only, none validated', () => {
    const catalog = snapshot.getRules()
    expect(catalog.rules.map((rule) => rule.id)).toEqual(RULE_IDS)
    expect(catalog.rules.every((rule) => rule.validated === false)).toBe(true)
    expect(catalog.languages).toEqual([{ id: 'en', name: 'English' }])
  })

  it('falls back to the bundled rules when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    const result = await getRules()
    expect(result.rules.map((rule) => rule.id)).toEqual(RULE_IDS)
    expect(isSnapshotMode()).toBe(true)
  })
})
