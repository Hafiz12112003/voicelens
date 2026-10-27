import { describe, expect, it } from 'vitest'
import {
  CONTRAST_PAIRS,
  TOKEN_NAMES,
  TOKEN_ROLES,
  evaluatePairs,
  readThemeTokens,
} from '@/lib/designTokens.js'
import { DARK_TOKENS, LIGHT_TOKENS } from './palettes.js'

const byId = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]))

describe('design tokens', () => {
  it('reads every token from a style and trims the values', () => {
    const style = {
      getPropertyValue: (name) => {
        if (name === '--bg') return '  #0b0d12 '
        if (name === '--text') return '#e6e9f0'
        return ''
      },
    }
    const tokens = readThemeTokens(style)
    expect(Object.keys(tokens)).toEqual(TOKEN_NAMES)
    expect(tokens['--bg']).toBe('#0b0d12')
    expect(tokens['--text']).toBe('#e6e9f0')
    expect(tokens['--surface']).toBe('')
  })

  it('only refers to tokens that exist, describes each one, and matches the test palettes', () => {
    expect(TOKEN_NAMES).toHaveLength(16)
    for (const pair of CONTRAST_PAIRS) {
      expect(TOKEN_NAMES).toContain(pair.fg)
      expect(TOKEN_NAMES).toContain(pair.bg)
    }
    for (const name of TOKEN_NAMES) expect(TOKEN_ROLES[name]).toBeTruthy()
    expect(new Set(CONTRAST_PAIRS.map((pair) => pair.id)).size).toBe(CONTRAST_PAIRS.length)
    expect(Object.keys(DARK_TOKENS).sort()).toEqual([...TOKEN_NAMES].sort())
    expect(Object.keys(LIGHT_TOKENS).sort()).toEqual([...TOKEN_NAMES].sort())
  })

  it('measures the dark theme, where only the field border is below 3:1', () => {
    const rows = byId(evaluatePairs(DARK_TOKENS))
    expect(rows['text-bg'].ratio).toBeCloseTo(15.99, 1)
    expect(rows['text-bg'].pass).toBe(true)
    expect(rows['muted-raised'].ratio).toBeCloseTo(5.66, 1)
    expect(rows.button.ratio).toBeCloseTo(6.07, 1)
    expect(rows['accent-card'].ratio).toBeCloseTo(5.76, 1)
    expect(rows['faint-card'].ratio).toBeCloseTo(3.16, 1)
    expect(rows['low-card'].ratio).toBeCloseTo(3.81, 1)
    expect(rows['input-card'].ratio).toBeCloseTo(1.5, 1)
    expect(rows['input-card'].pass).toBe(false)
    const failing = Object.values(rows).filter((row) => row.pass === false)
    expect(failing.map((row) => row.id)).toEqual(['input-card'])
  })

  it('measures the light theme, where every pair passes', () => {
    const rows = evaluatePairs(LIGHT_TOKENS)
    expect(rows).toHaveLength(CONTRAST_PAIRS.length)
    expect(rows.every((row) => row.pass === true)).toBe(true)
  })

  it('reports no ratio and no verdict when the colours cannot be read', () => {
    const rows = evaluatePairs({})
    expect(rows).toHaveLength(CONTRAST_PAIRS.length)
    expect(rows.every((row) => row.ratio === null && row.pass === null)).toBe(true)
  })
})
