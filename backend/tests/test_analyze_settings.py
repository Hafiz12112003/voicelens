import inspect

import pytest

from app.services.importer import analyze_call
from app.services.registry import RULES

DEFAULTS = {
    "threshold_ms": 1500,
    "high_ms": 3000,
    "jaccard_threshold": 0.8,
    "overlap_ms": 500,
    "customer_jaccard_threshold": 0.8,
}


def make_call(**overrides):
    call = {
        "call_id": "st-1",
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


def near_repeat_call(**overrides):
    call = {
        "call_id": "st-2",
        "agent": "support",
        "source": "synthetic",
        "turns": [
            {"i": 0, "speaker": "agent", "text": "please confirm your order"},
            {"i": 1, "speaker": "agent", "text": "please confirm your order for today evening"},
        ],
    }
    call.update(overrides)
    return call


def overlap_call(**overrides):
    call = {
        "call_id": "st-3",
        "agent": "support",
        "source": "synthetic",
        "turns": [
            {"i": 0, "speaker": "customer", "text": "I need a table for four", "start_ms": 0, "end_ms": 3000},
            {"i": 1, "speaker": "agent", "text": "Sure, I can help with that", "start_ms": 2000, "end_ms": 4000},
        ],
    }
    call.update(overrides)
    return call


def customer_repeat_call(**overrides):
    call = {
        "call_id": "st-4",
        "agent": "support",
        "source": "synthetic",
        "turns": [
            {"i": 0, "speaker": "customer", "text": "please confirm your order"},
            {"i": 1, "speaker": "agent", "text": "ok"},
            {"i": 2, "speaker": "customer", "text": "please confirm your order today"},
        ],
    }
    call.update(overrides)
    return call


def shape(body):
    return [(f["turn_index"], f["rule"], f["severity"]) for f in body["findings"]]


def test_response_echoes_the_default_settings(client):
    body = client.post("/api/v1/analyze", json=make_call()).get_json()
    assert body["settings"] == DEFAULTS
    assert shape(body) == [(2, "high_latency", "high"), (4, "repeated_agent_turn", "medium")]


def test_null_settings_mean_defaults(client):
    res = client.post("/api/v1/analyze", json=make_call(settings=None))
    assert res.status_code == 200
    assert res.get_json()["settings"] == DEFAULTS


def test_higher_latency_threshold_removes_the_latency_finding(client):
    res = client.post(
        "/api/v1/analyze",
        json=make_call(settings={"threshold_ms": 5000, "high_ms": 6000}),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert shape(body) == [(4, "repeated_agent_turn", "medium")]
    assert body["settings"] == {**DEFAULTS, "threshold_ms": 5000, "high_ms": 6000}


def test_raising_high_ms_lowers_the_severity(client):
    body = client.post(
        "/api/v1/analyze", json=make_call(settings={"high_ms": 10000})
    ).get_json()
    assert shape(body) == [(2, "high_latency", "medium"), (4, "repeated_agent_turn", "medium")]


def test_jaccard_override_flags_a_near_repeat(client):
    default = client.post("/api/v1/analyze", json=near_repeat_call()).get_json()
    assert default["findings"] == []
    lowered = client.post(
        "/api/v1/analyze",
        json=near_repeat_call(settings={"jaccard_threshold": 0.5}),
    ).get_json()
    assert shape(lowered) == [(1, "repeated_agent_turn", "medium")]
    assert "similarity 0.57" in lowered["findings"][0]["evidence"]


def test_talking_over_is_flagged_and_the_overlap_setting_changes_it(client):
    default = client.post("/api/v1/analyze", json=overlap_call()).get_json()
    assert shape(default) == [(1, "agent_talking_over_customer", "medium")]
    relaxed = client.post(
        "/api/v1/analyze", json=overlap_call(settings={"overlap_ms": 1500})
    ).get_json()
    assert relaxed["findings"] == []
    assert relaxed["settings"]["overlap_ms"] == 1500


def test_customer_repeat_is_flagged_and_its_threshold_changes_it(client):
    default = client.post("/api/v1/analyze", json=customer_repeat_call()).get_json()
    assert shape(default) == [(2, "customer_repeated_themselves", "low")]
    stricter = client.post(
        "/api/v1/analyze",
        json=customer_repeat_call(settings={"customer_jaccard_threshold": 0.9}),
    ).get_json()
    assert stricter["findings"] == []
    assert stricter["settings"]["customer_jaccard_threshold"] == 0.9


BAD_SETTINGS = [
    ({"nope": 1}, "not a known setting"),
    ({"threshold_ms": "fast"}, "whole number"),
    ({"threshold_ms": 1500.5}, "whole number"),
    ({"threshold_ms": True}, "whole number"),
    ({"threshold_ms": 5}, "between 100 and 60000"),
    ({"jaccard_threshold": 0.1}, "between 0.5 and 1.0"),
    ({"jaccard_threshold": 1.5}, "between 0.5 and 1.0"),
    ({"threshold_ms": 5000}, "must not be below"),
    ([], "settings must be an object"),
    ({"overlap_ms": -1}, "between 0 and 5000"),
    ({"customer_jaccard_threshold": 0.2}, "between 0.5 and 1.0"),
]


@pytest.mark.parametrize("settings,fragment", BAD_SETTINGS)
def test_bad_settings_return_422_with_details(client, settings, fragment):
    res = client.post("/api/v1/analyze", json=make_call(settings=settings))
    assert res.status_code == 422
    details = res.get_json()["error"]["details"]
    assert any(fragment in d for d in details)


def test_call_errors_and_settings_errors_are_reported_together(client):
    payload = {
        "call_id": "x",
        "source": "synthetic",
        "turns": [{"i": 0, "speaker": "robot", "text": "hi"}],
        "settings": {"nope": 1},
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 422
    details = res.get_json()["error"]["details"]
    assert any("agent is required" in d for d in details)
    assert any("not a known setting" in d for d in details)


def test_analyze_call_defaults_match_the_registry():
    params = inspect.signature(analyze_call).parameters
    registry = {t["key"]: t["default"] for rule in RULES for t in rule["thresholds"]}
    assert registry == DEFAULTS
    assert {key: params[key].default for key in registry} == registry


def test_import_ignores_settings(client):
    res = client.post(
        "/api/v1/import",
        json=make_call(settings={"threshold_ms": 9999, "high_ms": 9999}),
    )
    assert res.status_code == 201
    assert res.get_json()["findings"] == 2


def test_import_saves_findings_for_the_new_rules_and_the_summary_lists_six_rules(client):
    call = {
        "call_id": "ov-1",
        "agent": "support",
        "source": "synthetic",
        "turns": [
            {"i": 0, "speaker": "customer", "text": "please confirm your order", "start_ms": 0, "end_ms": 2000},
            {"i": 1, "speaker": "agent", "text": "sure one moment", "start_ms": 1000, "end_ms": 3000},
            {"i": 2, "speaker": "customer", "text": "please confirm your order today", "start_ms": 3500, "end_ms": 5000},
        ],
    }
    res = client.post("/api/v1/import", json=call)
    assert res.status_code == 201
    assert res.get_json()["findings"] == 2
    detail = client.get("/api/v1/calls/ov-1").get_json()
    assert [(f["turn_index"], f["rule"]) for f in detail["findings"]] == [
        (1, "agent_talking_over_customer"),
        (2, "customer_repeated_themselves"),
    ]
    summary = client.get("/api/v1/summary?source=synthetic").get_json()
    assert {r["rule"]: r["total"] for r in summary["per_rule"]} == {
        "high_latency": 0,
        "repeated_agent_turn": 0,
        "ignored_constraint": 0,
        "false_success_claim": 0,
        "agent_talking_over_customer": 1,
        "customer_repeated_themselves": 1,
    }
