const SEVERITY_RANK = { high: 3, medium: 2, low: 1 }

// Gaps at or below this are not drawn as slow (matches backend rule 1).
export const SLOW_GAP_MS = 1500
// A gap this long (or longer) fills the whole bar.
export const MAX_GAP_BAR_MS = 6000

export function topSeverity(findings) {
  let best = null
  for (const finding of findings || []) {
    const rank = SEVERITY_RANK[finding.severity] || 0
    if (rank > (best ? SEVERITY_RANK[best] : 0)) best = finding.severity
  }
  return best
}

// Map of turn index -> findings on that turn. Findings without a turn are skipped.
export function groupByTurn(findings) {
  const groups = new Map()
  for (const finding of findings || []) {
    if (finding.turn_index === null || finding.turn_index === undefined) continue
    if (!groups.has(finding.turn_index)) groups.set(finding.turn_index, [])
    groups.get(finding.turn_index).push(finding)
  }
  return groups
}

// Reading order: by turn, then higher severity first, then id. No-turn findings last.
export function orderFindings(findings) {
  const turnOf = (f) =>
    f.turn_index === null || f.turn_index === undefined ? Number.POSITIVE_INFINITY : f.turn_index
  return [...(findings || [])].sort((a, b) => {
    if (turnOf(a) !== turnOf(b)) return turnOf(a) < turnOf(b) ? -1 : 1
    const bySeverity = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    if (bySeverity !== 0) return bySeverity
    return a.id - b.id
  })
}

// Next/previous finding id for the j/k keys. Stops at the ends (no wrap).
// With nothing selected: direction 1 gives the first, -1 gives the last.
export function stepFinding(ordered, currentId, direction) {
  if (!ordered || ordered.length === 0) return null
  const index = ordered.findIndex((f) => f.id === currentId)
  if (index === -1) return direction > 0 ? ordered[0].id : ordered[ordered.length - 1].id
  const next = Math.min(Math.max(index + direction, 0), ordered.length - 1)
  return ordered[next].id
}

// 0 for missing or non-slow gaps, else 0..1 proportional to the gap length.
export function gapBarRatio(latencyMs) {
  if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) return 0
  if (latencyMs <= SLOW_GAP_MS) return 0
  return Math.min(latencyMs / MAX_GAP_BAR_MS, 1)
}

// One segment per turn for the timeline strip.
export function timelineSegments(turns, findings) {
  const groups = groupByTurn(findings)
  return (turns || []).map((turn) => {
    const onTurn = groups.get(turn.i) || []
    return { index: turn.i, severity: topSeverity(onTurn), count: onTurn.length }
  })
}
