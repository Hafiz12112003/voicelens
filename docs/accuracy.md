# Accuracy and limits

This page says what VoiceLens has been checked against. The short version: nothing real. VoiceLens is an independent prototype inspired by Zudu's public product, and everything it ships with is synthetic.

## Current evidence: none

- There are no hand labels. `backend/data/labels.json` is empty.
- No real calls were collected. `backend/data/real_excerpts.json` is empty.
- The five bundled calls are synthetic. They were written by hand to exercise the rules, so a rule catching one of them says nothing about how it behaves on real calls.
- The accuracy section of the Summary page says "No labels yet". It will keep saying so until real calls are hand-labelled.
- There is no accuracy number for any rule, here or anywhere else in the project. None of the six rules has been validated on real calls.

## How accuracy would be measured

The Summary page already has the machinery, and it stays empty until there is data:

- A label is one judgement by a person: for this call, this turn and this rule, is it a real issue or not (`is_real_issue`).
- Only real calls can be labelled. The seeder rejects a label on a synthetic call, and synthetic calls are never part of the accuracy numbers.
- For each rule, the page counts true positives, false positives, false negatives and true negatives, then precision and recall. A ratio that cannot be defined is shown as not defined, never as zero.
- The page says the sample is small and the numbers are indicative, not a benchmark.
- Recall only sees the misses that someone labelled. A real issue that nobody labelled and the rule did not flag is invisible, so recall can only be trusted if every turn of the sampled calls is labelled for every rule.

Validating the rules would take real calls recorded from a real agent, every turn labelled for every rule, enough calls per rule for the sample size to mean something, and new labels after any rule change. Raw audio is never published. Transcript excerpts only.

## What the rules can and cannot do

The six rules are fixed checks over text and timestamps. A finding is a candidate for a person to review, not a verdict. The limits below are the same text the app shows on its Rules page.

### High latency (`high_latency`)

Flags an agent turn that starts too long after the customer finished speaking. Defaults: 1500 ms to flag, 3000 ms for high severity.

- Only as accurate as the timestamps you supply.
- Measures customer end to next agent start, only for a customer turn followed directly by an agent turn.
- Overlapping turns (a negative gap) are skipped, not counted as latency.
- The default thresholds are not checked against what callers actually notice.

### Repeated agent turn (`repeated_agent_turn`)

Flags an agent turn that says almost the same thing as the agent's previous turn. Default: word overlap of 0.8.

- Compares only with the previous agent turn.
- Compares sets of words, so word order is ignored and different sentences with the same words can match.
- Splits text on spaces, so languages written without spaces are not handled.
- A deliberate repeat, such as reading back an order number, is flagged too.

### Ignored constraint (`ignored_constraint`)

Flags an agent confirmation that contradicts what the customer just asked for. This rule runs only for restaurant and hotel agents.

- Only runs for agent names starting with restaurant or hotel.
- Uses small English word lists: quantities 1 to 20, vegetarian words, a few excluded items and non-smoking.
- Only checks the first agent turn with a confirmation word before the next customer turn.
- Findings are candidates for review, not verdicts: the customer may have changed the request later.

### False success claim (`false_success_claim`)

Flags an agent turn that claims success right after a tool call failed. It needs `tool_events`. CSV imports and phone calls have none, so this rule cannot be tested on them.

- Needs tool_events. CSV imports and phone calls have none, so this rule cannot run on them.
- Only checks the first agent turn after a failed tool event.
- Matches a short English phrase list and skips turns containing a negation word such as sorry or not.
- Cannot tell whether a later tool call succeeded.

### Agent talking over customer (`agent_talking_over_customer`)

Flags an agent turn that starts while the customer's previous turn was still going. Default: more than 500 ms of overlap. This rule was added later than the first four and has the least thought behind it.

- The 500 ms default is a guess, not a measured value.
- Only as accurate as the timestamps you supply. Speech-to-text timestamps can be rough, so normal turn-taking may look like an overlap.
- Only checks an agent turn that directly follows a customer turn. A customer interrupting the agent is not flagged.
- Cannot tell a short acknowledgement from talking over the customer.

### Customer repeated themselves (`customer_repeated_themselves`)

Flags a customer turn that says almost the same thing as the customer's previous turn, which can mean the agent missed it. Default: word overlap of 0.8.

- Compares only with the previous customer turn.
- Skips turns shorter than 3 words, so a repeat like yes please is not caught.
- Compares sets of words, so a rephrased repeat can score below the default and be missed.
- Splits text on spaces, so languages written without spaces are not handled.
- The customer may repeat themselves for other reasons, such as a bad line or a repeated question from the agent.

## Limits that apply to every rule

- **English only.** Every phrase list is English, hand-written and small. A language would be added only after a speaker of it had checked the phrases.
- **Timestamps.** A call without timestamps gets no latency or overlap findings, and the lanes view says it cannot draw it.
- **Saved findings are fixed at import.** Findings are computed when a call is imported and are stored with it. Changing a rule or a threshold later does not change findings that are already saved. To see a changed rule on an existing call, import it again under a new call id, or reseed with `--reset`, which also deletes review decisions.
- **The Try it page is separate.** It analyses without saving, and its threshold settings apply to that one request only. Imports always use the server's configured thresholds.
- **Inputs without tool events.** CSV imports cannot carry tool events, and phone calls have none, so the false-success rule cannot run on them.

## What VoiceLens does not claim

- That Zudu asked for it, uses it, or has any connection to it. It only draws on what Zudu shows publicly.
- That it touches Zudu's platform or any vendor's data format.
- That any rule is accurate. No rule has been measured against real calls.
- That the synthetic calls show how a real agent behaves.
