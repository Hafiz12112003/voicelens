import { describe, expect, it } from 'vitest'
import { formatMs, formatPercent } from '@/lib/format.js'
import { dailySeries, sparklinePoints } from '@/lib/summary.js'

describe('sparklinePoints', () => {
  it('returns nothing with fewer than two numbers', () => {
    expect(sparklinePoints([])).toBe('')
    expect(sparklinePoints(undefined)).toBe('')
    expect(sparklinePoints([5])).toBe('')
    expect(sparklinePoints([null, 5, null])).toBe('')
  })

  it('puts the lowest value at the bottom and the highest at the top', () => {
    expect(sparklinePoints([0, 10])).toBe('2.0,26.0 98.0,2.0')
  })

  it('draws a flat series through the middle', () => {
    expect(sparklinePoints([5, 5, 5])).toBe('2.0,14.0 50.0,14.0 98.0,14.0')
  })

  it('skips null values but keeps their spacing', () => {
    expect(sparklinePoints([0, null, 10])).toBe('2.0,26.0 98.0,2.0')
  })
})

describe('dailySeries', () => {
  it('picks one key from each day', () => {
    const daily = [
      { date: 'a', calls: 1, avg_latency_ms: null },
      { date: 'b', calls: 3, avg_latency_ms: 450 },
    ]
    expect(dailySeries(daily, 'calls')).toEqual([1, 3])
    expect(dailySeries(daily, 'avg_latency_ms')).toEqual([null, 450])
    expect(dailySeries(undefined, 'calls')).toEqual([])
  })
})

describe('formatPercent', () => {
  it('formats ratios with at most one decimal and a dash for null', () => {
    expect(formatPercent(null)).toBe('\u2014')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(1 / 3)).toBe('33.3%')
    expect(formatPercent(1)).toBe('100%')
  })
})

describe('formatMs', () => {
  it('rounds, groups thousands and shows a dash for null', () => {
    expect(formatMs(null)).toBe('\u2014')
    expect(formatMs(743)).toBe('743 ms')
    expect(formatMs(2400)).toBe('2,400 ms')
    expect(formatMs(449.6)).toBe('450 ms')
  })
})
