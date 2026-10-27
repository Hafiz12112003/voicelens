import { describe, expect, it } from 'vitest'
import { contrastRatio, formatRatio, parseColor } from '@/lib/colors.js'

describe('parseColor', () => {
  it('reads hex and rgb colours, with or without alpha', () => {
    expect(parseColor('#0b0d12')).toEqual({ r: 11, g: 13, b: 18, a: 1 })
    expect(parseColor(' #FFF ')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('rgba(76, 141, 255, .12)')).toEqual({ r: 76, g: 141, b: 255, a: 0.12 })
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 })
  })

  it('returns null for anything it cannot read', () => {
    for (const bad of ['', undefined, null, 'blue', '#12', '#12345g', 'rgb(300, 0, 0)', 'rgb(1, 2)']) {
      expect(parseColor(bad)).toBeNull()
    }
  })
})

describe('contrastRatio', () => {
  it('matches known values, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
    expect(contrastRatio('#e6e9f0', '#0b0d12')).toBeCloseTo(15.99, 2)
    expect(contrastRatio('#1f56d8', '#ffffff')).toBeCloseTo(6.21, 2)
  })

  it('gives null for unreadable or see-through colours', () => {
    expect(contrastRatio('', '#ffffff')).toBeNull()
    expect(contrastRatio('#ffffff', 'rgba(0, 0, 0, .5)')).toBeNull()
  })
})

describe('formatRatio', () => {
  it('shows two decimals, or n/a when there is no number', () => {
    expect(formatRatio(15.987)).toBe('15.99:1')
    expect(formatRatio(3)).toBe('3.00:1')
    expect(formatRatio(null)).toBe('n/a')
    expect(formatRatio(Number.NaN)).toBe('n/a')
  })
})
