from flask import Blueprint, current_app, jsonify

bp = Blueprint("mode", __name__, url_prefix="/api/v1")


@bp.get("/mode")
def get_mode():
    return jsonify({"read_only": bool(current_app.config.get("READ_ONLY"))})
