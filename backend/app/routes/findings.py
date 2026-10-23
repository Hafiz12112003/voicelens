from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest

from app.errors import api_error
from app.extensions import db
from app.models import Finding
from app.serializers import serialize_finding

bp = Blueprint("findings", __name__, url_prefix="/api/v1")

VALID_STATUSES = {"open", "confirmed", "dismissed"}
ALLOWED_KEYS = {"status", "note"}
MAX_NOTE_LENGTH = 2000


@bp.patch("/findings/<int:finding_id>")
def update_finding(finding_id):
    finding = db.session.get(Finding, finding_id)
    if finding is None:
        return api_error(404, f"Finding {finding_id} not found")

    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not body:
        raise BadRequest("Body must be a JSON object with 'status' and/or 'note'")
    unknown = set(body) - ALLOWED_KEYS
    if unknown:
        raise BadRequest(f"Unknown field(s): {', '.join(sorted(unknown))}")

    new_status = finding.status
    new_note = finding.note

    if "status" in body:
        status = body["status"]
        if not isinstance(status, str) or status not in VALID_STATUSES:
            raise BadRequest("status must be one of: confirmed, dismissed, open")
        new_status = status

    if "note" in body:
        note = body["note"]
        if note is not None:
            if not isinstance(note, str):
                raise BadRequest("note must be text or null")
            note = note.strip()
            if len(note) > MAX_NOTE_LENGTH:
                raise BadRequest(f"note must be {MAX_NOTE_LENGTH} characters or fewer")
            note = note or None
        new_note = note

    finding.status = new_status
    finding.note = new_note
    db.session.commit()
    return jsonify(serialize_finding(finding))
