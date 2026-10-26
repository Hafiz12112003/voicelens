import * as snapshot from './snapshot.js'

const BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/+$/, '')
const FORCED_SNAPSHOT = import.meta.env.VITE_API_MODE === 'snapshot'
const OFFLINE_STATUSES = [502, 503, 504]
const READ_ONLY_MESSAGE =
  'The server is offline, so this action is unavailable. You are viewing a saved snapshot.'

export class ApiError extends Error {
  constructor(message, { status = 0, details = [] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

// Snapshot mode: reads come from the bundled snapshot because the API is down.
let snapshotActive = FORCED_SNAPSHOT
const listeners = new Set()

export function isSnapshotMode() {
  return snapshotActive
}

export function subscribeMode(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSnapshotMode(value) {
  if (snapshotActive === value) return
  snapshotActive = value
  listeners.forEach((listener) => listener())
}

// Try the live API again on the next request (no effect when forced).
export function retryLive() {
  if (!FORCED_SNAPSHOT) setSnapshotMode(false)
}

function isOffline(error) {
  return error.status === 0 || OFFLINE_STATUSES.includes(error.status)
}

function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function request(path, options) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, options)
  } catch {
    throw new ApiError('Cannot reach the server', { status: 0 })
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = body?.error
    throw new ApiError(error?.message || `Request failed (${response.status})`, {
      status: response.status,
      details: error?.details || [],
    })
  }
  return body
}

async function read(path, fromSnapshot) {
  if (!snapshotActive) {
    try {
      return await request(path)
    } catch (error) {
      if (!isOffline(error)) throw error
      setSnapshotMode(true)
    }
  }
  return fromSnapshot()
}

async function write(path, options) {
  if (snapshotActive) throw new ApiError(READ_ONLY_MESSAGE, { status: 0 })
  try {
    return await request(path, options)
  } catch (error) {
    if (isOffline(error)) setSnapshotMode(true)
    throw error
  }
}

export function getHealth() {
  return request('/health')
}

export function getSummary({ source } = {}) {
  return read(`/summary${query({ source })}`, () => snapshot.getSummary({ source }))
}

export function getRules() {
  return read('/rules', () => snapshot.getRules())
}

export function listCalls({ q, agent, source, severity, sort, order, page, pageSize } = {}) {
  return read(
    `/calls${query({ q, agent, source, severity, sort, order, page, page_size: pageSize })}`,
    () => snapshot.listCalls({ q, agent, source, severity, sort, order, page, pageSize }),
  )
}

export function getCall(callId) {
  return read(`/calls/${encodeURIComponent(callId)}`, () => {
    const detail = snapshot.getCall(callId)
    if (!detail) {
      throw new ApiError(`Call '${callId}' is not in the saved snapshot`, { status: 404 })
    }
    return detail
  })
}

export function updateFinding(findingId, patch) {
  return write(`/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export function importTranscripts(input) {
  if (input instanceof Blob) {
    const form = new FormData()
    form.append('file', input, input.name || 'upload.json')
    return write('/import', { method: 'POST', body: form })
  }
  return write('/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

// Stateless: nothing is saved, so this skips write() and the snapshot refusal.
export function analyzeCall(call) {
  return request('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(call),
  })
}
