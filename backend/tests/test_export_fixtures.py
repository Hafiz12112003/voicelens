import importlib.util
import json
import pathlib

import pytest

BACKEND = pathlib.Path(__file__).resolve().parents[1]
SOURCES = ("real", "synthetic", "all")
NEW_RULES = {"agent_talking_over_customer", "customer_repeated_themselves"}
ALL_RULES = [
    "high_latency",
    "repeated_agent_turn",
    "ignored_constraint",
    "false_success_claim",
    "agent_talking_over_customer",
    "customer_repeated_themselves",
]


def load_exporter():
    spec = importlib.util.spec_from_file_location(
        "export_fixtures", BACKEND / "export_fixtures.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_writes_every_summary_and_call_file(tmp_path):
    result = load_exporter().export_fixtures(tmp_path)
    for source in SOURCES:
        assert read(tmp_path / f"summary-{source}.json")["scope"]["source"] == source
    calls = read(tmp_path / "calls.json")
    assert result["calls"] == len(calls["items"])
    for item in calls["items"]:
        assert (tmp_path / "calls" / f"{item['call_id']}.json").exists()


def test_snapshot_never_contains_review_state(tmp_path):
    load_exporter().export_fixtures(tmp_path)
    for source in SOURCES:
        findings = read(tmp_path / f"summary-{source}.json")["findings"]
        assert findings["confirmed"] == 0
        assert findings["dismissed"] == 0
        assert findings["open"] == findings["total"]
    for path in (tmp_path / "calls").glob("*.json"):
        detail = read(path)
        assert detail["review_status"] in ("clean", "unreviewed")
        for finding in detail["findings"]:
            assert finding["status"] == "open"
            assert finding["note"] is None


def test_a_bad_data_file_stops_the_export_with_a_message(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "synthetic.json").write_text("[{}]", encoding="utf-8")
    with pytest.raises(SystemExit) as raised:
        load_exporter().export_fixtures(tmp_path / "out", data_dir)
    assert "Seed failed" in str(raised.value.code)


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    out = tmp_path_factory.mktemp("fixtures")
    result = load_exporter().export_fixtures(out)
    return out, result


def test_export_writes_rules_and_six_rule_summaries(exported):
    out, result = exported
    assert result == {"summaries": 3, "rules": 1, "calls": 5}
    rules = read(out / "rules.json")
    assert [r["id"] for r in rules["rules"]] == ALL_RULES
    assert rules["languages"] == [{"id": "en", "name": "English"}]
    for source in SOURCES:
        summary = read(out / f"summary-{source}.json")
        assert [r["rule"] for r in summary["per_rule"]] == ALL_RULES
        assert [r["rule"] for r in summary["accuracy"]["per_rule"]] == ALL_RULES


def test_bundled_synthetic_calls_do_not_trigger_the_new_rules(exported):
    out, _ = exported
    paths = sorted((out / "calls").glob("*.json"))
    assert len(paths) == 5
    for path in paths:
        detail = read(path)
        assert not NEW_RULES & {f["rule"] for f in detail["findings"]}, path.name
