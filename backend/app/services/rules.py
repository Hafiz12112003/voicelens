import re

from app.services.lexicons import DEFAULT_LANGUAGE, LEXICONS

HIGH_LATENCY = "high_latency"
REPEATED_TURN = "repeated_agent_turn"
IGNORED_CONSTRAINT = "ignored_constraint"
FALSE_SUCCESS = "false_success_claim"

# Rule 3 only runs for agents whose name starts with one of these (see README for limits)
CONSTRAINT_AGENT_PREFIXES = ("restaurant", "hotel")


def _lexicon(lexicon):
    """The phrase lists to use. English unless the caller passes another."""
    return lexicon if lexicon is not None else LEXICONS[DEFAULT_LANGUAGE]


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


# ---------- Rule 3: ignored constraint ----------

def _quantities(text, lex):
    tokens = _plain(text).split()
    found = set()
    for pos, tok in enumerate(tokens):
        if tok.isdigit():
            n = int(tok)
        elif tok in lex["number_words"]:
            n = lex["number_words"][tok]
        else:
            continue
        if not 1 <= n <= 20:
            continue
        nxt = tokens[pos + 1] if pos + 1 < len(tokens) else ""
        if nxt in lex["non_quantity_followers"]:
            continue
        found.add(n)
    return found


def _negated(tokens, pos, lex):
    return pos > 0 and tokens[pos - 1] in lex["item_negators"]


def _wants_veg(c_tokens, lex):
    return any(
        tok in lex["veg_words"] and not (pos > 0 and c_tokens[pos - 1] == lex["non_word"])
        for pos, tok in enumerate(c_tokens)
    )


def _wants_non_smoking(c_tokens, lex):
    return any(
        tok == lex["smoking_word"] and pos > 0 and c_tokens[pos - 1] == lex["non_word"]
        for pos, tok in enumerate(c_tokens)
    )


def _excluded_items(c_tokens, lex):
    items = []
    for pos, tok in enumerate(c_tokens[:-1]):
        nxt = c_tokens[pos + 1]
        if (
            tok in lex["exclusion_words"]
            and nxt in lex["excludable_items"]
            and nxt not in items
        ):
            items.append(nxt)
    return items


def _contradictions(customer_text, agent_text, lex):
    c_tokens = _plain(customer_text).split()
    a_tokens = _plain(agent_text).split()
    results = []

    c_qty = _quantities(customer_text, lex)
    a_qty = _quantities(agent_text, lex)
    if c_qty and a_qty and not (c_qty & a_qty):
        results.append((
            "medium",
            f"customer quantity {sorted(c_qty)} vs agent quantity {sorted(a_qty)}",
            "The agent confirmed a different quantity than the customer asked for.",
        ))

    if _wants_veg(c_tokens, lex):
        for pos, tok in enumerate(a_tokens):
            if tok in lex["non_veg_items"] and not _negated(a_tokens, pos, lex):
                results.append((
                    "high",
                    f'customer asked for vegetarian; agent mentioned "{tok}"',
                    "The customer asked for vegetarian food but the agent's confirmation includes a non-vegetarian item.",
                ))
                break

    for item in _excluded_items(c_tokens, lex):
        if any(
            tok == item and not _negated(a_tokens, pos, lex)
            for pos, tok in enumerate(a_tokens)
        ):
            results.append((
                "high",
                f'customer said no "{item}"; agent mentioned "{item}"',
                f"The customer asked for no {item} but the agent's confirmation includes it.",
            ))

    if _wants_non_smoking(c_tokens, lex):
        if any(
            tok == lex["smoking_word"] and not _negated(a_tokens, pos, lex)
            for pos, tok in enumerate(a_tokens)
        ):
            results.append((
                "high",
                'customer asked for "non smoking"; agent mentioned "smoking"',
                "The customer asked for a non-smoking room but the agent confirmed a smoking one.",
            ))

    return results


def _next_confirmation(turns, pos, lex):
    """First agent turn with a confirmation cue after turns[pos], stopping at
    the next customer turn."""
    for turn in turns[pos + 1:]:
        if turn["speaker"] == "customer":
            return None
        if lex["confirmation_cues"] & set(_plain(turn["text"]).split()):
            return turn
    return None


def check_ignored_constraint(turns, agent_name, lexicon=None):
    """Restaurant and hotel agents only. Candidate findings, not verdicts."""
    if not agent_name or not agent_name.lower().startswith(CONSTRAINT_AGENT_PREFIXES):
        return []
    lex = _lexicon(lexicon)
    findings = []
    for pos, turn in enumerate(turns):
        if turn["speaker"] != "customer":
            continue
        confirmation = _next_confirmation(turns, pos, lex)
        if confirmation is None:
            continue
        for severity, detail, explanation in _contradictions(
            turn["text"], confirmation["text"], lex
        ):
            findings.append(
                _finding(
                    IGNORED_CONSTRAINT,
                    severity,
                    confirmation["i"],
                    f'customer (turn {turn["i"]}): "{turn["text"]}"; '
                    f'agent: "{confirmation["text"]}"; {detail}',
                    explanation,
                )
            )
    return findings


# ---------- Rule 4: false success claim ----------

def _claims_success(text, lex):
    plain = _plain(text)
    if set(plain.split()) & lex["negation_words"]:
        return None
    padded = f" {plain} "
    for phrase in lex["success_phrases"]:
        if f" {phrase} " in padded:
            return phrase
    return None


def check_false_success_claim(turns, tool_events, lexicon=None):
    """Flag the first agent turn after a failed tool event if it claims success.
    Only runs when tool_events is present."""
    if not tool_events:
        return []
    lex = _lexicon(lexicon)
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
        phrase = _claims_success(agent_turn["text"], lex)
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
