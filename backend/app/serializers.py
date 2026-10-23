SEVERITY_BY_RANK = {3: "high", 2: "medium", 1: "low"}


def iso(dt):
    """Datetimes are stored as naive UTC."""
    return dt.isoformat() + "Z" if dt else None


def serialize_finding(finding):
    return {
        "id": finding.id,
        "call_id": finding.call.external_id,
        "turn_index": finding.turn_idx,
        "rule": finding.rule,
        "severity": finding.severity,
        "evidence": finding.evidence,
        "explanation": finding.explanation,
        "status": finding.status,
        "note": finding.note,
    }
