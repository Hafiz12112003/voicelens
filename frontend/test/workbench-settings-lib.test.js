import { describe, expect, it } from 'vitest'
import {
  formatSettingValue,
  lanesThresholds,
  prepareInput,
  settingsFromFields,
  thresholdFields,
} from '@/lib/workbench.js'

describe('settingsFromFields', () => {
  it('keeps only filled, finite numbers', () => {
    expect(
      settingsFromFields({
        threshold_ms: '2000',
        high_ms: '',
        jaccard_threshold: ' 0.9 ',
        overlap_ms: 'abc',
        customer_jaccard_threshold: 'Infinity',
      }),
    ).toEqual({ threshold_ms: 2000, jaccard_threshold: 0.9 })
    expect(settingsFromFields(undefined)).toEqual({})
  })
})

describe('prepareInput with settings', () => {
  it('adds the panel settings over the ones written in the JSON', () => {
    const own = '{"turns":[],"settings":{"threshold_ms":1000,"overlap_ms":200}}'
    expect(prepareInput(own, { threshold_ms: 2000 }).payload.settings).toEqual({
      threshold_ms: 2000,
      overlap_ms: 200,
    })
    expect(prepareInput(own).payload.settings).toEqual({ threshold_ms: 1000, overlap_ms: 200 })
    expect(prepareInput('{"turns":[],"settings":5}', { threshold_ms: 2000 }).payload.settings).toEqual({
      threshold_ms: 2000,
    })
    expect(prepareInput('{"turns":[],"settings":5}').payload.settings).toBe(5)
    expect('settings' in prepareInput('{"turns":[]}', {}).payload).toBe(false)
  })
})

describe('catalog helpers', () => {
  it('flattens thresholds with their rule name and builds the lane thresholds', () => {
    const rules = [
      { name: 'A', thresholds: [{ key: 'x', default: 1 }] },
      { name: 'B', thresholds: [] },
      { name: 'C' },
    ]
    expect(thresholdFields(rules)).toEqual([{ key: 'x', default: 1, ruleName: 'A' }])
    expect(thresholdFields(undefined)).toEqual([])
    expect(lanesThresholds({ threshold_ms: 2000, high_ms: 4000 })).toEqual({
      slowMs: 2000,
      highMs: 4000,
    })
    expect(lanesThresholds({ threshold_ms: 2000 })).toBeUndefined()
    expect(lanesThresholds(undefined)).toBeUndefined()
    expect(formatSettingValue(1500, 'ms')).toBe('1,500 ms')
    expect(formatSettingValue(0.8, 'ratio')).toBe('0.8')
  })
})
