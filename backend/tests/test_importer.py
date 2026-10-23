import copy

import pytest

from app.models import Call
from app.services.importer import TranscriptError, import_calls, parse_csv

SAMPLE = {
    "call_id": "restaurant-001",
    "agent": "restaurant-demo",
    "source": "real",
    "started_at": "2026-10-25T10:12:00Z",
    "turns": [
        {"i": 0, "speaker": "agent", "text": "Welcome, how can I help?", "start_ms": 0, "end_ms": 2100},
        {"i": 1, "speaker": "customer", "text": "Two vegetarian thalis please", "start_ms": 2600, "end_ms": 4300},
        {"i": 2, "speaker": "agent", "text": "Confirmed, three chicken thalis.", "start_ms": 8000, "end_ms": 10000},
    ],
    "tool_events": [{"after_turn": 1, "name": "create_order", "status": "failed"}],
    "outcome": "completed",
}


def sample(call_id="restaurant-001"):
    call = copy.deepcopy(SAMPLE)
    call["call_id"] = call_id
    return call


def test_import_saves_everything(app):
    with app.app_context():
        result = import_calls([sample()])
        assert result["imported"] == ["restaurant-001"]
        assert result["skipped"] == []
        assert result["findings"] == 4

        call = Call.query.filter_by(external_id="restaurant-001").one()
        assert call.agent == "restaurant-demo"
        assert call.source == "real"
        assert call.duration_ms == 10000
        assert call.outcome == "completed"
        assert len(call.turns) == 3
        assert len(call.tool_events) == 1
        assert len(call.findings) == 4
        assert {f.rule for f in call.findings} == {
            "high_latency",
            "ignored_constraint",
            "false_success_claim",
        }
        assert all(f.status == "open" for f in call.findings)
        assert all(f.turn_idx == 2 for f in call.findings)


def test_import_accepts_single_object(app):
    with app.app_context():
        assert import_calls(sample())["imported"] == ["restaurant-001"]


def test_synthetic_source_is_preserved(app):
    with app.app_context():
        call = sample("synthetic-001")
        call["source"] = "synthetic"
        import_calls([call])
        assert Call.query.filter_by(external_id="synthetic-001").one().source == "synthetic"


def test_duplicate_call_is_skipped(app):
    with app.app_context():
        import_calls([sample()])
        result = import_calls([sample()])
        assert result["imported"] == []
        assert result["skipped"] == ["restaurant-001"]
        assert Call.query.count() == 1


def test_duplicate_inside_one_payload_is_skipped(app):
    with app.app_context():
        result = import_calls([sample(), sample()])
        assert result["imported"] == ["restaurant-001"]
        assert result["skipped"] == ["restaurant-001"]
        assert Call.query.count() == 1


INVALID_CASES = [
    (lambda c: c.pop("call_id"), "call_id is required"),
    (lambda c: c.update(source="demo"), "source must be"),
    (lambda c: c.update(agent=""), "agent is required"),
    (lambda c: c.update(turns=[]), "turns must be a non-empty list"),
    (lambda c: c["turns"][1].update(i=5), "turns[1].i"),
    (lambda c: c["turns"][1].update(speaker="bot"), "turns[1].speaker"),
    (lambda c: c["turns"][1].update(text="  "), "turns[1].text"),
    (lambda c: c["turns"][0].update(start_ms=-5), "turns[0].start_ms"),
    (lambda c: c["turns"][0].update(start_ms=3000, end_ms=1000), "end_ms must not be before start_ms"),
    (lambda c: c.update(started_at="yesterday"), "started_at"),
    (lambda c: c["tool_events"][0].update(after_turn=9), "tool_events[0].after_turn"),
    (lambda c: c["tool_events"][0].update(status="maybe"), "tool_events[0].status"),
    (lambda c: c["turns"].__setitem__(1, "oops"), "turns[1] must be an object"),
    (lambda c: c.update(tool_events="x"), "tool_events must be a list"),
    (lambda c: c["turns"][0].update(start_ms=True), "turns[0].start_ms"),
]


@pytest.mark.parametrize("mutate,fragment", INVALID_CASES)
def test_invalid_transcripts_are_rejected(app, mutate, fragment):
    with app.app_context():
        call = sample()
        mutate(call)
        with pytest.raises(TranscriptError) as exc:
            import_calls([call])
        assert any(fragment in e for e in exc.value.errors)
        assert Call.query.count() == 0


def test_one_bad_call_saves_nothing(app):
    with app.app_context():
        bad = sample("bad-001")
        bad["source"] = "demo"
        with pytest.raises(TranscriptError):
            import_calls([sample("good-001"), bad])
        assert Call.query.count() == 0


@pytest.mark.parametrize("payload", [[], "x", None])
def test_bad_payload_shape(app, payload):
    with app.app_context():
        with pytest.raises(TranscriptError):
            import_calls(payload)


def test_calls_without_timestamps_are_saved(app):
    with app.app_context():
        call = {
            "call_id": "x-1",
            "agent": "flight-demo",
            "source": "real",
            "turns": [
                {"i": 0, "speaker": "agent", "text": "Hi"},
                {"i": 1, "speaker": "customer", "text": "Hello"},
            ],
        }
        result = import_calls([call])
        saved = Call.query.filter_by(external_id="x-1").one()
        assert result["findings"] == 0
        assert saved.duration_ms is None
        assert saved.started_at is None


def test_started_at_is_stored_as_naive_utc(app):
    with app.app_context():
        call = sample()
        call["started_at"] = "2026-10-25T15:30:00+05:30"
        import_calls([call])
        saved = Call.query.one()
        assert saved.started_at.isoformat() == "2026-10-25T10:00:00"


def test_false_success_rule_needs_tool_events(app):
    with app.app_context():
        call = sample()
        call.pop("tool_events")
        import_calls([call])
        rules = {f.rule for f in Call.query.one().findings}
        assert "false_success_claim" not in rules
        assert "high_latency" in rules


CSV_TEXT = """call_id,agent,source,started_at,outcome,i,speaker,text,start_ms,end_ms
flight-001,flight-demo,real,2026-10-25T10:12:00Z,completed,0,agent,"Welcome, how can I help?",0,2100
flight-001,flight-demo,real,,,1,customer,Book me a flight,2600,4300
flight-002,flight-demo,synthetic,,,0,agent,Hello,,
"""


def test_csv_groups_rows_into_calls():
    calls = parse_csv(CSV_TEXT)
    assert [c["call_id"] for c in calls] == ["flight-001", "flight-002"]
    assert len(calls[0]["turns"]) == 2
    assert calls[0]["turns"][0]["text"] == "Welcome, how can I help?"
    assert calls[0]["outcome"] == "completed"
    assert calls[1]["source"] == "synthetic"
    assert calls[1]["turns"][0]["start_ms"] is None


def test_csv_missing_columns():
    with pytest.raises(TranscriptError) as exc:
        parse_csv("call_id,agent\nx,y\n")
    assert "missing columns" in exc.value.errors[0]


def test_csv_bad_number():
    text = "call_id,agent,source,i,speaker,text\nx,flight-demo,real,abc,agent,Hi\n"
    with pytest.raises(TranscriptError) as exc:
        parse_csv(text)
    assert "row 2" in exc.value.errors[0]


def test_csv_end_to_end(app):
    with app.app_context():
        result = import_calls(parse_csv(CSV_TEXT))
        assert result["imported"] == ["flight-001", "flight-002"]
        assert Call.query.count() == 2
