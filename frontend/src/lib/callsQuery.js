export const PAGE_SIZE = 20
export const DEFAULT_SORT = 'started_at'
export const DEFAULT_ORDER = 'desc'

const SORTS = ['call_id', 'agent', 'source', 'duration', 'findings', 'severity', 'started_at']
const ORDERS = ['asc', 'desc']
const SOURCES = ['real', 'synthetic']
const SEVERITIES = ['high', 'medium', 'low']
const NUMERIC_COLUMNS = ['duration', 'findings', 'severity']

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

// URL -> clean params. Anything invalid falls back to a default.
export function readParams(searchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '', 10)
  return {
    q: (searchParams.get('q') ?? '').trim(),
    agent: (searchParams.get('agent') ?? '').trim(),
    source: pick(searchParams.get('source'), SOURCES, ''),
    severity: pick(searchParams.get('severity'), SEVERITIES, ''),
    sort: pick(searchParams.get('sort'), SORTS, DEFAULT_SORT),
    order: pick(searchParams.get('order'), ORDERS, DEFAULT_ORDER),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

// Params -> URL. Defaults are left out so URLs stay short and canonical.
export function writeParams(params) {
  const next = new URLSearchParams()
  if (params.q) next.set('q', params.q)
  if (params.agent) next.set('agent', params.agent)
  if (params.source) next.set('source', params.source)
  if (params.severity) next.set('severity', params.severity)
  if (params.sort !== DEFAULT_SORT || params.order !== DEFAULT_ORDER) {
    next.set('sort', params.sort)
    next.set('order', params.order)
  }
  if (params.page > 1) next.set('page', String(params.page))
  return next
}

export function hasFilters(params) {
  return Boolean(params.q || params.agent || params.source || params.severity)
}

// Clicking the active column flips the order. A new column starts descending
// for numbers and ascending for text.
export function nextSort(params, column) {
  if (params.sort === column) {
    return { sort: column, order: params.order === 'asc' ? 'desc' : 'asc' }
  }
  return { sort: column, order: NUMERIC_COLUMNS.includes(column) ? 'desc' : 'asc' }
}
