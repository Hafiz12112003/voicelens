// Synthetic example. Written by hand for this app, not a real call.
export const EXAMPLE_CALL = {
  call_id: 'example-1',
  agent: 'restaurant-demo',
  source: 'synthetic',
  outcome: 'escalated',
  turns: [
    { i: 0, speaker: 'agent', text: 'Welcome to Spice Garden, how can I help?', start_ms: 0, end_ms: 2500 },
    { i: 1, speaker: 'customer', text: 'I want to book a table for two, vegetarian please.', start_ms: 3000, end_ms: 6000 },
    { i: 2, speaker: 'agent', text: 'Confirmed: a table for four, with chicken biryani.', start_ms: 10000, end_ms: 12500 },
    { i: 3, speaker: 'customer', text: 'That is not what I asked for.', start_ms: 12800, end_ms: 14500 },
    { i: 4, speaker: 'agent', text: 'Sorry, let me check that.', start_ms: 15000, end_ms: 16000 },
    { i: 5, speaker: 'customer', text: 'Please fix it.', start_ms: 16200, end_ms: 17000 },
    { i: 6, speaker: 'agent', text: 'Sorry, let me check that.', start_ms: 17300, end_ms: 18000 },
  ],
}

export function exampleText() {
  return JSON.stringify(EXAMPLE_CALL, null, 2)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Text from the editor -> { status: 'empty' | 'invalid' | 'ok', ... }.
// Missing call_id, agent and source get defaults; anything the user wrote wins.
// settings (from the settings panel) are added to the call and override a
// "settings" object written in the JSON. With no settings the payload is left alone.
export function prepareInput(text, settings = {}) {
  const trimmed = String(text || '').trim()
  if (trimmed === '') return { status: 'empty' }
  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    return { status: 'invalid', message: `Not valid JSON: ${error.message}` }
  }
  if (!isPlainObject(parsed)) {
    return { status: 'invalid', message: 'Paste one call object, not a list or a single value.' }
  }
  const payload = { call_id: 'workbench', agent: 'workbench', source: 'synthetic', ...parsed }
  if (Object.keys(settings).length > 0) {
    payload.settings = { ...(isPlainObject(parsed.settings) ? parsed.settings : {}), ...settings }
  }
  return { status: 'ok', payload }
}

// Field text from the settings panel -> { key: number }. Blank and non-numeric
// fields are left out, so the server uses its default for them.
export function settingsFromFields(fields) {
  const out = {}
  for (const [key, raw] of Object.entries(fields || {})) {
    const text = String(raw).trim()
    if (text === '') continue
    const value = Number(text)
    if (Number.isFinite(value)) out[key] = value
  }
  return out
}

// Every rule setting from the /rules catalog, with the name of its rule.
export function thresholdFields(rules) {
  const fields = []
  for (const rule of rules || []) {
    for (const threshold of rule.thresholds || []) {
      fields.push({ ...threshold, ruleName: rule.name })
    }
  }
  return fields
}

export function formatSettingValue(value, unit) {
  if (typeof value !== 'number') return String(value)
  if (unit === 'ms') return `${value.toLocaleString('en-US')} ms`
  return String(value)
}

// The latency thresholds the server used, in the shape the lanes view takes.
export function lanesThresholds(settings) {
  if (!settings) return undefined
  const slowMs = settings.threshold_ms
  const highMs = settings.high_ms
  if (typeof slowMs !== 'number' || typeof highMs !== 'number') return undefined
  return { slowMs, highMs }
}
