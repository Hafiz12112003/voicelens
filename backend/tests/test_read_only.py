import pytest

from app import create_app
from app.extensions import db
from app.models import Finding
from app.services.importer import import_calls
from config import env_flag
from tests.test_api import A


@pytest.fixture()
def read_only_app():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "READ_ONLY": True}
    )
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


def test_mode_endpoint_reports_the_switch(client, read_only_app):
    assert client.get("/api/v1/mode").get_json() == {"read_only": False}
    assert read_only_app.test_client().get("/api/v1/mode").get_json() == {"read_only": True}


def test_read_only_blocks_import(read_only_app):
    client = read_only_app.test_client()
    res = client.post("/api/v1/import", json=A)
    assert res.status_code == 403
    error = res.get_json()["error"]
    assert error["code"] == 403
    assert "read-only" in error["message"]
    assert client.get("/api/v1/calls").get_json()["total"] == 0


def test_read_only_blocks_finding_review(read_only_app):
    with read_only_app.app_context():
        import_calls([A])
        finding_id = Finding.query.first().id
    client = read_only_app.test_client()
    res = client.patch(f"/api/v1/findings/{finding_id}", json={"status": "confirmed"})
    assert res.status_code == 403
    detail = client.get("/api/v1/calls/restaurant-001").get_json()
    assert {f["status"] for f in detail["findings"]} == {"open"}


def test_read_only_keeps_reads_and_analyze_working(read_only_app):
    with read_only_app.app_context():
        import_calls([A])
    client = read_only_app.test_client()
    for path in (
        "/api/v1/health",
        "/api/v1/calls",
        "/api/v1/calls/restaurant-001",
        "/api/v1/summary?source=all",
        "/api/v1/rules",
    ):
        assert client.get(path).status_code == 200, path
    res = client.post("/api/v1/analyze", json=A)
    assert res.status_code == 200
    assert res.get_json()["stats"]["finding_count"] == 3


def test_read_only_lets_cors_preflight_through(read_only_app):
    client = read_only_app.test_client()
    origin = read_only_app.config["CORS_ORIGINS"][0]
    for path in ("/api/v1/analyze", "/api/v1/import"):
        res = client.options(
            path,
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert res.status_code == 200, path
        assert res.headers.get("Access-Control-Allow-Origin") == origin, path


def test_env_flag_reads_common_true_values(monkeypatch):
    monkeypatch.delenv("VL_TEST_FLAG", raising=False)
    assert env_flag("VL_TEST_FLAG") is False
    assert env_flag("VL_TEST_FLAG", default=True) is True
    for value in ("1", "true", "TRUE", " yes ", "on"):
        monkeypatch.setenv("VL_TEST_FLAG", value)
        assert env_flag("VL_TEST_FLAG") is True, value
    for value in ("0", "false", "no", "off", "", "maybe"):
        monkeypatch.setenv("VL_TEST_FLAG", value)
        assert env_flag("VL_TEST_FLAG") is False, value
