import { describe, expect, it } from 'vitest'
import {
  gapBarRatio,
  groupByTurn,
  orderFindings,
  stepFinding,
  timelineSegments,
  topSeverity,
} from '@/lib/inspector.js'

const f = (id, turn_index, severity) => ({ id, turn_index, severity })

describe('topSeverity', () => {
  it('returns null when there are no findings', () => {
    expect(topSeverity([])).toBeNull()
    expect(topSeverity(undefined)).toBeNull()
  })

  it('picks the highest severity', () => {
    expect(topSeverity([f(1, 0, 'low'), f(2, 0, 'high'), f(3, 0, 'medium')])).toBe('high')
    expect(topSeverity([f(1, 0, 'low'), f(2, 0, 'medium')])).toBe('medium')
  })
})

describe('groupByTurn', () => {
  it('groups by turn and skips findings without a turn', () => {
    const groups = groupByTurn([f(1, 2, 'low'), f(2, 2, 'high'), f(3, null, 'low'), f(4, 5, 'low')])
    expect(groups.get(2).map((x) => x.id)).toEqual([1, 2])
    expect(groups.get(5).map((x) => x.id)).toEqual([4])
    expect(groups.size).toBe(2)
  })
})

describe('orderFindings', () => {
  it('sorts by turn, then severity, then id, with no-turn findings last', () => {
    const ordered = orderFindings([
      f(4, null, 'high'),
      f(3, 5, 'low'),
      f(2, 2, 'low'),
      f(1, 2, 'high'),
    ])
    expect(ordered.map((x) => x.id)).toEqual([1, 2, 3, 4])
  })
})

describe('stepFinding', () => {
  const ordered = [f(1, 1, 'low'), f(2, 3, 'low'), f(3, 6, 'low')]

  it('starts at the first (next) or last (previous) when nothing is selected', () => {
    expect(stepFinding(ordered, null, 1)).toBe(1)
    expect(stepFinding(ordered, null, -1)).toBe(3)
  })

  it('moves and stops at the ends', () => {
    expect(stepFinding(ordered, 1, 1)).toBe(2)
    expect(stepFinding(ordered, 2, -1)).toBe(1)
    expect(stepFinding(ordered, 3, 1)).toBe(3)
    expect(stepFinding(ordered, 1, -1)).toBe(1)
  })

  it('returns null when there are no findings', () => {
    expect(stepFinding([], null, 1)).toBeNull()
  })
})

describe('gapBarRatio', () => {
  it('is 0 for missing values and gaps that are not slow', () => {
    expect(gapBarRatio(null)).toBe(0)
    expect(gapBarRatio(undefined)).toBe(0)
    expect(gapBarRatio(-200)).toBe(0)
    expect(gapBarRatio(1500)).toBe(0)
  })

  it('is proportional for slow gaps and capped at 1', () => {
    expect(gapBarRatio(3000)).toBeCloseTo(0.5)
    expect(gapBarRatio(60000)).toBe(1)
  })
})

describe('timelineSegments', () => {
  it('returns one segment per turn with top severity and count', () => {
    const turns = [{ i: 0 }, { i: 1 }, { i: 2 }]
    const segments = timelineSegments(turns, [f(1, 1, 'low'), f(2, 1, 'high')])
    expect(segments).toEqual([
      { index: 0, severity: null, count: 0 },
      { index: 1, severity: 'high', count: 2 },
      { index: 2, severity: null, count: 0 },
    ])
  })
})
