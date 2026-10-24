export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '\u2014'
  const total = Math.round(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function formatMs(ms) {
  if (ms === null || ms === undefined) return '\u2014'
  return `${Math.round(ms).toLocaleString('en-US')} ms`
}

// Ratios from the API are 0 to 1 (null when undefined). One decimal at most.
export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined) return '\u2014'
  return `${Math.round(ratio * 1000) / 10}%`
}

// "repeated_agent_turn" -> "Repeated agent turn"
export function ruleLabel(rule) {
  const text = String(rule || '').replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }

export const REVIEW_LABELS = {
  clean: 'Clean',
  unreviewed: 'Unreviewed',
  in_review: 'In review',
  reviewed: 'Reviewed',
}
