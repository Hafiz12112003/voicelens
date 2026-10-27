// Made-up data for the design page. It is not a real call.
export const SAMPLE_TURNS = [
  { i: 0, speaker: 'agent', text: 'Thanks for calling, how can I help?', start_ms: 0, end_ms: 2200, latency_ms: null },
  { i: 1, speaker: 'customer', text: "I'd like to move my booking to Friday.", start_ms: 2700, end_ms: 5200, latency_ms: null },
  { i: 2, speaker: 'agent', text: 'Sure. Which time works for you on Friday?', start_ms: 8000, end_ms: 10500, latency_ms: 2800 },
  { i: 3, speaker: 'customer', text: 'Evening, around seven.', start_ms: 11000, end_ms: 12600, latency_ms: null },
  { i: 4, speaker: 'agent', text: 'Done. Your booking is moved to Friday at seven.', start_ms: 12900, end_ms: 15200, latency_ms: 300 },
]

export const SAMPLE_FINDINGS = [
  {
    id: 1,
    call_id: 'sample-call',
    turn_index: 2,
    rule: 'high_latency',
    severity: 'medium',
    evidence: 'gap 2800 ms (customer ended at 5200 ms, agent started at 8000 ms)',
    explanation: 'The agent took 2.8 seconds to respond after the customer finished.',
    status: 'open',
    note: null,
  },
  {
    id: 2,
    call_id: 'sample-call',
    turn_index: 4,
    rule: 'false_success_claim',
    severity: 'high',
    evidence: 'tool "move_booking" failed after turn 3; agent said "Done. Your booking is moved to Friday at seven." (matched "done")',
    explanation: 'The agent claimed success right after a tool call failed, so the customer may believe something happened that did not.',
    status: 'open',
    note: null,
  },
]
