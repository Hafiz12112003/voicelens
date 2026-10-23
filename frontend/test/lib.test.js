import { describe, expect, it } from 'vitest'
import { hasFilters, nextSort, readParams, writeParams } from '@/lib/callsQuery.js'
import { formatDuration } from '@/lib/format.js'

const read = (query) => readParams(new URLSearchParams(query))

const DEFAULTS = {
  q: '',
  agent: '',
  source: '',
  severity: '',
  sort: 'started_at',
  order: 'desc',
  page: 1,
}

describe('formatDuration', () => {
  it('shows a dash when there is no duration', () => {
    expect(formatDuration(null)).toBe('\u2014')
    expect(formatDuration(undefined)).toBe('\u2014')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(13000)).toBe('0:13')
    expect(formatDuration(65000)).toBe('1:05')
    expect(formatDuration(125000)).toBe('2:05')
  })

  it('rounds to the nearest second', () => {
    expect(formatDuration(499)).toBe('0:00')
    expect(formatDuration(500)).toBe('0:01')
  })

  it('adds hours when needed', () => {
    expect(formatDuration(3725000)).toBe('1:02:05')
  })
})

describe('calls query params', () => {
  it('reads defaults from an empty query', () => {
    expect(read('')).toEqual(DEFAULTS)
  })

  it('reads valid values', () => {
    const query = 'q=veg&agent=hotel-demo&source=real&severity=high&sort=findings&order=asc&page=3'
    expect(read(query)).toEqual({
      q: 'veg',
      agent: 'hotel-demo',
      source: 'real',
      severity: 'high',
      sort: 'findings',
      order: 'asc',
      page: 3,
    })
  })

  it('falls back to defaults for invalid values', () => {
    expect(read('source=demo&severity=urgent&sort=bogus&order=up&page=0')).toEqual(DEFAULTS)
    expect(read('page=abc').page).toBe(1)
    expect(read('page=-2').page).toBe(1)
  })

  it('trims text values', () => {
    const params = read('q=%20%20delhi%20&agent=%20hotel-demo')
    expect(params.q).toBe('delhi')
    expect(params.agent).toBe('hotel-demo')
  })

  it('writes only non-default values', () => {
    expect(writeParams(DEFAULTS).toString()).toBe('')
    expect(writeParams({ ...DEFAULTS, q: 'a b', page: 2 }).toString()).toBe('q=a+b&page=2')
  })

  it('keeps sort and order together', () => {
    expect(writeParams({ ...DEFAULTS, sort: 'agent', order: 'asc' }).toString()).toBe(
      'sort=agent&order=asc',
    )
    expect(writeParams({ ...DEFAULTS, order: 'asc' }).toString()).toBe(
      'sort=started_at&order=asc',
    )
  })

  it('round trips a full query', () => {
    const query = 'q=veg&agent=hotel-demo&source=real&severity=high&sort=findings&order=asc&page=3'
    expect(writeParams(read(query)).toString()).toBe(query)
  })

  it('picks the next sort order', () => {
    expect(nextSort(DEFAULTS, 'findings')).toEqual({ sort: 'findings', order: 'desc' })
    expect(nextSort(DEFAULTS, 'duration')).toEqual({ sort: 'duration', order: 'desc' })
    expect(nextSort(DEFAULTS, 'agent')).toEqual({ sort: 'agent', order: 'asc' })
    expect(nextSort({ ...DEFAULTS, sort: 'agent', order: 'asc' }, 'agent')).toEqual({
      sort: 'agent',
      order: 'desc',
    })
    expect(nextSort({ ...DEFAULTS, sort: 'findings', order: 'desc' }, 'findings')).toEqual({
      sort: 'findings',
      order: 'asc',
    })
  })

  it('detects active filters but not sort or page', () => {
    expect(hasFilters(DEFAULTS)).toBe(false)
    expect(hasFilters({ ...DEFAULTS, sort: 'agent', order: 'asc', page: 4 })).toBe(false)
    expect(hasFilters({ ...DEFAULTS, q: 'x' })).toBe(true)
    expect(hasFilters({ ...DEFAULTS, agent: 'x' })).toBe(true)
    expect(hasFilters({ ...DEFAULTS, source: 'real' })).toBe(true)
    expect(hasFilters({ ...DEFAULTS, severity: 'high' })).toBe(true)
  })
})
