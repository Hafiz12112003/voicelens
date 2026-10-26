from flask import Blueprint, current_app, jsonify

from app.services.lexicons import available_languages
from app.services.registry import rule_catalog

bp = Blueprint("catalog", __name__, url_prefix="/api/v1")


@bp.get("/rules")
def list_rules():
    return jsonify(
        {
            "rules": rule_catalog(current_app.config),
            "languages": available_languages(),
        }
    )
