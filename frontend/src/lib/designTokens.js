import { contrastRatio } from '@/lib/colors.js'

export const TOKEN_GROUPS = [
  { title: 'Surfaces', tokens: ['--bg', '--surface', '--raised'] },
  { title: 'Borders', tokens: ['--border', '--border-strong', '--input'] },
  { title: 'Text', tokens: ['--text', '--text-muted', '--text-faint'] },
  { title: 'Accent', tokens: ['--accent', '--accent-soft', '--on-accent'] },
  { title: 'Status', tokens: ['--high', '--medium', '--low', '--success'] },
]

export const TOKEN_NAMES = TOKEN_GROUPS.flatMap((group) => group.tokens)

export const TOKEN_ROLES = {
  '--bg': 'Page background',
  '--surface': 'Cards and the sidebar',
  '--raised': 'Skeletons, lane tracks, banners',
  '--border': 'Default 1px border',
  '--border-strong': 'Dashed and emphasis borders',
  '--input': 'Field and outline-button borders',
  '--text': 'Body text',
  '--text-muted': 'Secondary text',
  '--text-faint': 'Icons only',
  '--accent': 'Links, primary button, agent bars',
  '--accent-soft': 'Hover and selected surface',
  '--on-accent': 'Text on the accent',
  '--high': 'High severity',
  '--medium': 'Medium severity and slow responses',
  '--low': 'Low severity and dismissed',
  '--success': 'Confirmed',
}

// The current value of every token. style is anything with getPropertyValue
// (the page's computed style by default).
export function readThemeTokens(style) {
  const source = style || window.getComputedStyle(document.documentElement)
  const tokens = {}
  for (const name of TOKEN_NAMES) {
    tokens[name] = String(source.getPropertyValue(name) || '').trim()
  }
  return tokens
}

// Text needs 4.5:1 (WCAG AA). Icons, dots and field borders need 3:1.
export const CONTRAST_PAIRS = [
  { id: 'text-bg', label: 'Body text on the page', fg: '--text', bg: '--bg', need: 4.5 },
  { id: 'text-card', label: 'Body text on a card', fg: '--text', bg: '--surface', need: 4.5 },
  { id: 'muted-bg', label: 'Muted text on the page', fg: '--text-muted', bg: '--bg', need: 4.5 },
  { id: 'muted-card', label: 'Muted text on a card', fg: '--text-muted', bg: '--surface', need: 4.5 },
  {
    id: 'muted-raised',
    label: 'Muted text on a raised surface',
    fg: '--text-muted',
    bg: '--raised',
    need: 4.5,
  },
  { id: 'accent-card', label: 'Blue accent text on a card', fg: '--accent', bg: '--surface', need: 4.5 },
  { id: 'button', label: 'Primary button text', fg: '--on-accent', bg: '--accent', need: 4.5 },
  { id: 'high-card', label: 'High severity text on a card', fg: '--high', bg: '--surface', need: 4.5 },
  {
    id: 'medium-card',
    label: 'Medium severity text on a card',
    fg: '--medium',
    bg: '--surface',
    need: 4.5,
  },
  { id: 'success-card', label: 'Confirmed text on a card', fg: '--success', bg: '--surface', need: 4.5 },
  { id: 'faint-card', label: 'Faint icons on a card', fg: '--text-faint', bg: '--surface', need: 3 },
  {
    id: 'input-card',
    label: 'Field and outline-button borders on a card',
    fg: '--input',
    bg: '--surface',
    need: 3,
  },
  { id: 'low-card', label: 'Dismissed and low dots on a card', fg: '--low', bg: '--surface', need: 3 },
]

// Each pair with its measured ratio. ratio and pass are null when a colour cannot be read.
export function evaluatePairs(tokens, pairs = CONTRAST_PAIRS) {
  return pairs.map((pair) => {
    const ratio = contrastRatio(tokens[pair.fg], tokens[pair.bg])
    return { ...pair, ratio, pass: ratio === null ? null : ratio >= pair.need }
  })
}
