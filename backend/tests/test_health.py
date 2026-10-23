def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": "ok"}


def test_unknown_route_returns_json_404(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.get_json()["error"]["code"] == 404
