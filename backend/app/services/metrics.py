import math


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
