from flask import Flask
from flask_cors import CORS

from config import Config

from app.errors import register_error_handlers
from app.extensions import db


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.setdefault("MAX_CONTENT_LENGTH", 5 * 1024 * 1024)
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    register_error_handlers(app)

    from app import models  # noqa: F401  (registers tables)
    from app.routes import calls, findings, health, imports

    for module in (health, imports, calls, findings):
        app.register_blueprint(module.bp)

    with app.app_context():
        db.create_all()

    return app
