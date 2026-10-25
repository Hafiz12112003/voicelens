import pytest

from app import create_app
from app.extensions import db
from app.models import Call, Finding


def make_call(**overrides):
    call = {
        "call_id": "wb-1",
        "agent": "support",
        "source": "synthetic",
        "turns": [
            {"i": 0, "speaker": "agent", "text": "Hello, how can I help you today?", "start_ms": 0, "end_ms": 2000},
            {"i": 1, "speaker": "customer", "text": "I need a table for four please", "start_ms": 2500, "end_ms": 4500},
            {"i": 2, "speaker": "agent", "text": "Sure, one moment", "start_ms": 9000, "end_ms": 10000},
            {"i": 3, "speaker": "customer", "text": "Okay", "start_ms": 10200, "end_ms": 10500},
            {"i": 4, "speaker": "agent", "text": "Sure, one moment", "start_ms": 10600, "end_ms": 11500},
        ],
    }
    call.update(overrides)
    return call


@pytest.fixture()
def make_client():
    apps = []

    def _make(**cfg):
        app = create_app(
            {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", **cfg}
        )
        apps.append(app)
        return app.test_client()

    yield _make
    for app in apps:
        with app.app_context():
            db.session.remove()
            db.drop_all()


def test_analyze_returns_findings_stats_and_latency(client):
    res = client.post("/api/v1/analyze", json=make_call())
    assert res.status_code == 200
    body = res.get_json()

    assert "review_status" not in body
    assert body["call_id"] == "wb-1"
    assert body["agent"] == "support"
    assert body["source"] == "synthetic"

    findings = body["findings"]
    assert [(f["turn_index"], f["rule"], f["severity"]) for f in findings] == [
        (2, "high_latency", "high"),
        (4, "repeated_agent_turn", "medium"),
    ]
    assert [f["id"] for f in findings] == [1, 2]
    assert all(f["status"] == "open" and f["note"] is None for f in findings)
    assert all(f["call_id"] == "wb-1" for f in findings)

    stats = body["stats"]
    assert stats["turn_count"] == 5
    assert stats["finding_count"] == 2
    assert stats["response_count"] == 2
    assert stats["avg_latency_ms"] == 2300
    assert stats["max_latency_ms"] == 4500
    assert stats["duration_ms"] == 11500

    turns = body["turns"]
    assert turns[0]["latency_ms"] is None
    assert turns[2]["latency_ms"] == 4500
    assert turns[4]["latency_ms"] == 100


def test_analyze_stores_nothing(app, client):
    res = client.post("/api/v1/analyze", json=make_call())
    assert res.status_code == 200
    with app.app_context():
        assert Call.query.count() == 0
        assert Finding.query.count() == 0


def test_analyze_false_success_claim_uses_tool_events(client):
    payload = {
        "call_id": "wb-2",
        "agent": "support",
        "source": "synthetic",
        "turns": [
            {"i": 0, "speaker": "customer", "text": "Please book it"},
            {"i": 1, "speaker": "agent", "text": "Booked, all set."},
        ],
        "tool_events": [{"after_turn": 0, "name": "book", "status": "failed"}],
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    body = res.get_json()
    assert [(f["turn_index"], f["rule"], f["severity"]) for f in body["findings"]] == [
        (1, "false_success_claim", "high")
    ]
    assert body["tool_events"] == [{"after_turn": 0, "name": "book", "status": "failed"}]
    assert body["stats"]["response_count"] == 0
    assert body["stats"]["avg_latency_ms"] is None
    assert body["stats"]["duration_ms"] is None


def test_analyze_invalid_call_returns_422_with_details(client):
    payload = {
        "call_id": "x",
        "source": "synthetic",
        "turns": [{"i": 0, "speaker": "robot", "text": "hi"}],
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 422
    error = res.get_json()["error"]
    assert error["code"] == 422
    assert "nothing was analysed" in error["message"]
    assert any("agent is required" in d for d in error["details"])
    assert any("speaker" in d for d in error["details"])


def test_analyze_rejects_non_object_body(client):
    res = client.post("/api/v1/analyze", json=[])
    assert res.status_code == 422
    assert "single call object" in res.get_json()["error"]["details"][0]


def test_analyze_rejects_invalid_json(client):
    res = client.post(
        "/api/v1/analyze", data="not json", content_type="application/json"
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == 400


def test_analyze_rejects_oversized_body(make_client):
    small = make_client(ANALYZE_MAX_BYTES=100)
    res = small.post("/api/v1/analyze", json=make_call())
    assert res.status_code == 413
    assert "limit" in res.get_json()["error"]["message"]


def test_analyze_rejects_too_many_turns(make_client):
    small = make_client(ANALYZE_MAX_TURNS=3)
    res = small.post("/api/v1/analyze", json=make_call())
    assert res.status_code == 422
    details = res.get_json()["error"]["details"]
    assert any("at most 3" in d for d in details)
