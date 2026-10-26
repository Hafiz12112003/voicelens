import { SLOW_GAP_MS } from '@/lib/inspector.js'

export { SLOW_GAP_MS }
export const HIGH_GAP_MS = 3000
export const MIN_WINDOW_MS = 1000

function isTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function pickThreshold(value, fallback) {
  return isTime(value) ? value : fallback
}

// Drawing geometry only. Latency values come from the API (latency_ms).
// thresholds ({ slowMs, highMs }) only decide how gaps are graded and where the
// dashed ticks go. Anything missing or invalid falls back to the rule defaults.
export function buildLanes(turns, thresholds) {
  const slowMs = pickThreshold(thresholds?.slowMs, SLOW_GAP_MS)
  const highMs = pickThreshold(thresholds?.highMs, HIGH_GAP_MS)
  const list = turns || []
  const bars = []
  let skipped = 0
  for (const turn of list) {
    if (isTime(turn.start_ms) && isTime(turn.end_ms) && turn.end_ms >= turn.start_ms) {
      bars.push({ i: turn.i, speaker: turn.speaker, start: turn.start_ms, end: turn.end_ms })
    } else {
      skipped += 1
    }
  }

  const gaps = []
  for (const turn of list) {
    const ms = turn.latency_ms
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0 || !isTime(turn.start_ms)) continue
    const from = turn.start_ms - ms
    if (from < 0) continue
    const level = ms > highMs ? 'high' : ms > slowMs ? 'slow' : 'ok'
    gaps.push({ i: turn.i, from, to: turn.start_ms, ms, level })
  }

  const overlaps = []
  for (let k = 1; k < list.length; k += 1) {
    const prev = list[k - 1]
    const cur = list[k]
    if (prev.speaker === cur.speaker) continue
    if (!isTime(prev.start_ms) || !isTime(prev.end_ms)) continue
    if (!isTime(cur.start_ms) || !isTime(cur.end_ms)) continue
    if (prev.end_ms > cur.start_ms) {
      overlaps.push({ from: cur.start_ms, to: Math.min(prev.end_ms, cur.end_ms), a: prev.i, b: cur.i })
    }
  }

  let duration = 0
  for (const bar of bars) duration = Math.max(duration, bar.end)
  for (const gap of gaps) duration = Math.max(duration, gap.to)

  return {
    hasTimes: bars.length > 0,
    bars,
    gaps,
    overlaps,
    skipped,
    duration: Math.max(duration, 1),
    thresholds: { slowMs, highMs },
  }
}

export function clampView(view, duration) {
  const minWidth = Math.min(MIN_WINDOW_MS, duration)
  const width = Math.min(Math.max(view.end - view.start, minWidth), duration)
  const start = Math.min(Math.max(view.start, 0), duration - width)
  return { start, end: start + width }
}

// factor below 1 zooms in, above 1 zooms out. The anchor stays put on screen.
export function zoomView(view, duration, factor, anchor) {
  const current = view.end - view.start
  const center = anchor === undefined ? (view.start + view.end) / 2 : anchor
  const ratio = (center - view.start) / current
  const width = current * factor
  const start = center - width * ratio
  return clampView({ start, end: start + width }, duration)
}

// fraction is of the visible width; negative pans left.
export function panView(view, duration, fraction) {
  const shift = (view.end - view.start) * fraction
  return clampView({ start: view.start + shift, end: view.end + shift }, duration)
}

const TICK_STEPS = [
  100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000,
]

export function niceTicks(start, end, target = 6) {
  const span = end - start
  if (!(span > 0)) return []
  const rough = span / target
  const step = TICK_STEPS.find((s) => s >= rough) || TICK_STEPS[TICK_STEPS.length - 1]
  const ticks = []
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) ticks.push(t)
  return ticks
}

export function formatSeconds(ms) {
  const seconds = ms / 1000
  return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`
}
