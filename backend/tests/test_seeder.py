import json
import os

import pytest

from app.models import Call, Label
from app.services.importer import validate_call
from app.services.seeder import SeedError, seed_database

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

GOOD_LABEL = {"call_id": "r1", "turn_index": 2, "rule": "high_latency", "is_real_issue": True}


def call(call_id, source="real", agent="flight-demo"):
    return {
        "call_id": call_id,
        "agent": agent,
        "source": source,
        "turns": [
            {"i": 0, "speaker": "agent", "text": "Hello", "start_ms": 0, "end_ms": 1000},
            {"i": 1, "speaker": "customer", "text": "Hi", "start_ms": 1200, "end_ms": 2000},
            {"i": 2, "speaker": "agent", "text": "How can I help you today", "start_ms": 6000, "end_ms": 7000},
        ],
    }


def write(tmp_path, real=None, synthetic=None, labels=None):
    files = (
        ("real_excerpts.json", real),
        ("synthetic.json", synthetic),
        ("labels.json", labels),
    )
    for name, data in files:
        if data is not None:
            (tmp_path / name).write_text(json.dumps(data), encoding="utf-8")


def test_seed_loads_calls_and_labels(app, tmp_path):
    write(tmp_path, real=[call("r1")], synthetic=[call("s1", "synthetic")], labels=[GOOD_LABEL])
    with app.app_context():
        result = seed_database(tmp_path)
        assert result == {"imported": ["r1", "s1"], "skipped": [], "findings": 2, "labels": 1}
        assert Call.query.count() == 2
        label = Label.query.one()
        assert label.call.external_id == "r1"
        assert (label.turn_idx, label.rule, label.is_real_issue) == (2, "high_latency", True)


def test_reseed_is_idempotent(app, tmp_path):
    write(tmp_path, real=[call("r1")], synthetic=[call("s1", "synthetic")], labels=[GOOD_LABEL])
    with app.app_context():
        seed_database(tmp_path)
        result = seed_database(tmp_path)
        assert result == {"imported": [], "skipped": ["r1", "s1"], "findings": 0, "labels": 1}
        assert Call.query.count() == 2
        assert Label.query.count() == 1


def test_missing_files_seed_nothing(app, tmp_path):
    with app.app_context():
        result = seed_database(tmp_path)
        assert result == {"imported": [], "skipped": [], "findings": 0, "labels": 0}
        assert Call.query.count() == 0


def test_missing_labels_file_keeps_existing_labels(app, tmp_path):
    write(tmp_path, real=[call("r1")], labels=[GOOD_LABEL])
    with app.app_context():
        seed_database(tmp_path)
        (tmp_path / "labels.json").unlink()
        seed_database(tmp_path)
        assert Label.query.count() == 1


def test_real_file_rejects_synthetic_source(app, tmp_path):
    write(tmp_path, real=[call("r1", "synthetic")])
    with app.app_context():
        with pytest.raises(SeedError) as exc:
            seed_database(tmp_path)
        assert any("expected 'real'" in e for e in exc.value.errors)
        assert Call.query.count() == 0


def test_synthetic_file_rejects_real_source(app, tmp_path):
    write(tmp_path, synthetic=[call("s1", "real")])
    with app.app_context():
        with pytest.raises(SeedError) as exc:
            seed_database(tmp_path)
        assert any("expected 'synthetic'" in e for e in exc.value.errors)
        assert Call.query.count() == 0


def test_invalid_call_names_the_file(app, tmp_path):
    bad = call("r1")
    bad["agent"] = ""
    write(tmp_path, real=[bad])
    with app.app_context():
        with pytest.raises(SeedError) as exc:
            seed_database(tmp_path)
        assert any("real_excerpts.json" in e and "agent is required" in e for e in exc.value.errors)
        assert Call.query.count() == 0


def test_duplicate_call_id_across_files_is_rejected(app, tmp_path):
    write(tmp_path, real=[call("x")], synthetic=[call("x", "synthetic")])
    with app.app_context():
        with pytest.raises(SeedError) as exc:
            seed_database(tmp_path)
        assert any("duplicate call_id" in e for e in exc.value.errors)
        assert Call.query.count() == 0


BAD_LABELS = [
    (dict(GOOD_LABEL, call_id="s1"), "real calls only"),
    (dict(GOOD_LABEL, call_id="ghost"), "not found"),
    (dict(GOOD_LABEL, rule="bogus"), "rule must be"),
    (dict(GOOD_LABEL, turn_index=9), "turn_index"),
    (dict(GOOD_LABEL, turn_index=True), "turn_index"),
    (dict(GOOD_LABEL, is_real_issue="yes"), "is_real_issue"),
    ("oops", "must be an object"),
]


@pytest.mark.parametrize("label,fragment", BAD_LABELS)
def test_bad_labels_are_rejected(app, tmp_path, label, fragment):
    write(tmp_path, real=[call("r1")], synthetic=[call("s1", "synthetic")], labels=[label])
    with app.app_context():
        with pytest.raises(SeedError) as exc:
            seed_database(tmp_path)
        assert any(fragment in e for e in exc.value.errors)
        assert Label.query.count() == 0


def test_duplicate_label_is_rejected(app, tmp_path):
    write(tmp_path, real=[call("r1")], labels=[GOOD_LABEL, GOOD_LABEL])
    with app.app_context():
        with pytest.raises(SeedError) as exc:
            seed_database(tmp_path)
        assert any("duplicate label" in e for e in exc.value.errors)


def test_invalid_labels_leave_existing_labels_untouched(app, tmp_path):
    write(tmp_path, real=[call("r1")], labels=[GOOD_LABEL])
    with app.app_context():
        seed_database(tmp_path)
        write(tmp_path, labels=[dict(GOOD_LABEL, rule="bogus")])
        with pytest.raises(SeedError):
            seed_database(tmp_path)
        assert Label.query.count() == 1


@pytest.mark.parametrize(
    "filename,source", [("real_excerpts.json", "real"), ("synthetic.json", "synthetic")]
)
def test_bundled_data_files_are_valid(filename, source):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        pytest.skip(f"{filename} not found")
    with open(path, encoding="utf-8-sig") as fh:
        calls = json.load(fh)
    assert isinstance(calls, list)
    ids = []
    for pos, obj in enumerate(calls):
        assert validate_call(obj, pos) == []
        assert obj["source"] == source
        ids.append(obj["call_id"])
    assert len(ids) == len(set(ids))
