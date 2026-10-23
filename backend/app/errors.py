from flask import jsonify
from werkzeug.exceptions import HTTPException


def _error(code, message):
    return jsonify({"error": {"code": code, "message": message}}), code


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http(e):
        return _error(e.code, e.description)

    @app.errorhandler(Exception)
    def handle_unexpected(e):
        app.logger.exception("Unhandled error")
        return _error(500, "Internal server error")
