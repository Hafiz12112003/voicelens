from flask import jsonify
from werkzeug.exceptions import HTTPException


def api_error(code, message, details=None):
    body = {"code": code, "message": message}
    if details:
        body["details"] = details
    return jsonify({"error": body}), code


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http(e):
        return api_error(e.code, e.description)

    @app.errorhandler(Exception)
    def handle_unexpected(e):
        app.logger.exception("Unhandled error")
        return api_error(500, "Internal server error")
