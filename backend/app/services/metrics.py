from app.services.registry import RULE_IDS

RULE_ORDER = list(RULE_IDS)
STATUSES = ("open", "confirmed", "dismissed")
DAILY_LIMIT = 30


def percentile(values, pct):
    """Nearest-rank percentile (pct is a whole number 1-100).
    Returns None for an empty list."""
    if not values:
        return None
    ordered = sorted(values)
    rank = (pct * len(ordered) + 99) // 100  # ceil(pct * n / 100) in integer math
    return ordered[max(rank, 1) - 1]


def latency_stats(gaps_ms):
    """Stats over valid response turns only. With no measurable turns every
    value is None (never 0), so empty calls are excluded, not averaged in."""
    values = [g for g in gaps_ms if g is not None]
    if not values:
        return {"count": 0, "avg_ms": None, "p95_ms": None, "max_ms": None}
    return {
        "count": len(values),
        "avg_ms": int(round(sum(values) / len(values))),
        "p95_ms": percentile(values, 95),
        "max_ms": max(values),
    }


def review_status(total_findings, open_findings):
    if total_findings == 0:
        return "clean"
    if open_findings == total_findings:
        return "unreviewed"
    if open_findings == 0:
        return "reviewed"
    return "in_review"


def _ratio(numerator, denominator):
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def _new_rule_row(rule):
    return {"rule": rule, "total": 0, "open": 0, "confirmed": 0, "dismissed": 0}


def build_summary(call_rows):
    """call_rows: one dict per call with keys outcome, day (ISO date or None),
    gaps (valid response gaps in ms) and findings (rule, severity, status)."""
    status_counts = {s: 0 for s in STATUSES}
    per_rule = {rule: _new_rule_row(rule) for rule in RULE_ORDER}
    all_gaps = []
    calls_with_latency = 0
    failed_calls = 0
    escalated_calls = 0
    total_findings = 0
    daily = {}

    for row in call_rows:
        gaps = row["gaps"]
        all_gaps.extend(gaps)
        if gaps:
            calls_with_latency += 1
        if (row.get("outcome") or "").lower() == "escalated":
            escalated_calls += 1

        has_confirmed_high = False
        for f in row["findings"]:
            total_findings += 1
            status_counts[f["status"]] += 1
            bucket = per_rule.setdefault(f["rule"], _new_rule_row(f["rule"]))
            bucket["total"] += 1
            bucket[f["status"]] += 1
            if f["status"] == "confirmed" and f["severity"] == "high":
                has_confirmed_high = True
        if has_confirmed_high:
            failed_calls += 1

        day = row.get("day")
        if day:
            d = daily.setdefault(day, {"calls": 0, "findings": 0, "gaps": []})
            d["calls"] += 1
            d["findings"] += len(row["findings"])
            d["gaps"].extend(gaps)

    n_calls = len(call_rows)
    daily_rows = [
        {
            "date": day,
            "calls": d["calls"],
            "findings": d["findings"],
            "avg_latency_ms": latency_stats(d["gaps"])["avg_ms"],
        }
        for day, d in sorted(daily.items())
    ][-DAILY_LIMIT:]

    return {
        "calls_analysed": n_calls,
        "findings": {
            "total": total_findings,
            "open": status_counts["open"],
            "confirmed": status_counts["confirmed"],
            "dismissed": status_counts["dismissed"],
        },
        "failure": {
            "calls_with_confirmed_high": failed_calls,
            "rate": _ratio(failed_calls, n_calls),
        },
        "latency": latency_stats(all_gaps),
        "calls_with_latency": calls_with_latency,
        "escalated_calls": escalated_calls,
        "per_rule": list(per_rule.values()),
        "daily": daily_rows,
    }


def accuracy_report(predicted, labels):
    """predicted: set of (call_id, turn_idx, rule) the rules flagged.
    labels: iterable of (call_id, turn_idx, rule, is_real_issue), hand-labeled.
    A repeated label for the same item counts once (the first one wins)."""
    cells = {rule: {"tp": 0, "fp": 0, "fn": 0, "tn": 0} for rule in RULE_ORDER}
    errors = []
    seen = set()
    labeled_calls = set()

    for call_id, turn_idx, rule, is_real in labels:
        key = (call_id, turn_idx, rule)
        if key in seen or rule not in cells:
            continue
        seen.add(key)
        labeled_calls.add(call_id)
        flagged = key in predicted
        if flagged and is_real:
            cells[rule]["tp"] += 1
        elif flagged:
            cells[rule]["fp"] += 1
            errors.append((call_id, turn_idx, rule, "false_positive"))
        elif is_real:
            cells[rule]["fn"] += 1
            errors.append((call_id, turn_idx, rule, "false_negative"))
        else:
            cells[rule]["tn"] += 1

    per_rule = []
    for rule in RULE_ORDER:
        c = cells[rule]
        per_rule.append(
            {
                "rule": rule,
                "items": c["tp"] + c["fp"] + c["fn"] + c["tn"],
                "tp": c["tp"],
                "fp": c["fp"],
                "fn": c["fn"],
                "tn": c["tn"],
                "precision": _ratio(c["tp"], c["tp"] + c["fp"]),
                "recall": _ratio(c["tp"], c["tp"] + c["fn"]),
            }
        )

    return {
        "n_items": len(seen),
        "labeled_calls": len(labeled_calls),
        "per_rule": per_rule,
        "errors": [
            {"call_id": cid, "turn_index": turn, "rule": rule, "kind": kind}
            for cid, turn, rule, kind in sorted(errors)
        ],
    }
