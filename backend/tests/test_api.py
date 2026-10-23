import copy
import io
import json

import pytest

A = {
    "call_id": "restaurant-001",
    "agent": "restaurant-demo",
    "source": "real",
    "started_at": "2026-10-25T10:12:00Z",
    "turns": [
        {"i": 0, "speaker": "agent", "text": "Welcome, how can I help?", "start_ms": 0, "end_ms": 2100},
        {"i": 1, "speaker": "customer", "text": "Two vegetarian thalis please", "start_ms": 2600, "end_ms": 4300},
        {"i": 2, "speaker": "agent", "text": "Confirmed, three chicken thalis.", "start_ms": 8000, "end_ms": 10000},
    ],
    "outcome": "completed",
}
B = {
    "call_id": "flight-001",
    "agent": "flight-demo",
    "source": "synthetic",
    "started_at": "2026-10-26T09:00:00Z",
    "turns": [
        {"i": 0, "speaker": "agent", "text": "Hello", "start_ms": 0, "end_ms": 1000},
        {"i": 1, "speaker": "customer", "text": "Book a flight to Delhi", "start_ms": 1200, "end_ms": 2500},
        {"i": 2, "speaker": "agent", "text": "Sure, which date?", "start_ms": 3000, "end_ms": 4000},
    ],
    "tool_events": [{"after_turn": 1, "name": "search_flights", "status": "ok"}],
    "outcome": "completed",
}
C = {
    "call_id": "hotel-001",
    "agent": "hotel-demo",
    "source": "real",
    "started_at": "2026-10-24T08:00:00Z",
    "turns": [
        {"i": 0, "speaker": "agent", "text": "Welcome to the hotel", "start_ms": 0, "end_ms": 1000},
        {"i": 1, "speaker": "customer", "text": "I need a room", "start_ms": 1500, "end_ms": 2500},
        {"i": 2, "speaker": "agent", "text": "Please confirm your name", "start_ms": 5000, "end_ms": 6000},
    ],
    "outcome": "escalated",
}
# A: 3 findings (high latency, quantity mismatch, vegetarian vs chicken), all on turn 2
# B: 0 findings, C: 1 medium latency finding

CSV_TEXT = (
    "call_id,agent,source,i,speaker,text,start_ms,end_ms\n"
    "flight-009,flight-demo,real,0,agent,Hello,0,1000\n"
    "flight-009,flight-demo,real,1,customer,Hi,1200,2000\n"
)


@pytest.fixture()
def loaded(client):
    r = client.post("/api/v1/import", json=[A, B, C])
    assert r.status_code == 201
    return client


def ids_of(client, call_id):
    detail = client.get(f"/api/v1/calls/{call_id}").get_json()
    return [f["id"] for f in detail["findings"]]


def call_ids(client, query=""):
    body = client.get(f"/api/v1/calls{query}").get_json()
    return [c["call_id"] for c in body["items"]]


def upload(client, content, filename):
    return client.post(
        "/api/v1/import",
        data={"file": (io.BytesIO(content), filename)},
        content_type="multipart/form-data",
    )


# ---------- import ----------

def test_import_json_returns_201(client):
    r = client.post("/api/v1/import", json=[A, B, C])
    assert r.status_code == 201
    body = r.get_json()
    assert body["imported"] == ["restaurant-001", "flight-001", "hotel-001"]
    assert body["skipped"] == []
    assert body["findings"] == 4


def test_import_duplicates_return_200(loaded):
    r = loaded.post("/api/v1/import", json=[A])
    assert r.status_code == 200
    assert r.get_json()["skipped"] == ["restaurant-001"]


def test_import_invalid_returns_422_with_details(client):
    bad = copy.deepcopy(A)
    bad["source"] = "demo"
    bad["turns"] = []
    r = client.post("/api/v1/import", json=[bad])
    assert r.status_code == 422
    err = r.get_json()["error"]
    assert err["code"] == 422
    assert len(err["details"]) == 2
    assert client.get("/api/v1/calls").get_json()["total"] == 0


def test_import_not_json_returns_400(client):
    r = client.post("/api/v1/import", data="hello", content_type="text/plain")
    assert r.status_code == 400


def test_import_malformed_json_returns_400(client):
    r = client.post("/api/v1/import", data="{bad", content_type="application/json")
    assert r.status_code == 400


def test_import_csv_upload(client):
    r = upload(client, CSV_TEXT.encode(), "calls.csv")
    assert r.status_code == 201
    assert r.get_json()["imported"] == ["flight-009"]


def test_import_json_file_upload(client):
    r = upload(client, json.dumps([B]).encode(), "calls.json")
    assert r.status_code == 201
    assert r.get_json()["imported"] == ["flight-001"]


def test_import_bad_csv_returns_422(client):
    r = upload(client, b"call_id,agent\nx,y\n", "calls.csv")
    assert r.status_code == 422
    assert "missing columns" in r.get_json()["error"]["details"][0]


def test_import_non_utf8_file_returns_400(client):
    r = upload(client, b"\xff\xfe\x00", "calls.json")
    assert r.status_code == 400


def test_import_empty_list_returns_422(client):
    r = client.post("/api/v1/import", json=[])
    assert r.status_code == 422


# ---------- calls list ----------

def test_list_default(loaded):
    body = loaded.get("/api/v1/calls").get_json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert body["total_pages"] == 1
    assert len(body["items"]) == 3


def test_list_item_shape(loaded):
    items = {c["call_id"]: c for c in loaded.get("/api/v1/calls").get_json()["items"]}
    assert items["restaurant-001"] == {
        "call_id": "restaurant-001",
        "agent": "restaurant-demo",
        "source": "real",
        "started_at": "2026-10-25T10:12:00Z",
        "duration_ms": 10000,
        "outcome": "completed",
        "findings_count": 3,
        "max_severity": "high",
        "review_status": "unreviewed",
    }
    assert items["flight-001"]["findings_count"] == 0
    assert items["flight-001"]["max_severity"] is None
    assert items["flight-001"]["review_status"] == "clean"
    assert items["flight-001"]["source"] == "synthetic"
    assert items["hotel-001"]["max_severity"] == "medium"


def test_list_filter_source(loaded):
    assert call_ids(loaded, "?source=synthetic") == ["flight-001"]
    assert call_ids(loaded, "?source=real&sort=call_id&order=asc") == ["hotel-001", "restaurant-001"]


def test_list_filter_agent(loaded):
    assert call_ids(loaded, "?agent=hotel-demo") == ["hotel-001"]


def test_list_filter_severity(loaded):
    assert call_ids(loaded, "?severity=high") == ["restaurant-001"]
    assert call_ids(loaded, "?severity=medium&sort=call_id&order=asc") == ["hotel-001", "restaurant-001"]
    assert call_ids(loaded, "?severity=low") == []


def test_list_search_call_id(loaded):
    assert call_ids(loaded, "?q=hotel") == ["hotel-001"]
    assert call_ids(loaded, "?q=HOTEL") == ["hotel-001"]


def test_list_search_transcript_text(loaded):
    assert call_ids(loaded, "?q=vegetarian") == ["restaurant-001"]
    assert call_ids(loaded, "?q=delhi") == ["flight-001"]


def test_list_search_escapes_wildcards(loaded):
    body = loaded.get("/api/v1/calls", query_string={"q": "%"}).get_json()
    assert body["total"] == 0


def test_list_sort_findings_desc(loaded):
    assert call_ids(loaded, "?sort=findings&order=desc") == ["restaurant-001", "hotel-001", "flight-001"]


def test_list_sort_duration_asc(loaded):
    assert call_ids(loaded, "?sort=duration&order=asc") == ["flight-001", "hotel-001", "restaurant-001"]


def test_list_sort_severity_desc(loaded):
    assert call_ids(loaded, "?sort=severity&order=desc") == ["restaurant-001", "hotel-001", "flight-001"]


def test_list_pagination(loaded):
    first = loaded.get("/api/v1/calls?sort=call_id&order=asc&page_size=2&page=1").get_json()
    assert [c["call_id"] for c in first["items"]] == ["flight-001", "hotel-001"]
    assert first["total"] == 3
    assert first["total_pages"] == 2
    second = loaded.get("/api/v1/calls?sort=call_id&order=asc&page_size=2&page=2").get_json()
    assert [c["call_id"] for c in second["items"]] == ["restaurant-001"]


@pytest.mark.parametrize(
    "query",
    [
        "page=0",
        "page=abc",
        "page_size=0",
        "page_size=101",
        "sort=bogus",
        "order=up",
        "source=demo",
        "severity=urgent",
    ],
)
def test_list_bad_params_return_400(loaded, query):
    r = loaded.get(f"/api/v1/calls?{query}")
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == 400


def test_list_empty_database(client):
    body = client.get("/api/v1/calls").get_json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["total_pages"] == 0


# ---------- call detail ----------

def test_detail_turns_and_latency(loaded):
    body = loaded.get("/api/v1/calls/restaurant-001").get_json()
    assert body["call_id"] == "restaurant-001"
    assert body["agent"] == "restaurant-demo"
    assert body["outcome"] == "completed"
    assert [t["i"] for t in body["turns"]] == [0, 1, 2]
    assert [t["latency_ms"] for t in body["turns"]] == [None, None, 3700]
    assert body["turns"][1] == {
        "i": 1,
        "speaker": "customer",
        "text": "Two vegetarian thalis please",
        "start_ms": 2600,
        "end_ms": 4300,
        "latency_ms": None,
    }


def test_detail_stats_and_findings(loaded):
    body = loaded.get("/api/v1/calls/restaurant-001").get_json()
    assert body["stats"] == {
        "duration_ms": 10000,
        "turn_count": 3,
        "finding_count": 3,
        "response_count": 1,
        "avg_latency_ms": 3700,
        "max_latency_ms": 3700,
    }
    assert body["review_status"] == "unreviewed"
    assert {f["rule"] for f in body["findings"]} == {"high_latency", "ignored_constraint"}
    for f in body["findings"]:
        assert f["turn_index"] == 2
        assert f["status"] == "open"
        assert f["note"] is None
        assert f["evidence"] and f["explanation"]
        assert isinstance(f["id"], int)


def test_detail_clean_call_with_tool_events(loaded):
    body = loaded.get("/api/v1/calls/flight-001").get_json()
    assert body["findings"] == []
    assert body["review_status"] == "clean"
    assert body["stats"]["avg_latency_ms"] == 500
    assert body["tool_events"] == [{"after_turn": 1, "name": "search_flights", "status": "ok"}]


def test_detail_not_found(loaded):
    r = loaded.get("/api/v1/calls/nope")
    assert r.status_code == 404
    assert r.get_json()["error"]["code"] == 404


# ---------- findings review ----------

def test_patch_confirm_persists_and_updates_review_status(loaded):
    fid = ids_of(loaded, "restaurant-001")[0]
    r = loaded.patch(f"/api/v1/findings/{fid}", json={"status": "confirmed"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["id"] == fid
    assert body["status"] == "confirmed"
    assert body["call_id"] == "restaurant-001"

    detail = loaded.get("/api/v1/calls/restaurant-001").get_json()
    assert next(f for f in detail["findings"] if f["id"] == fid)["status"] == "confirmed"
    assert detail["review_status"] == "in_review"
    items = {c["call_id"]: c for c in loaded.get("/api/v1/calls").get_json()["items"]}
    assert items["restaurant-001"]["review_status"] == "in_review"


def test_patch_all_reviewed(loaded):
    first, second, third = ids_of(loaded, "restaurant-001")
    loaded.patch(f"/api/v1/findings/{first}", json={"status": "confirmed"})
    loaded.patch(f"/api/v1/findings/{second}", json={"status": "dismissed"})
    loaded.patch(f"/api/v1/findings/{third}", json={"status": "confirmed"})
    detail = loaded.get("/api/v1/calls/restaurant-001").get_json()
    assert detail["review_status"] == "reviewed"


def test_patch_note(loaded):
    fid = ids_of(loaded, "restaurant-001")[0]
    r = loaded.patch(f"/api/v1/findings/{fid}", json={"note": "  looks right  "})
    assert r.get_json()["note"] == "looks right"
    assert r.get_json()["status"] == "open"
    assert loaded.patch(f"/api/v1/findings/{fid}", json={"note": ""}).get_json()["note"] is None
    loaded.patch(f"/api/v1/findings/{fid}", json={"note": "again"})
    assert loaded.patch(f"/api/v1/findings/{fid}", json={"note": None}).get_json()["note"] is None


def test_patch_reset_to_open(loaded):
    fid = ids_of(loaded, "restaurant-001")[0]
    loaded.patch(f"/api/v1/findings/{fid}", json={"status": "dismissed"})
    r = loaded.patch(f"/api/v1/findings/{fid}", json={"status": "open"})
    assert r.get_json()["status"] == "open"


@pytest.mark.parametrize(
    "body",
    [
        {"status": "approved"},
        {"status": ["x"]},
        {"status": 5},
        {"colour": "red"},
        {},
        {"note": 123},
        {"note": "x" * 2001},
        [1, 2],
    ],
)
def test_patch_invalid_bodies_return_400(loaded, body):
    fid = ids_of(loaded, "restaurant-001")[0]
    r = loaded.patch(f"/api/v1/findings/{fid}", json=body)
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == 400


def test_patch_non_json_body_returns_400(loaded):
    fid = ids_of(loaded, "restaurant-001")[0]
    r = loaded.patch(f"/api/v1/findings/{fid}", data="hello", content_type="text/plain")
    assert r.status_code == 400


@pytest.mark.parametrize("path", ["/api/v1/findings/99999", "/api/v1/findings/abc"])
def test_patch_unknown_finding_returns_404(client, path):
    r = client.patch(path, json={"status": "confirmed"})
    assert r.status_code == 404
    assert r.get_json()["error"]["code"] == 404


# ---------- errors ----------

def test_unhandled_error_is_json_500_without_trace(app):
    def boom():
        raise RuntimeError("secret detail")

    app.add_url_rule("/boom", "boom", boom)
    r = app.test_client().get("/boom")
    assert r.status_code == 500
    assert r.get_json() == {"error": {"code": 500, "message": "Internal server error"}}
