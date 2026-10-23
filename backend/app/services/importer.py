import csv
import io
from datetime import datetime, timezone

from flask import current_app

from app.extensions import db
from app.models import Call, Finding, ToolEvent, Turn
from app.services import rules

VALID_SOURCES = {"real", "synthetic"}
VALID_SPEAKERS = {"agent", "customer"}
VALID_TOOL_STATUSES = {"ok", "failed"}
CSV_REQUIRED = ["call_id", "agent", "source", "i", "speaker", "text"]


class TranscriptError(Exception):
    """Raised when an import payload is invalid. Carries every error found."""

    def __init__(self, errors):
        super().__init__("; ".join(errors))
        self.errors = errors


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _is_text(value):
    return isinstance(value, str) and value.strip() != ""


def _parse_dt(value):
    """ISO 8601 -> naive UTC datetime, or None if it cannot be parsed."""
    try:
        dt = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def validate_call(obj, position=0):
    """Return a list of error strings (empty list means valid)."""
    if not isinstance(obj, dict):
        return [f"call[{position}]: must be an object"]

    cid = obj.get("call_id")
    label = cid if _is_text(cid) else f"call[{position}]"
    errors = []

    def err(message):
        errors.append(f"{label}: {message}")

    if not _is_text(cid):
        err("call_id is required")
    if not _is_text(obj.get("agent")):
        err("agent is required")
    if obj.get("source") not in VALID_SOURCES:
        err("source must be 'real' or 'synthetic'")
    if obj.get("started_at") is not None and _parse_dt(obj["started_at"]) is None:
        err("started_at must be an ISO 8601 date-time")
    if obj.get("outcome") is not None and not isinstance(obj["outcome"], str):
        err("outcome must be text")

    turns = obj.get("turns")
    if not isinstance(turns, list) or not turns:
        err("turns must be a non-empty list")
        turns = []

    for pos, turn in enumerate(turns):
        p = f"turns[{pos}]"
        if not isinstance(turn, dict):
            err(f"{p} must be an object")
            continue
        if not _is_int(turn.get("i")) or turn["i"] != pos:
            err(f"{p}.i must be {pos} (turns are numbered 0, 1, 2... in order)")
        if turn.get("speaker") not in VALID_SPEAKERS:
            err(f"{p}.speaker must be 'agent' or 'customer'")
        if not _is_text(turn.get("text")):
            err(f"{p}.text must be non-empty text")
        for key in ("start_ms", "end_ms"):
            value = turn.get(key)
            if value is not None and (not _is_int(value) or value < 0):
                err(f"{p}.{key} must be a whole number of milliseconds, 0 or more")
        start, end = turn.get("start_ms"), turn.get("end_ms")
        if _is_int(start) and _is_int(end) and end < start:
            err(f"{p}.end_ms must not be before start_ms")

    events = obj.get("tool_events")
    if events is not None:
        if not isinstance(events, list):
            err("tool_events must be a list")
        else:
            for pos, event in enumerate(events):
                p = f"tool_events[{pos}]"
                if not isinstance(event, dict):
                    err(f"{p} must be an object")
                    continue
                after = event.get("after_turn")
                if not _is_int(after) or not 0 <= after < max(len(turns), 1):
                    err(f"{p}.after_turn must be a turn number between 0 and {max(len(turns) - 1, 0)}")
                if not _is_text(event.get("name")):
                    err(f"{p}.name is required")
                if event.get("status") not in VALID_TOOL_STATUSES:
                    err(f"{p}.status must be 'ok' or 'failed'")

    return errors


def analyze_call(turns, agent, tool_events=None, threshold_ms=1500, high_ms=3000):
    """Run all four rules. Returns finding dicts sorted by turn, then rule."""
    findings = []
    findings += rules.check_high_latency(turns, threshold_ms, high_ms)
    findings += rules.check_repeated_agent_turn(turns)
    findings += rules.check_ignored_constraint(turns, agent)
    findings += rules.check_false_success_claim(turns, tool_events)
    return sorted(findings, key=lambda f: (f["turn_index"], f["rule"]))


def import_calls(payload):
    """Validate everything first, then save. Nothing is saved if anything is invalid."""
    if isinstance(payload, dict):
        payload = [payload]
    if not isinstance(payload, list) or not payload:
        raise TranscriptError(
            ["payload must be a call object or a non-empty list of calls"]
        )

    errors = []
    for pos, obj in enumerate(payload):
        errors.extend(validate_call(obj, pos))
    if errors:
        raise TranscriptError(errors)

    cfg = current_app.config
    existing = {row[0] for row in db.session.query(Call.external_id).all()}
    imported, skipped, finding_count = [], [], 0

    try:
        for obj in payload:
            cid = obj["call_id"].strip()
            if cid in existing:
                skipped.append(cid)
                continue
            existing.add(cid)

            agent = obj["agent"].strip()
            turns = obj["turns"]
            tool_events = obj.get("tool_events") or []
            ends = [t["end_ms"] for t in turns if t.get("end_ms") is not None]

            call = Call(
                external_id=cid,
                agent=agent,
                source=obj["source"],
                started_at=_parse_dt(obj["started_at"]) if obj.get("started_at") else None,
                duration_ms=max(ends) if ends else None,
                outcome=obj.get("outcome"),
            )
            for t in turns:
                call.turns.append(
                    Turn(
                        idx=t["i"],
                        speaker=t["speaker"],
                        text=t["text"],
                        start_ms=t.get("start_ms"),
                        end_ms=t.get("end_ms"),
                    )
                )
            for e in tool_events:
                call.tool_events.append(
                    ToolEvent(after_turn=e["after_turn"], name=e["name"], status=e["status"])
                )
            for f in analyze_call(
                turns,
                agent,
                tool_events,
                cfg["LATENCY_THRESHOLD_MS"],
                cfg["LATENCY_HIGH_MS"],
            ):
                call.findings.append(
                    Finding(
                        turn_idx=f["turn_index"],
                        rule=f["rule"],
                        severity=f["severity"],
                        evidence=f["evidence"],
                        explanation=f["explanation"],
                        status="open",
                    )
                )
                finding_count += 1
            db.session.add(call)
            imported.append(cid)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return {"imported": imported, "skipped": skipped, "findings": finding_count}


def parse_csv(text):
    """One row per turn -> list of call dicts. Decode uploads with utf-8-sig
    so an Excel byte-order mark does not corrupt the first column name."""
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in CSV_REQUIRED if c not in (reader.fieldnames or [])]
    if missing:
        raise TranscriptError([f"CSV is missing columns: {', '.join(missing)}"])

    def to_int(value, row_no, column):
        value = (value or "").strip()
        if value == "":
            return None
        try:
            return int(value)
        except ValueError:
            raise TranscriptError([f"CSV row {row_no}: {column} must be a whole number"])

    calls = {}
    for row_no, row in enumerate(reader, start=2):
        cid = (row.get("call_id") or "").strip()
        call = calls.setdefault(
            cid,
            {
                "call_id": cid,
                "agent": (row.get("agent") or "").strip(),
                "source": (row.get("source") or "").strip().lower(),
                "started_at": (row.get("started_at") or "").strip() or None,
                "outcome": (row.get("outcome") or "").strip() or None,
                "turns": [],
            },
        )
        call["turns"].append(
            {
                "i": to_int(row.get("i"), row_no, "i"),
                "speaker": (row.get("speaker") or "").strip().lower(),
                "text": row.get("text") or "",
                "start_ms": to_int(row.get("start_ms"), row_no, "start_ms"),
                "end_ms": to_int(row.get("end_ms"), row_no, "end_ms"),
            }
        )
    return list(calls.values())
