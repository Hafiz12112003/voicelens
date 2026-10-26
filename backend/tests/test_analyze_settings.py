import inspect

import pytest

from app.services.importer import analyze_call
from app.services.registry import RULES

DEFAULTS = {"threshold_ms": 1500, "high_ms": 3000, "jaccard_threshold": 0.8}


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
