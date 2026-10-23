import json

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest

from app.errors import api_error
from app.services.importer import TranscriptError, import_calls, parse_csv

bp = Blueprint("imports", __name__, url_prefix="/api/v1")


def _read_payload():
    upload = request.files.get("file")
    if upload is not None:
        try:
            text = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            raise BadRequest("File must be UTF-8 text")
        if (upload.filename or "").lower().endswith(".csv"):
            return parse_csv(text)
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise BadRequest(f"File is not valid JSON: {exc.msg} (line {exc.lineno})")
    payload = request.get_json(silent=True)
    if payload is None:
        raise BadRequest(
            "Send a JSON body, or upload a .json or .csv file in the 'file' field"
        )
    return payload


@bp.post("/import")
def import_transcripts():
    try:
        result = import_calls(_read_payload())
    except TranscriptError as exc:
        return api_error(
            422,
            f"Invalid transcript: {len(exc.errors)} problem(s) found, nothing was imported",
            exc.errors[:50],
        )
    return jsonify(result), (201 if result["imported"] else 200)
