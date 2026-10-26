import { describe, expect, it } from 'vitest'
import { buildLanes } from '@/lib/lanes.js'

const TURNS = [
  { i: 0, speaker: 'agent', text: 'a', start_ms: 0, end_ms: 2000, latency_ms: null },
  { i: 1, speaker: 'customer', text: 'b', start_ms: 2500, end_ms: 4500, latency_ms: null },
  { i: 2, speaker: 'agent', text: 'c', start_ms: 9000, end_ms: 10000, latency_ms: 4500 },
  { i: 3, speaker: 'customer', text: 'd', start_ms: 10200, end_ms: 10500, latency_ms: null },
  { i: 4, speaker: 'agent', text: 'e', start_ms: 10600, end_ms: 11500, latency_ms: 100 },
]

const levels = (thresholds) => buildLanes(TURNS, thresholds).gaps.map((gap) => gap.level)

describe('buildLanes thresholds', () => {
  it('grades gaps with the thresholds it is given', () => {
    expect(levels()).toEqual(['high', 'ok'])
    expect(buildLanes(TURNS).thresholds).toEqual({ slowMs: 1500, highMs: 3000 })
    expect(levels({ slowMs: 2000, highMs: 4000 })).toEqual(['high', 'ok'])
    expect(levels({ slowMs: 2000, highMs: 5000 })).toEqual(['slow', 'ok'])
    expect(levels({ slowMs: 5000, highMs: 6000 })).toEqual(['ok', 'ok'])
    expect(levels({ slowMs: 50, highMs: 4000 })).toEqual(['high', 'slow'])
  })

  it('falls back to the defaults, key by key, for missing or invalid thresholds', () => {
    expect(buildLanes(TURNS, null).thresholds).toEqual({ slowMs: 1500, highMs: 3000 })
    expect(buildLanes(TURNS, { slowMs: -1, highMs: 'x' }).thresholds).toEqual({
      slowMs: 1500,
      highMs: 3000,
    })
    expect(buildLanes(TURNS, { slowMs: 2000 }).thresholds).toEqual({ slowMs: 2000, highMs: 3000 })
  })
})
