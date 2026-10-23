import pytest

from tests.test_api import A, B, C

ALL_AGENTS = ["flight-demo", "hotel-demo", "restaurant-demo"]


@pytest.fixture()
def loaded(client):
    assert client.post("/api/v1/import", json=[A, B, C]).status_code == 201
    return client


def test_agents_are_complete_and_sorted(loaded):
    body = loaded.get("/api/v1/calls").get_json()
    assert body["agents"] == ALL_AGENTS


def test_agents_ignore_filters_and_paging(loaded):
    queries = [
        "?source=synthetic",
        "?q=hotel",
        "?agent=hotel-demo",
        "?severity=high",
        "?page=2&page_size=1",
        "?q=zzz-no-match",
    ]
    for query in queries:
        body = loaded.get(f"/api/v1/calls{query}").get_json()
        assert body["agents"] == ALL_AGENTS, query


def test_agents_empty_database(client):
    assert client.get("/api/v1/calls").get_json()["agents"] == []
