import re

HIGH_LATENCY = "high_latency"
REPEATED_TURN = "repeated_agent_turn"
FALSE_SUCCESS = "false_success_claim"

SUCCESS_PHRASES = ["booked", "confirmed", "done", "all set", "successfully"]
NEGATION_WORDS = {
    "not", "cannot", "cant", "couldnt", "wasnt", "didnt", "isnt", "hasnt",
    "unable", "failed", "unfortunately", "sorry",
}


def _finding(rule, severity, turn_index, evidence, explanation):
    return {
        "rule": rule,
        "severity": severity,
        "turn_index": turn_index,
        "evidence": evidence,
        "explanation": explanation,
    }


def response_gaps(turns):
    """Valid response turns only: (agent_turn_index, gap_ms) for each agent turn
    directly following a customer turn. Skips missing timestamps and negative
    gaps (overlap/interruption), which are not latency."""
    gaps = []
    for prev, cur in zip(turns, turns[1:]):
        if prev["speaker"] != "customer" or cur["speaker"] != "agent":
            continue
        end = prev.get("end_ms")
        start = cur.get("start_ms")
        if end is None or start is None:
            continue
        gap = start - end
        if gap < 0:
            continue
        gaps.append((cur["i"], gap))
    return gaps


def check_high_latency(turns, threshold_ms=1500, high_ms=3000):
    findings = []
    by_index = {t["i"]: t for t in turns}
    for turn_index, gap in response_gaps(turns):
        if gap <= threshold_ms:
            continue
        severity = "high" if gap > high_ms else "medium"
        agent = by_index[turn_index]
        customer_end = next(
            t["end_ms"] for t in turns if t["i"] == turn_index - 1
        )
        findings.append(
            _finding(
                HIGH_LATENCY,
                severity,
                turn_index,
                f"gap {gap} ms (customer ended at {customer_end} ms, "
                f"agent started at {agent['start_ms']} ms)",
                f"The agent took {gap / 1000:.1f} seconds to respond after the customer finished.",
            )
        )
    return findings


def normalize_text(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def jaccard(a_tokens, b_tokens):
    a, b = set(a_tokens), set(b_tokens)
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def check_repeated_agent_turn(turns, jaccard_threshold=0.8):
    """Compare each agent turn with the previous agent turn in the call."""
    findings = []
    prev_agent = None
    for turn in turns:
        if turn["speaker"] != "agent":
            continue
        norm = normalize_text(turn["text"])
        if prev_agent is not None and norm:
            prev_norm = prev_agent["norm"]
            if prev_norm:
                if norm == prev_norm:
                    similarity = 1.0
                else:
                    similarity = jaccard(norm.split(), prev_norm.split())
                if similarity >= jaccard_threshold:
                    findings.append(
                        _finding(
                            REPEATED_TURN,
                            "medium",
                            turn["i"],
                            f'"{turn["text"]}" repeats turn {prev_agent["i"]} '
                            f"(similarity {similarity:.2f})",
                            "The agent said almost the same thing again instead of moving the call forward.",
                        )
                    )
        prev_agent = {"i": turn["i"], "norm": norm}
    return findings


def _plain(text):
    """Lowercase, drop apostrophes (couldn't -> couldnt), strip punctuation."""
    text = text.lower().replace("\u2019", "").replace("'", "")
    return normalize_text(text)


def _claims_success(text):
    plain = _plain(text)
    if set(plain.split()) & NEGATION_WORDS:
        return None
    padded = f" {plain} "
    for phrase in SUCCESS_PHRASES:
        if f" {phrase} " in padded:
            return phrase
    return None


def check_false_success_claim(turns, tool_events):
    """Flag the first agent turn after a failed tool event if it claims success.
    Only runs when tool_events is present."""
    if not tool_events:
        return []
    findings = []
    flagged_turns = set()
    for event in tool_events:
        if event.get("status") != "failed":
            continue
        after = event["after_turn"]
        agent_turn = next(
            (t for t in turns if t["speaker"] == "agent" and t["i"] > after), None
        )
        if agent_turn is None or agent_turn["i"] in flagged_turns:
            continue
        phrase = _claims_success(agent_turn["text"])
        if phrase is None:
            continue
        flagged_turns.add(agent_turn["i"])
        findings.append(
            _finding(
                FALSE_SUCCESS,
                "high",
                agent_turn["i"],
                f'tool "{event["name"]}" failed after turn {after}; '
                f'agent said "{agent_turn["text"]}" (matched "{phrase}")',
                "The agent claimed success right after a tool call failed, so the customer may believe something happened that did not.",
            )
        )
    return findings
