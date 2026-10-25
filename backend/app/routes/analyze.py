import json

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest

from app.errors import api_error
from app.services.analyzer import analyze_payload
from app.services.importer import TranscriptError

bp = Blueprint("analyze", __name__, url_prefix="/api/v1")


@bp.post("/analyze")
def analyze():
    cfg = current_app.config
    cap = cfg["ANALYZE_MAX_BYTES"]
    raw = request.get_data()
    if len(raw) > cap:
        return api_error(413, f"Payload too large: the limit is {cap // 1024} KB")
    try:
        payload = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise BadRequest("Send a JSON body containing one call object")

    try:
        result = analyze_payload(
            payload,
            cfg["LATENCY_THRESHOLD_MS"],
            cfg["LATENCY_HIGH_MS"],
            cfg["ANALYZE_MAX_TURNS"],
        )
    except TranscriptError as exc:
        return api_error(
            422,
            f"Invalid transcript: {len(exc.errors)} problem(s) found, nothing was analysed",
            exc.errors[:50],
        )
    return jsonify(result), 200
