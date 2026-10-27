from flask import Flask, request
from flask_cors import CORS

from config import Config

from app.errors import api_error, register_error_handlers
from app.extensions import db

READ_ONLY_MESSAGE = (
    "This deployment is read-only: importing calls and reviewing findings are turned off."
)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# The one write that stays open when read-only: it analyses a call and stores nothing.
READ_ONLY_ALLOWED = {("POST", "/api/v1/analyze")}


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.setdefault("MAX_CONTENT_LENGTH", 5 * 1024 * 1024)
    app.config.setdefault("ANALYZE_MAX_BYTES", 256 * 1024)
    app.config.setdefault("ANALYZE_MAX_TURNS", 500)
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    register_error_handlers(app)

    @app.before_request
    def block_writes_when_read_only():
        if not app.config.get("READ_ONLY"):
            return None
        if request.method in SAFE_METHODS or (request.method, request.path) in READ_ONLY_ALLOWED:
            return None
        return api_error(403, READ_ONLY_MESSAGE)

    from app import models  # noqa: F401  (registers tables)
    from app.routes import analyze, calls, catalog, findings, health, imports, mode, summary

    for module in (health, mode, imports, analyze, catalog, calls, findings, summary):
        app.register_blueprint(module.bp)

    with app.app_context():
        db.create_all()

    return app
