import summaryAll from '../fixtures/summary-all.json'
import summaryReal from '../fixtures/summary-real.json'
import summarySynthetic from '../fixtures/summary-synthetic.json'
import callsData from '../fixtures/calls.json'
import rulesData from '../fixtures/rules.json'

// Read-only fallback used when the API is unreachable. It serves the bundled
// snapshot exactly as stored; it never computes metrics.

const detailModules = import.meta.glob('../fixtures/calls/*.json', {
  eager: true,
  import: 'default',
})

const details = Object.fromEntries(
  Object.values(detailModules).map((detail) => [detail.call_id, detail]),
)

const SUMMARIES = { real: summaryReal, synthetic: summarySynthetic, all: summaryAll }

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 }

function sortValue(item, sort) {
  switch (sort) {
    case 'call_id':
      return item.call_id
    case 'agent':
      return item.agent
    case 'source':
      return item.source
    case 'duration':
      return item.duration_ms ?? -1
    case 'findings':
      return item.findings_count
    case 'severity':
      return SEVERITY_RANK[item.max_severity] ?? 0
    default:
      return item.started_at ?? ''
  }
}

function matches(item, { q, agent, source, severity }) {
  if (agent && item.agent !== agent) return false
  if (source && item.source !== source) return false
  const detail = details[item.call_id]
  if (severity && !detail?.findings.some((f) => f.severity === severity)) return false
  if (q) {
    const needle = q.toLowerCase()
    const inId = item.call_id.toLowerCase().includes(needle)
    const inText = detail?.turns.some((t) => t.text.toLowerCase().includes(needle))
    if (!inId && !inText) return false
  }
  return true
}

// One stored summary per source, served as exported. With no source (or an
// unknown one) it serves "all". The live API defaults to "real" instead; the
// Summary page always passes a source, so users do not hit the difference.
export function getSummary({ source } = {}) {
  return Object.hasOwn(SUMMARIES, source) ? SUMMARIES[source] : summaryAll
}

// The rule catalog as exported from the API.
export function getRules() {
  return rulesData
}

export function listCalls(params = {}) {
  const { sort = 'started_at', order = 'desc', page = 1, pageSize = 20 } = params
  const direction = order === 'asc' ? 1 : -1

  const filtered = callsData.items.filter((item) => matches(item, params))
  filtered.sort((a, b) => {
    const x = sortValue(a, sort)
    const y = sortValue(b, sort)
    if (x < y) return -direction
    if (x > y) return direction
    return a.call_id < b.call_id ? -1 : 1
  })

  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize),
    agents: callsData.agents,
    page,
    page_size: pageSize,
    total: filtered.length,
    total_pages: Math.ceil(filtered.length / pageSize),
  }
}

export function getCall(callId) {
  return details[callId]
}
