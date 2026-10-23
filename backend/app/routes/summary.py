from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import BadRequest

from app.extensions import db
from app.models import Call, Finding, Label
from app.services import rules
from app.services.metrics import accuracy_report, build_summary

bp = Blueprint("summary", __name__, url_prefix="/api/v1")

VALID_SCOPES = {"real", "synthetic", "all"}
ACCURACY_BASIS = (
    "Real demo calls only, hand-labeled, small sample. "
    "Synthetic calls are never included."
)


@bp.get("/summary")
def get_summary():
    source = (request.args.get("source") or "real").strip()
    if source not in VALID_SCOPES:
        raise BadRequest("source must be one of: all, real, synthetic")

    query = Call.query.options(selectinload(Call.turns), selectinload(Call.findings))
    if source != "all":
        query = query.filter(Call.source == source)

    rows = []
    for call in query.all():
        turns = [
            {"i": t.idx, "speaker": t.speaker, "start_ms": t.start_ms, "end_ms": t.end_ms}
            for t in call.turns
        ]
        rows.append(
            {
                "outcome": call.outcome,
                "day": call.started_at.date().isoformat() if call.started_at else None,
                "gaps": [gap for _, gap in rules.response_gaps(turns)],
                "findings": [
                    {"rule": f.rule, "severity": f.severity, "status": f.status}
                    for f in call.findings
                ],
            }
        )

    counts = {"real": 0, "synthetic": 0}
    counts.update(
        dict(db.session.query(Call.source, func.count(Call.id)).group_by(Call.source).all())
    )

    label_rows = (
        db.session.query(Call.external_id, Label.turn_idx, Label.rule, Label.is_real_issue)
        .join(Label, Label.call_id == Call.id)
        .filter(Call.source == "real")
        .order_by(Label.id)
        .all()
    )
    predicted = {
        (cid, turn_idx, rule)
        for cid, turn_idx, rule in db.session.query(
            Call.external_id, Finding.turn_idx, Finding.rule
        )
        .join(Finding, Finding.call_id == Call.id)
        .filter(Call.source == "real")
        .all()
    }
    accuracy = accuracy_report(predicted, label_rows)
    accuracy["status"] = "ok" if accuracy["n_items"] else "no_labels"
    accuracy["basis"] = ACCURACY_BASIS

    summary = build_summary(rows)
    summary["scope"] = {"source": source, "calls_by_source": counts}
    summary["accuracy"] = accuracy
    return jsonify(summary)
