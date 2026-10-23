export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '\u2014'
  const total = Math.round(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }

export const REVIEW_LABELS = {
  clean: 'Clean',
  unreviewed: 'Unreviewed',
  in_review: 'In review',
  reviewed: 'Reviewed',
}
