// WCAG 2 contrast maths, used by the design page to measure the theme's colours.

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/
const FUNCTIONAL = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/

// "#rrggbb", "#rgb", "rgb(...)" or "rgba(...)" -> { r, g, b, a }, or null.
export function parseColor(value) {
  const text = String(value || '').trim().toLowerCase()
  const hex = HEX.exec(text)
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((c) => c + c)
            .join('')
        : hex[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    }
  }
  const fn = FUNCTIONAL.exec(text)
  if (!fn) return null
  const channels = [Number(fn[1]), Number(fn[2]), Number(fn[3])]
  const alpha =
    fn[4] === undefined ? 1 : fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : parseFloat(fn[4])
  if (channels.some((n) => !Number.isFinite(n) || n > 255) || !Number.isFinite(alpha)) return null
  return { r: channels[0], g: channels[1], b: channels[2], a: alpha }
}

function channel(value) {
  const n = value / 255
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

// Contrast ratio of two opaque colours (any order). null when either cannot be
// read or is see-through, because the result would depend on what is behind it.
export function contrastRatio(first, second) {
  const a = parseColor(first)
  const b = parseColor(second)
  if (!a || !b || a.a < 1 || b.a < 1) return null
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function formatRatio(ratio) {
  return typeof ratio === 'number' && Number.isFinite(ratio) ? `${ratio.toFixed(2)}:1` : 'n/a'
}
