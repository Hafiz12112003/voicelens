import pytest

from app.extensions import db
from app.models import Call, Label
from app.services.metrics import RULE_ORDER, accuracy_report


def make_call(call_id, gap_ms=None, source="real", started_at="2026-10-20T10:00:00Z", outcome="completed"):
    """agent, customer, agent. gap_ms is the wait before the agent's reply;
    None means the call has no timestamps at all."""
    if gap_ms is None:
        times = [{}, {}, {}]
    else:
        times = [
            {"start_ms": 0, "end_ms": 1000},
            {"start_ms": 1200, "end_ms": 2000},
            {"start_ms": 2000 + gap_ms, "end_ms": 3000 + gap_ms},
        ]
    texts = [("agent", "Hello"), ("customer", "Hi there"), ("agent", "How can I help you today")]
    call = {
        "call_id": call_id,
        "agent": "flight-demo",
        "source": source,
        "outcome": outcome,
        "turns": [
            {"i": i, "speaker": speaker, "text": text, **times[i]}
            for i, (speaker, text) in enumerate(texts)
        ],
    }
    if started_at is not None:
        call["started_at"] = started_at
    return call


@pytest.fixture()
def loaded(client):
    calls = [
        make_call("r1", 4000),
        make_call("r2", 2000, outcome="escalated"),
        make_call("r3", 500, started_at="2026-10-21T10:00:00Z"),
        make_call("r4", None, started_at=None),
        make_call("s1", 5000, source="synthetic", started_at="2026-10-21T10:00:00Z"),
    ]
    r = client.post("/api/v1/import", json=calls)
    assert r.status_code == 201
    assert r.get_json()["findings"] == 3
    return client


def summary(client, query=""):
    r = client.get(f"/api/v1/summary{query}")
    assert r.status_code == 200
    return r.get_json()


def finding_id(client, call_id):
    return client.get(f"/api/v1/calls/{call_id}").get_json()["findings"][0]["id"]


def add_labels(app, rows):
    with app.app_context():
        for external_id, turn_idx, rule, is_real in rows:
            call = Call.query.filter_by(external_id=external_id).one()
            db.session.add(
                Label(call_id=call.id, turn_idx=turn_idx, rule=rule, is_real_issue=is_real)
            )
        db.session.commit()


LABELS = [
    ("r1", 2, "high_latency", True),
    ("r2", 2, "high_latency", False),
    ("r3", 2, "high_latency", False),
    ("r3", 2, "repeated_agent_turn", True),
    ("s1", 2, "high_latency", True),
]


# ---------- summary endpoint ----------

def test_default_scope_is_real_only(loaded):
    s = summary(loaded)
    assert s["calls_analysed"] == 4
    assert s["scope"] == {"source": "real", "calls_by_source": {"real": 4, "synthetic": 1}}


def test_findings_and_per_rule_counts(loaded):
    s = summary(loaded)
    assert s["findings"] == {"total": 2, "open": 2, "confirmed": 0, "dismissed": 0}
    assert [r["rule"] for r in s["per_rule"]] == RULE_ORDER
    assert [r["total"] for r in s["per_rule"]] == [2, 0, 0, 0]
    assert s["per_rule"][0] == {
        "rule": "high_latency", "total": 2, "open": 2, "confirmed": 0, "dismissed": 0,
    }


def test_latency_excludes_calls_without_measurable_turns(loaded):
    s = summary(loaded)
    assert s["latency"] == {"count": 3, "avg_ms": 2167, "p95_ms": 4000, "max_ms": 4000}
    assert s["calls_with_latency"] == 3


def test_escalated_is_reported_separately_and_is_not_a_failure(loaded):
    s = summary(loaded)
    assert s["escalated_calls"] == 1
    assert s["failure"] == {"calls_with_confirmed_high": 0, "rate": 0.0}


def test_failure_rate_counts_only_confirmed_high_findings(loaded):
    loaded.patch(f"/api/v1/findings/{finding_id(loaded, 'r2')}", json={"status": "confirmed"})
    s = summary(loaded)
    assert s["failure"] == {"calls_with_confirmed_high": 0, "rate": 0.0}
    loaded.patch(f"/api/v1/findings/{finding_id(loaded, 'r1')}", json={"status": "confirmed"})
    s = summary(loaded)
    assert s["failure"] == {"calls_with_confirmed_high": 1, "rate": 0.25}
    assert s["findings"] == {"total": 2, "open": 0, "confirmed": 2, "dismissed": 0}


def test_dismissed_high_finding_is_not_a_failure(loaded):
    loaded.patch(f"/api/v1/findings/{finding_id(loaded, 'r1')}", json={"status": "dismissed"})
    s = summary(loaded)
    assert s["failure"]["calls_with_confirmed_high"] == 0
    assert s["findings"]["dismissed"] == 1
    assert s["findings"]["open"] == 1


def test_all_scope_includes_synthetic(loaded):
    s = summary(loaded, "?source=all")
    assert s["calls_analysed"] == 5
    assert s["findings"]["total"] == 3
    assert s["latency"] == {"count": 4, "avg_ms": 2875, "p95_ms": 5000, "max_ms": 5000}
    assert s["scope"]["source"] == "all"


def test_synthetic_scope(loaded):
    s = summary(loaded, "?source=synthetic")
    assert s["calls_analysed"] == 1
    assert s["findings"]["total"] == 1
    assert s["latency"] == {"count": 1, "avg_ms": 5000, "p95_ms": 5000, "max_ms": 5000}


def test_daily_series_skips_undated_calls(loaded):
    assert summary(loaded)["daily"] == [
        {"date": "2026-10-20", "calls": 2, "findings": 2, "avg_latency_ms": 3000},
        {"date": "2026-10-21", "calls": 1, "findings": 0, "avg_latency_ms": 500},
    ]


def test_bad_source_returns_400(client):
    r = client.get("/api/v1/summary?source=bogus")
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == 400


def test_empty_database(client):
    s = summary(client)
    assert s["calls_analysed"] == 0
    assert s["failure"] == {"calls_with_confirmed_high": 0, "rate": None}
    assert s["latency"] == {"count": 0, "avg_ms": None, "p95_ms": None, "max_ms": None}
    assert s["findings"]["total"] == 0
    assert s["escalated_calls"] == 0
    assert s["daily"] == []
    assert len(s["per_rule"]) == 4
    assert s["accuracy"]["status"] == "no_labels"
    assert s["accuracy"]["n_items"] == 0


# ---------- accuracy ----------

def test_accuracy_counts_per_rule_on_real_calls_only(loaded, app):
    add_labels(app, LABELS)
    acc = summary(loaded)["accuracy"]
    assert acc["status"] == "ok"
    assert acc["n_items"] == 4
    assert acc["labeled_calls"] == 3
    assert "Real demo calls" in acc["basis"]
    rows = {r["rule"]: r for r in acc["per_rule"]}
    assert rows["high_latency"] == {
        "rule": "high_latency", "items": 3, "tp": 1, "fp": 1, "fn": 0, "tn": 1,
        "precision": 0.5, "recall": 1.0,
    }
    assert rows["repeated_agent_turn"] == {
        "rule": "repeated_agent_turn", "items": 1, "tp": 0, "fp": 0, "fn": 1, "tn": 0,
        "precision": None, "recall": 0.0,
    }
    assert rows["ignored_constraint"]["precision"] is None
    assert rows["ignored_constraint"]["recall"] is None
    assert acc["errors"] == [
        {"call_id": "r2", "turn_index": 2, "rule": "high_latency", "kind": "false_positive"},
        {"call_id": "r3", "turn_index": 2, "rule": "repeated_agent_turn", "kind": "false_negative"},
    ]


def test_accuracy_ignores_review_status_and_scope(loaded, app):
    add_labels(app, LABELS)
    loaded.patch(f"/api/v1/findings/{finding_id(loaded, 'r1')}", json={"status": "dismissed"})
    acc = summary(loaded, "?source=synthetic")["accuracy"]
    assert acc["n_items"] == 4
    rows = {r["rule"]: r for r in acc["per_rule"]}
    assert rows["high_latency"]["tp"] == 1


def test_accuracy_report_confusion_cells():
    predicted = {("c", 1, "high_latency"), ("c", 2, "high_latency")}
    labels = [
        ("c", 1, "high_latency", True),
        ("c", 2, "high_latency", False),
        ("c", 3, "high_latency", True),
    ]
    report = accuracy_report(predicted, labels)
    row = next(r for r in report["per_rule"] if r["rule"] == "high_latency")
    assert (row["tp"], row["fp"], row["fn"], row["tn"]) == (1, 1, 1, 0)
    assert row["precision"] == 0.5
    assert row["recall"] == 0.5
    assert [e["kind"] for e in report["errors"]] == ["false_positive", "false_negative"]


def test_accuracy_report_duplicates_and_unknown_rules():
    predicted = {("c", 1, "high_latency")}
    labels = [
        ("c", 1, "high_latency", True),
        ("c", 1, "high_latency", False),
        ("c", 1, "bogus", True),
    ]
    report = accuracy_report(predicted, labels)
    assert report["n_items"] == 1
    row = next(r for r in report["per_rule"] if r["rule"] == "high_latency")
    assert (row["tp"], row["fp"]) == (1, 0)
