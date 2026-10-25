import { describe, expect, it } from 'vitest'
import {
  buildLanes,
  formatSeconds,
  niceTicks,
  panView,
  zoomView,
} from '@/lib/lanes.js'

const TURNS = [
  { i: 0, speaker: 'agent', text: 'a', start_ms: 0, end_ms: 2000, latency_ms: null },
  { i: 1, speaker: 'customer', text: 'b', start_ms: 2500, end_ms: 4500, latency_ms: null },
  { i: 2, speaker: 'agent', text: 'c', start_ms: 9000, end_ms: 10000, latency_ms: 4500 },
  { i: 3, speaker: 'customer', text: 'd', start_ms: 10200, end_ms: 10500, latency_ms: null },
  { i: 4, speaker: 'agent', text: 'e', start_ms: 10600, end_ms: 11500, latency_ms: 100 },
]

describe('buildLanes', () => {
  it('draws turns with timestamps and counts the ones without', () => {
    const extra = { i: 5, speaker: 'customer', text: 'f', start_ms: null, end_ms: null }
    const lanes = buildLanes([...TURNS, extra])
    expect(lanes.hasTimes).toBe(true)
    expect(lanes.bars).toHaveLength(5)
    expect(lanes.skipped).toBe(1)
    expect(lanes.duration).toBe(11500)
  })

  it('places each gap before its agent turn and grades it', () => {
    expect(buildLanes(TURNS).gaps).toEqual([
      { i: 2, from: 4500, to: 9000, ms: 4500, level: 'high' },
      { i: 4, from: 10500, to: 10600, ms: 100, level: 'ok' },
    ])
  })

  it('grades a gap between 1.5 s and 3 s as slow', () => {
    const lanes = buildLanes([{ i: 1, speaker: 'agent', text: 'x', start_ms: 5000, end_ms: 6000, latency_ms: 2000 }])
    expect(lanes.gaps[0].level).toBe('slow')
    expect(lanes.gaps[0].from).toBe(3000)
  })

  it('finds overlap between consecutive turns of different speakers', () => {
    expect(buildLanes(TURNS).overlaps).toEqual([])
    const talking = [
      { i: 0, speaker: 'agent', text: 'a', start_ms: 0, end_ms: 3000 },
      { i: 1, speaker: 'customer', text: 'b', start_ms: 2000, end_ms: 4000 },
    ]
    const lanes = buildLanes(talking)
    expect(lanes.overlaps).toEqual([{ from: 2000, to: 3000, a: 0, b: 1 }])
    expect(lanes.duration).toBe(4000)
  })

  it('reports no times when no turn has timestamps', () => {
    const lanes = buildLanes([{ i: 0, speaker: 'agent', text: 'x' }])
    expect(lanes.hasTimes).toBe(false)
    expect(lanes.bars).toEqual([])
    expect(lanes.skipped).toBe(1)
  })
})

describe('zoom and pan', () => {
  it('zooms around an anchor and stops at the minimum window and full range', () => {
    expect(zoomView({ start: 0, end: 10000 }, 10000, 0.5, 5000)).toEqual({ start: 2500, end: 7500 })
    expect(zoomView({ start: 0, end: 10000 }, 10000, 0.5, 0)).toEqual({ start: 0, end: 5000 })
    const tiny = zoomView({ start: 0, end: 1500 }, 10000, 0.1)
    expect(tiny.end - tiny.start).toBe(1000)
    expect(zoomView({ start: 0, end: 10000 }, 10000, 2)).toEqual({ start: 0, end: 10000 })
  })

  it('pans by a fraction of the visible width and stops at the edges', () => {
    expect(panView({ start: 0, end: 5000 }, 10000, 0.5)).toEqual({ start: 2500, end: 7500 })
    expect(panView({ start: 5000, end: 10000 }, 10000, 1)).toEqual({ start: 5000, end: 10000 })
    expect(panView({ start: 0, end: 5000 }, 10000, -1)).toEqual({ start: 0, end: 5000 })
  })

  it('makes round ticks and formats seconds', () => {
    expect(niceTicks(0, 10000, 5)).toEqual([0, 2000, 4000, 6000, 8000, 10000])
    expect(niceTicks(0, 0)).toEqual([])
    expect(formatSeconds(1500)).toBe('1.5 s')
    expect(formatSeconds(2000)).toBe('2 s')
  })
})
