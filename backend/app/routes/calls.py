import math

from flask import Blueprint, jsonify, request
from sqlalchemy import case, func, or_
from werkzeug.exceptions import BadRequest

from app.errors import api_error
from app.extensions import db
from app.models import Call, Finding, Turn
from app.serializers import SEVERITY_BY_RANK, iso, serialize_finding
from app.services import rules
from app.services.metrics import latency_stats, review_status

bp = Blueprint("calls", __name__, url_prefix="/api/v1")

VALID_SOURCES = {"real", "synthetic"}
VALID_SEVERITIES = {"high", "medium", "low"}
VALID_SORTS = {"call_id", "agent", "source", "duration", "findings", "severity", "started_at"}
VALID_ORDERS = {"asc", "desc"}


def _int_param(name, default, minimum, maximum=None):
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except ValueError:
        raise BadRequest(f"{name} must be a whole number")
    if value < minimum or (maximum is not None and value > maximum):
        limit = f"between {minimum} and {maximum}" if maximum else f"at least {minimum}"
        raise BadRequest(f"{name} must be {limit}")
    return value


def _choice_param(name, default, allowed):
    value = (request.args.get(name) or "").strip() or default
    if value is not None and value not in allowed:
        raise BadRequest(f"{name} must be one of: {', '.join(sorted(allowed))}")
    return value


@bp.get("/calls")
def list_calls():
    q = (request.args.get("q") or "").strip()
    agent = (request.args.get("agent") or "").strip()
    source = _choice_param("source", None, VALID_SOURCES)
    severity = _choice_param("severity", None, VALID_SEVERITIES)
    sort = _choice_param("sort", "started_at", VALID_SORTS)
    order = _choice_param("order", "desc", VALID_ORDERS)
    page = _int_param("page", 1, 1)
    page_size = _int_param("page_size", 20, 1, 100)

    sev_rank = case(
        (Finding.severity == "high", 3),
        (Finding.severity == "medium", 2),
        else_=1,
    )
    agg = (
        db.session.query(
            Finding.call_id.label("call_id"),
            func.count(Finding.id).label("n"),
            func.max(sev_rank).label("max_sev"),
            func.sum(case((Finding.status == "open", 1), else_=0)).label("open_n"),
        )
        .group_by(Finding.call_id)
        .subquery()
    )
    findings_n = func.coalesce(agg.c.n, 0)
    max_sev = func.coalesce(agg.c.max_sev, 0)
    open_n = func.coalesce(agg.c.open_n, 0)

    filters = []
    if agent:
        filters.append(Call.agent == agent)
    if source:
        filters.append(Call.source == source)
    if severity:
        filters.append(Call.findings.any(Finding.severity == severity))
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        filters.append(
            or_(
                Call.external_id.ilike(pattern, escape="\\"),
                Call.turns.any(Turn.text.ilike(pattern, escape="\\")),
            )
        )

    total = db.session.query(func.count(Call.id)).filter(*filters).scalar()

    sort_columns = {
        "call_id": Call.external_id,
        "agent": Call.agent,
        "source": Call.source,
        "duration": Call.duration_ms,
        "findings": findings_n,
        "severity": max_sev,
        "started_at": Call.started_at,
    }
    column = sort_columns[sort]
    ordering = column.desc() if order == "desc" else column.asc()

    rows = (
        db.session.query(Call, findings_n, max_sev, open_n)
        .outerjoin(agg, agg.c.call_id == Call.id)
        .filter(*filters)
        .order_by(ordering, Call.external_id.asc())
        .limit(page_size)
        .offset((page - 1) * page_size)
        .all()
    )

    items = [
        {
            "call_id": call.external_id,
            "agent": call.agent,
            "source": call.source,
            "started_at": iso(call.started_at),
            "duration_ms": call.duration_ms,
            "outcome": call.outcome,
            "findings_count": n,
            "max_severity": SEVERITY_BY_RANK.get(rank),
            "review_status": review_status(n, open_count),
        }
        for call, n, rank, open_count in rows
    ]
    return jsonify(
        {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        }
    )


@bp.get("/calls/<external_id>")
def get_call(external_id):
    call = Call.query.filter_by(external_id=external_id).first()
    if call is None:
        return api_error(404, f"Call '{external_id}' not found")

    turns = [
        {
            "i": t.idx,
            "speaker": t.speaker,
            "text": t.text,
            "start_ms": t.start_ms,
            "end_ms": t.end_ms,
        }
        for t in call.turns
    ]
    gaps = dict(rules.response_gaps(turns))
    for turn in turns:
        turn["latency_ms"] = gaps.get(turn["i"])

    findings = sorted(call.findings, key=lambda f: (f.turn_idx, f.id))
    open_count = sum(1 for f in findings if f.status == "open")
    latency = latency_stats(list(gaps.values()))

    return jsonify(
        {
            "call_id": call.external_id,
            "agent": call.agent,
            "source": call.source,
            "started_at": iso(call.started_at),
            "outcome": call.outcome,
            "review_status": review_status(len(findings), open_count),
            "stats": {
                "duration_ms": call.duration_ms,
                "turn_count": len(turns),
                "finding_count": len(findings),
                "response_count": latency["count"],
                "avg_latency_ms": latency["avg_ms"],
                "max_latency_ms": latency["max_ms"],
            },
            "turns": turns,
            "tool_events": [
                {"after_turn": e.after_turn, "name": e.name, "status": e.status}
                for e in call.tool_events
            ],
            "findings": [serialize_finding(f) for f in findings],
        }
    )
