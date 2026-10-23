import { describe, expect, it } from 'vitest'
import * as snapshot from '@/services/snapshot.js'

const ids = (page) => page.items.map((item) => item.call_id)

describe('snapshot', () => {
  it('serves the summary exactly as stored', () => {
    const summary = snapshot.getSummary()
    expect(summary.calls_analysed).toBe(5)
    expect(summary.scope.source).toBe('all')
    expect(summary.latency.avg_ms).toBe(743)
  })

  it('lists newest first by default', () => {
    expect(ids(snapshot.listCalls())).toEqual([
      'synthetic-reservation-001',
      'synthetic-ecommerce-001',
      'synthetic-flight-001',
      'synthetic-hotel-001',
      'synthetic-restaurant-001',
    ])
  })

  it('lists every agent regardless of filters', () => {
    const all = [
      'ecommerce-demo',
      'flight-demo',
      'hotel-demo',
      'reservation-demo',
      'restaurant-demo',
    ]
    expect(snapshot.listCalls().agents).toEqual(all)
    expect(snapshot.listCalls({ source: 'real' }).agents).toEqual(all)
    expect(snapshot.listCalls({ agent: 'hotel-demo', pageSize: 1 }).agents).toEqual(all)
  })

  it('filters by source', () => {
    const real = snapshot.listCalls({ source: 'real' })
    expect(real.items).toEqual([])
    expect(real.total).toBe(0)
    expect(real.total_pages).toBe(0)
    expect(snapshot.listCalls({ source: 'synthetic' }).total).toBe(5)
  })

  it('filters by agent', () => {
    expect(ids(snapshot.listCalls({ agent: 'hotel-demo' }))).toEqual(['synthetic-hotel-001'])
  })

  it('filters by severity', () => {
    expect(ids(snapshot.listCalls({ severity: 'high' }))).toEqual([
      'synthetic-flight-001',
      'synthetic-hotel-001',
      'synthetic-restaurant-001',
    ])
    expect(ids(snapshot.listCalls({ severity: 'medium' }))).toEqual([
      'synthetic-reservation-001',
      'synthetic-restaurant-001',
    ])
    expect(snapshot.listCalls({ severity: 'low' }).total).toBe(0)
  })

  it('searches call ids and transcript text', () => {
    expect(ids(snapshot.listCalls({ q: 'SYNTHETIC-HOTEL' }))).toEqual(['synthetic-hotel-001'])
    expect(ids(snapshot.listCalls({ q: 'delhi' }))).toEqual(['synthetic-flight-001'])
    expect(ids(snapshot.listCalls({ q: 'vegetarian' }))).toEqual(['synthetic-restaurant-001'])
  })

  it('returns an empty page when nothing matches', () => {
    const page = snapshot.listCalls({ q: 'zzz-no-match' })
    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
    expect(page.total_pages).toBe(0)
  })

  it('sorts by findings with ties broken by call id', () => {
    expect(ids(snapshot.listCalls({ sort: 'findings', order: 'desc' }))).toEqual([
      'synthetic-reservation-001',
      'synthetic-restaurant-001',
      'synthetic-flight-001',
      'synthetic-hotel-001',
      'synthetic-ecommerce-001',
    ])
  })

  it('sorts by duration ascending', () => {
    expect(ids(snapshot.listCalls({ sort: 'duration', order: 'asc' }))).toEqual([
      'synthetic-ecommerce-001',
      'synthetic-hotel-001',
      'synthetic-flight-001',
      'synthetic-reservation-001',
      'synthetic-restaurant-001',
    ])
  })

  it('paginates', () => {
    const base = { sort: 'call_id', order: 'asc', pageSize: 2 }
    const first = snapshot.listCalls({ ...base, page: 1 })
    expect(ids(first)).toEqual(['synthetic-ecommerce-001', 'synthetic-flight-001'])
    expect(first.total).toBe(5)
    expect(first.total_pages).toBe(3)
    expect(ids(snapshot.listCalls({ ...base, page: 2 }))).toEqual([
      'synthetic-hotel-001',
      'synthetic-reservation-001',
    ])
    expect(ids(snapshot.listCalls({ ...base, page: 3 }))).toEqual(['synthetic-restaurant-001'])
  })

  it('returns call details or undefined', () => {
    const detail = snapshot.getCall('synthetic-flight-001')
    expect(detail.call_id).toBe('synthetic-flight-001')
    expect(detail.findings).toHaveLength(1)
    expect(snapshot.getCall('nope')).toBeUndefined()
  })
})
