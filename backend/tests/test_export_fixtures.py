import importlib.util
import json
import pathlib

import pytest

BACKEND = pathlib.Path(__file__).resolve().parents[1]
SOURCES = ("real", "synthetic", "all")


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
