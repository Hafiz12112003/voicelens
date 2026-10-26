from app.services import rules
from app.services.importer import (
    TranscriptError,
    _parse_dt,
    analyze_call,
    validate_call,
)
from app.services.metrics import latency_stats
from app.services.registry import resolve_settings


def analyze_payload(obj, config):
    """Stateless analysis of one call. Validates, runs the rules with the
    request's optional settings, returns a call-detail-shaped dict. Saves
    nothing. Raises TranscriptError."""
    if not isinstance(obj, dict):
        raise TranscriptError(["body must be a single call object"])

    max_turns = config["ANALYZE_MAX_TURNS"]
    raw_turns = obj.get("turns")
    if isinstance(raw_turns, list) and len(raw_turns) > max_turns:
        raise TranscriptError(
            [f"turns: at most {max_turns} turns are allowed, got {len(raw_turns)}"]
        )

    errors = validate_call(obj)
    settings, setting_errors = resolve_settings(config, obj.get("settings"))
    errors = errors + setting_errors
    if errors:
        raise TranscriptError(errors)

    cid = obj["call_id"].strip()
    agent = obj["agent"].strip()
    turns = obj["turns"]
    tool_events = obj.get("tool_events") or []

    found = analyze_call(
        turns,
        agent,
        tool_events,
        settings["threshold_ms"],
        settings["high_ms"],
        settings["jaccard_threshold"],
        settings["overlap_ms"],
        settings["customer_jaccard_threshold"],
    )

    gaps = dict(rules.response_gaps(turns))
    out_turns = [
        {
            "i": t["i"],
            "speaker": t["speaker"],
            "text": t["text"],
            "start_ms": t.get("start_ms"),
            "end_ms": t.get("end_ms"),
            "latency_ms": gaps.get(t["i"]),
        }
        for t in turns
    ]
    latency = latency_stats(list(gaps.values()))
    ends = [t["end_ms"] for t in turns if t.get("end_ms") is not None]
    started = _parse_dt(obj["started_at"]) if obj.get("started_at") else None

    findings = [
        {
            "id": n,
            "call_id": cid,
            "turn_index": f["turn_index"],
            "rule": f["rule"],
            "severity": f["severity"],
            "evidence": f["evidence"],
            "explanation": f["explanation"],
            "status": "open",
            "note": None,
        }
        for n, f in enumerate(found, start=1)
    ]

    return {
        "call_id": cid,
        "agent": agent,
        "source": obj["source"],
        "started_at": started.isoformat() + "Z" if started else None,
        "outcome": obj.get("outcome"),
        "settings": settings,
        "stats": {
            "duration_ms": max(ends) if ends else None,
            "turn_count": len(turns),
            "finding_count": len(findings),
            "response_count": latency["count"],
            "avg_latency_ms": latency["avg_ms"],
            "max_latency_ms": latency["max_ms"],
        },
        "turns": out_turns,
        "tool_events": [
            {"after_turn": e["after_turn"], "name": e["name"], "status": e["status"]}
            for e in tool_events
        ],
        "findings": findings,
    }
