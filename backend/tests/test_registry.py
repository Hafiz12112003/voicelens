import inspect

from app import create_app
from app.extensions import db
from app.services import metrics
from app.services.registry import RULES, rule_catalog
from app.services.rules import check_high_latency, check_repeated_agent_turn


def test_rules_endpoint_lists_every_rule_in_order(client):
    res = client.get("/api/v1/rules")
    assert res.status_code == 200
    rules = res.get_json()["rules"]
    assert [r["id"] for r in rules] == [
        "high_latency",
        "repeated_agent_turn",
        "ignored_constraint",
        "false_success_claim",
    ]
    for rule in rules:
        assert rule["validated"] is False
        assert rule["name"] and rule["description"] and rule["known_limits"]
        for threshold in rule["thresholds"]:
            assert threshold["min"] <= threshold["default"] <= threshold["max"]
    by_id = {r["id"]: r for r in rules}
    assert [t["key"] for t in by_id["high_latency"]["thresholds"]] == ["threshold_ms", "high_ms"]
    assert by_id["ignored_constraint"]["thresholds"] == []
    assert by_id["false_success_claim"]["needs"] == ["tool_events in the call"]


def test_rules_endpoint_latency_defaults_follow_config():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "LATENCY_THRESHOLD_MS": 2000,
            "LATENCY_HIGH_MS": 4000,
        }
    )
    try:
        body = app.test_client().get("/api/v1/rules").get_json()
    finally:
        with app.app_context():
            db.session.remove()
            db.drop_all()
    latency = next(r for r in body["rules"] if r["id"] == "high_latency")
    assert {t["key"]: t["default"] for t in latency["thresholds"]} == {
        "threshold_ms": 2000,
        "high_ms": 4000,
    }


def test_catalog_does_not_leak_config_between_calls():
    first = rule_catalog({"LATENCY_THRESHOLD_MS": 2000, "LATENCY_HIGH_MS": 4000})
    second = rule_catalog({"LATENCY_THRESHOLD_MS": 1500, "LATENCY_HIGH_MS": 3000})
    pick = lambda catalog: {  # noqa: E731
        t["key"]: t["default"] for t in catalog[0]["thresholds"]
    }
    assert pick(first) == {"threshold_ms": 2000, "high_ms": 4000}
    assert pick(second) == {"threshold_ms": 1500, "high_ms": 3000}
    assert RULES[0]["thresholds"][0]["default"] == 1500


def test_registry_defaults_match_rule_functions():
    by_id = {r["id"]: r for r in RULES}
    latency = {t["key"]: t["default"] for t in by_id["high_latency"]["thresholds"]}
    params = inspect.signature(check_high_latency).parameters
    assert latency == {
        "threshold_ms": params["threshold_ms"].default,
        "high_ms": params["high_ms"].default,
    }
    repeat = {t["key"]: t["default"] for t in by_id["repeated_agent_turn"]["thresholds"]}
    params = inspect.signature(check_repeated_agent_turn).parameters
    assert repeat == {"jaccard_threshold": params["jaccard_threshold"].default}


def test_rule_order_is_derived_from_registry():
    assert metrics.RULE_ORDER == [r["id"] for r in RULES]
