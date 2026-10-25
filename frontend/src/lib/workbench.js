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

// Text from the editor -> { status: 'empty' | 'invalid' | 'ok', ... }.
// Missing call_id, agent and source get defaults; anything the user wrote wins.
export function prepareInput(text) {
  const trimmed = String(text || '').trim()
  if (trimmed === '') return { status: 'empty' }
  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    return { status: 'invalid', message: `Not valid JSON: ${error.message}` }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'invalid', message: 'Paste one call object, not a list or a single value.' }
  }
  return {
    status: 'ok',
    payload: { call_id: 'workbench', agent: 'workbench', source: 'synthetic', ...parsed },
  }
}
